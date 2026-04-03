/* ═══════════════════════════════════════════════════════════════
   AI Ring — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = '';          // same-origin; adjust if server runs elsewhere

// ─────────────────────────────────────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────────────────────────────────────
const promptInput     = document.getElementById('prompt-input');
const submitBtn       = document.getElementById('submit-btn');
const charCount       = document.getElementById('char-count');
const demoBadge       = document.getElementById('demo-badge');
const arenaGlow       = document.getElementById('arena-glow');
const thinkingOverlay = document.getElementById('thinking-overlay');
const winnerPanel     = document.getElementById('winner-panel');
const winnerName      = document.getElementById('winner-name');
const winnerResponse  = document.getElementById('winner-response');
const allResponses    = document.getElementById('all-responses');
const accordionToggle = document.getElementById('accordion-toggle');
const accordionContent= document.getElementById('accordion-content');
const scoreRows       = document.getElementById('score-rows');
const historyList     = document.getElementById('history-list');
const roomFloor       = document.getElementById('room-floor');

const MODEL_IDS = ['gpt4', 'claude', 'gemini', 'mistral'];

// ─────────────────────────────────────────────────────────────────────────────
// Floor grid (canvas)
// ─────────────────────────────────────────────────────────────────────────────
function drawFloor() {
  const room = roomFloor.parentElement;
  const w = room.clientWidth;
  const h = room.clientHeight;
  roomFloor.width  = w;
  roomFloor.height = h;
  const ctx = roomFloor.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const step = 40;
  // Floor grid — canvas element uses CSS opacity: 0.25 so full white here is correct
  const GRID_COLOR = 'rgba(255,255,255,1)';
  const RING_COLOR_INNER = 'rgba(108,99,255,0.4)';
  const RING_COLOR_OUTER = 'rgba(108,99,255,0.15)';

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Center circle
  ctx.strokeStyle = RING_COLOR_INNER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
  ctx.stroke();

  // Outer ring
  ctx.strokeStyle = RING_COLOR_OUTER;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
  ctx.stroke();
}

window.addEventListener('resize', drawFloor);
// Defer until layout is ready
requestAnimationFrame(() => { drawFloor(); });

// ─────────────────────────────────────────────────────────────────────────────
// Check server / demo mode
// ─────────────────────────────────────────────────────────────────────────────
async function checkServerMode() {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.demoMode) demoBadge.classList.remove('hidden');
  } catch (_) {
    demoBadge.classList.remove('hidden');
  }
}

checkServerMode();

// ─────────────────────────────────────────────────────────────────────────────
// Input handlers
// ─────────────────────────────────────────────────────────────────────────────
promptInput.addEventListener('input', () => {
  const len = promptInput.value.length;
  charCount.textContent = `${len} / 2000`;
  submitBtn.disabled = len === 0;
});

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (!submitBtn.disabled) submitBtn.click();
  }
});

accordionToggle.addEventListener('click', () => {
  const content = accordionContent;
  const isHidden = content.classList.contains('hidden');
  content.classList.toggle('hidden', !isHidden);
  accordionToggle.textContent = isHidden
    ? 'Hide all responses ▲'
    : 'Show all responses ▼';
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent helpers
// ─────────────────────────────────────────────────────────────────────────────
function getAgentEl(id) { return document.getElementById(`agent-${id}`); }
function getBubbleEl(id) { return document.getElementById(`bubble-${id}`); }
function getScoreEl(id)  { return document.getElementById(`score-${id}`); }

function resetAgents() {
  MODEL_IDS.forEach((id) => {
    const el = getAgentEl(id);
    el.classList.remove('thinking', 'winner', 'loser');
    getScoreEl(id).textContent = '—';
    hideBubble(id);
  });
  arenaGlow.classList.remove('active');
}

function setThinking() {
  MODEL_IDS.forEach((id) => getAgentEl(id).classList.add('thinking'));
  arenaGlow.classList.add('active');
}

let bubbleTimers = {};

function showBubble(id, text) {
  const el = getBubbleEl(id);
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(bubbleTimers[id]);
  bubbleTimers[id] = setTimeout(() => hideBubble(id), 4000);
}

function hideBubble(id) {
  getBubbleEl(id).classList.remove('visible');
}

// Stagger-show bubbles while thinking
let staggerInterval = null;

const THINKING_MSGS = [
  'Analyzing…',
  'Processing…',
  'Reasoning…',
  'Calculating…',
  'Evaluating…',
  'Synthesizing…',
];

function startThinkingBubbles() {
  let tick = 0;
  staggerInterval = setInterval(() => {
    const id = MODEL_IDS[tick % MODEL_IDS.length];
    const msg = THINKING_MSGS[Math.floor(Math.random() * THINKING_MSGS.length)];
    showBubble(id, msg);
    tick++;
  }, 600);
}

function stopThinkingBubbles() {
  if (staggerInterval) { clearInterval(staggerInterval); staggerInterval = null; }
  MODEL_IDS.forEach((id) => hideBubble(id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Animate agents to center during competition
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_POSITIONS = {
  gpt4:    { left: '15%', right: '',    top: '20%',    bottom: '' },
  claude:  { left: '',    right: '15%', top: '20%',    bottom: '' },
  gemini:  { left: '15%', right: '',    top: '',       bottom: '20%' },
  mistral: { left: '',    right: '15%', top: '',       bottom: '20%' },
};

// Positions when "converging" to center
const CENTER_POSITIONS = {
  gpt4:    { left: '28%', right: '',    top: '35%',    bottom: '' },
  claude:  { left: '',    right: '28%', top: '35%',    bottom: '' },
  gemini:  { left: '28%', right: '',    top: '',       bottom: '35%' },
  mistral: { left: '',    right: '28%', top: '',       bottom: '35%' },
};

function applyPosition(id, pos) {
  const el = getAgentEl(id);
  el.style.left   = pos.left   || '';
  el.style.right  = pos.right  || '';
  el.style.top    = pos.top    || '';
  el.style.bottom = pos.bottom || '';
}

function convergeAgents() {
  MODEL_IDS.forEach((id) => applyPosition(id, CENTER_POSITIONS[id]));
}

function disperseAgents() {
  MODEL_IDS.forEach((id) => applyPosition(id, AGENT_POSITIONS[id]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Render results
// ─────────────────────────────────────────────────────────────────────────────
function renderResults(data) {
  const { results, winnerId, winnerName: wName } = data;
  const maxScore = Math.max(...results.map((r) => r.score), 1);

  // Update agent states
  results.forEach((r) => {
    const el = getAgentEl(r.modelId);
    el.classList.remove('thinking');
    getScoreEl(r.modelId).textContent = r.score;

    if (r.isWinner) {
      el.classList.add('winner');
      showBubble(r.modelId, '🏆 Winner!');
    } else {
      el.classList.add('loser');
    }
  });

  // Scoreboard
  scoreRows.innerHTML = '';
  const sorted = [...results].sort((a, b) => b.score - a.score);
  sorted.forEach((r) => {
    const pct = Math.round((r.score / maxScore) * 100);
    const row = document.createElement('div');
    row.className = `score-row${r.isWinner ? ' winner-row' : ''}`;
    row.innerHTML = `
      <span class="score-row-emoji">${r.emoji}</span>
      <span class="score-row-name">${r.name}${r.isWinner ? ' 👑' : ''}</span>
      <div class="score-row-bar-wrap">
        <div class="score-row-bar" style="width:0; background:${r.color};" data-pct="${pct}"></div>
      </div>
      <span class="score-row-pts">${r.score}</span>
    `;
    scoreRows.appendChild(row);
    // Animate bar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.querySelector('.score-row-bar').style.width = `${pct}%`;
      });
    });
  });

  // Winner panel
  winnerName.textContent = `${results.find((r) => r.isWinner)?.emoji || ''} ${wName}`;
  winnerResponse.textContent = results.find((r) => r.isWinner)?.response || '';
  winnerPanel.classList.remove('hidden');

  // All-responses accordion
  accordionContent.innerHTML = '';
  sorted.forEach((r) => {
    const card = document.createElement('div');
    card.className = `response-card${r.isWinner ? ' winner-card' : ''}`;

    // Build header via innerHTML — only trusted server data (emoji, color, name, score) used
    const header = document.createElement('div');
    header.className = 'response-card-header';
    header.innerHTML = `
      <span class="response-card-emoji">${r.emoji}</span>
      <span class="response-card-name" style="color:${r.color}">${r.name}</span>
      ${r.isWinner ? '<span class="response-card-badge">WINNER</span>' : ''}
      <span class="response-card-score">Score: ${r.score} · ${r.latencyMs}ms${r.isDemo ? ' · demo' : ''}</span>
    `;

    // Use textContent for the response body to prevent XSS from AI-generated content
    const body = document.createElement('div');
    body.className = 'response-card-text';
    body.textContent = r.response;

    card.appendChild(header);
    card.appendChild(body);
    accordionContent.appendChild(card);
  });
  allResponses.classList.remove('hidden');
  // Reset accordion state
  accordionContent.classList.add('hidden');
  accordionToggle.textContent = 'Show all responses ▼';
}

// ─────────────────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────────────────
const history = [];

function addToHistory(data) {
  history.unshift(data);
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) return;
  historyList.innerHTML = '';
  history.slice(0, 10).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const winner = entry.results.find((r) => r.isWinner);
    item.innerHTML = `
      <span class="history-prompt">${escapeHtml(entry.prompt)}</span>
      <span class="history-winner">${winner?.emoji || ''} ${winner?.name || ''}</span>
    `;
    item.addEventListener('click', () => {
      winnerName.textContent = `${winner?.emoji || ''} ${winner?.name || ''}`;
      winnerResponse.textContent = winner?.response || '';
      winnerPanel.classList.remove('hidden');
      renderResults(entry);
    });
    historyList.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: run competition
// ─────────────────────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  // UI: loading
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.querySelector('.btn-icon').textContent = '⏳';
  thinkingOverlay.classList.add('visible');
  winnerPanel.classList.add('hidden');
  allResponses.classList.add('hidden');

  resetAgents();
  convergeAgents();
  setThinking();
  startThinkingBubbles();

  try {
    const res = await fetch(`${API_BASE}/api/compete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    stopThinkingBubbles();
    thinkingOverlay.classList.remove('visible');
    disperseAgents();

    // Small delay so agents settle before results render
    await delay(400);

    renderResults(data);
    addToHistory(data);
  } catch (err) {
    stopThinkingBubbles();
    thinkingOverlay.classList.remove('visible');
    disperseAgents();
    resetAgents();
    alert(`Error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.querySelector('.btn-icon').textContent = '⚔️';
    submitBtn.disabled = promptInput.value.trim().length === 0;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
