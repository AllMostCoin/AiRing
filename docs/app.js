/* ═══════════════════════════════════════════════════════════════
   AI Ring — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = '';          // same-origin; adjust if server runs elsewhere

// ─────────────────────────────────────────────────────────────────────────────
// Client-side demo engine (mirrors server.js — used when no backend is present)
// ─────────────────────────────────────────────────────────────────────────────
const AI_MODELS_DATA = [
  { id: 'gpt4',    name: 'GPT-4',   character: 'Cloud',     color: '#7eb8d4', emoji: '⚔️', strengths: ['reasoning', 'coding', 'analysis', 'general'] },
  { id: 'claude',  name: 'Claude',  character: 'Aerith',    color: '#e06080', emoji: '🌸', strengths: ['writing', 'analysis', 'safety', 'nuance'] },
  { id: 'gemini',  name: 'Gemini',  character: 'Tifa',      color: '#cc4422', emoji: '👊', strengths: ['multimodal', 'search', 'factual', 'math'] },
  { id: 'mistral', name: 'Mistral', character: 'Sephiroth', color: '#c8c8ff', emoji: '🌙', strengths: ['coding', 'efficiency', 'multilingual', 'speed'] },
];

const DEMO_TEMPLATES = {
  gpt4: [
    "Based on my analysis, {topic}. I approach this systematically: first considering the context, then evaluating the evidence, and finally synthesizing a reasoned conclusion. The key insight here is that we need to balance multiple perspectives while maintaining analytical rigor.",
    "Excellent question about {topic}. Let me break this down step by step. The core challenge involves understanding the underlying principles, identifying the constraints, and then constructing an optimal solution pathway.",
    "Regarding {topic}, I've processed this carefully. From a reasoning standpoint, the most important factors are: (1) the immediate context, (2) the broader implications, and (3) the practical applications. My recommendation is grounded in logical analysis.",
  ],
  claude: [
    "I find {topic} genuinely fascinating. What strikes me most is the nuanced interplay between different elements here. There's an important ethical dimension worth considering — we should think about not just what's possible, but what's thoughtful and responsible.",
    "When thinking about {topic}, I want to be careful to acknowledge the complexity here. There are multiple valid perspectives, and I think the most honest answer involves recognizing the tension between competing values and priorities.",
    "Thinking through {topic} carefully, I believe the most important thing is to be genuinely helpful while being honest about uncertainty. My analysis suggests a thoughtful, balanced approach that considers all stakeholders.",
  ],
  gemini: [
    "According to the latest information about {topic}, the data shows compelling patterns. Google's research indicates several key factors at play. When I synthesize the available knowledge, multimodal analysis reveals important connections between different data sources.",
    "On the subject of {topic}, current knowledge base entries confirm several interesting findings. The mathematical relationships here are particularly noteworthy, and cross-referencing multiple sources gives us a clearer picture.",
    "Analyzing {topic} from a comprehensive perspective: the factual foundation is solid, the mathematical models support the conclusion, and real-world data corroborates the theoretical framework. Here's the evidence-based answer.",
  ],
  mistral: [
    "For {topic}, I can provide an efficient and precise response. The key algorithmic insight is that we can optimize this by focusing on: speed of execution, accuracy of output, and minimal computational overhead. Here's the optimized approach.",
    "Tackling {topic} with technical precision: the most efficient solution leverages modern techniques. From a code perspective, this translates to clean, readable, and performant implementation that handles edge cases gracefully.",
    "Addressing {topic} directly and efficiently: multilingual knowledge base activated. The cross-domain synthesis here is particularly effective for delivering a concise yet comprehensive answer.",
  ],
};

function generateDemoResponse(modelId, prompt) {
  const templates = DEMO_TEMPLATES[modelId];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const topic = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
  return template.replace(/{topic}/g, `"${topic}"`);
}

const SCORE_KEYWORD_MATCH  = 2;
const SCORE_LENGTH_CAP     = 30;
const SCORE_LENGTH_DIVISOR = 20;
const SCORE_NEWLINE_BONUS  = 5;
const SCORE_LIST_BONUS     = 5;
const SCORE_COLON_BONUS    = 3;
const SCORE_STRENGTH_BONUS = 10;

function scoreResponse(prompt, response, model) {
  let score = 0;
  const promptWords = new Set(
    prompt.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  );
  const responseWords = response.toLowerCase().split(/\W+/);
  for (const word of responseWords) {
    if (promptWords.has(word)) score += SCORE_KEYWORD_MATCH;
  }
  score += Math.min(response.length / SCORE_LENGTH_DIVISOR, SCORE_LENGTH_CAP);
  if (response.includes('\n')) score += SCORE_NEWLINE_BONUS;
  if (/\d+\)|\d+\./.test(response)) score += SCORE_LIST_BONUS;
  if (response.includes(':')) score += SCORE_COLON_BONUS;
  const promptLower = prompt.toLowerCase();
  for (const strength of model.strengths) {
    if (promptLower.includes(strength)) score += SCORE_STRENGTH_BONUS;
  }
  return Math.round(score);
}

function runLocalCompetition(prompt) {
  const results = AI_MODELS_DATA.map((model) => {
    const text = generateDemoResponse(model.id, prompt);
    // Simulate variable latency so each model feels distinct
    const latencyMs = 200 + Math.floor(Math.random() * 900);
    const score = scoreResponse(prompt, text, model);
    return { model, response: text, latencyMs, score };
  });
  results.sort((a, b) => b.score - a.score);
  const winner = results[0];
  return {
    prompt,
    results: results.map((r) => ({
      modelId:   r.model.id,
      name:      r.model.name,
      color:     r.model.color,
      emoji:     r.model.emoji,
      response:  r.response,
      score:     r.score,
      latencyMs: r.latencyMs,
      isDemo:    true,
      isWinner:  r.model.id === winner.model.id,
    })),
    winnerId:   winner.model.id,
    winnerName: winner.model.name,
  };
}

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
  // Mako-green grid lines (FF7 style)
  const GRID_COLOR = 'rgba(0,229,160,1)';
  const RING_COLOR_INNER = 'rgba(0,229,160,0.5)';
  const RING_COLOR_OUTER = 'rgba(0,229,160,0.18)';

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
// Defer until layout is ready, then kick off intro animation
requestAnimationFrame(() => {
  drawFloor();
  playIntroAnimation();
});

// ─────────────────────────────────────────────────────────────────────────────
// Check server / demo mode
// ─────────────────────────────────────────────────────────────────────────────
let backendAvailable = false;

async function checkServerMode() {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) { demoBadge.classList.remove('hidden'); return; }
    const data = await res.json();
    backendAvailable = true;
    if (data.demoMode) demoBadge.classList.remove('hidden');
  } catch (_) {
    // No backend (static hosting / GitHub Pages) — run fully client-side
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
  'Casting materia…',
  'ATB charging…',
  'Drawing from draw point…',
  'Limit break loading…',
  'Analyzing enemy…',
  'Summoning Bahamut…',
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
  gpt4:    { left: '12%', right: '',    top: '15%',    bottom: '' },
  claude:  { left: '',    right: '12%', top: '15%',    bottom: '' },
  gemini:  { left: '12%', right: '',    top: '',       bottom: '15%' },
  mistral: { left: '',    right: '12%', top: '',       bottom: '15%' },
};

// Positions when "converging" to center
const CENTER_POSITIONS = {
  gpt4:    { left: '30%', right: '',    top: '36%',    bottom: '' },
  claude:  { left: '',    right: '30%', top: '36%',    bottom: '' },
  gemini:  { left: '30%', right: '',    top: '',       bottom: '36%' },
  mistral: { left: '',    right: '30%', top: '',       bottom: '36%' },
};

function applyPosition(id, pos) {
  const el = getAgentEl(id);
  el.style.left   = pos.left   || '';
  el.style.right  = pos.right  || '';
  el.style.top    = pos.top    || '';
  el.style.bottom = pos.bottom || '';
}

function convergeAgents() {
  // Left-side characters walk right; right-side characters walk left
  getAgentEl('gpt4').classList.add('walking');
  getAgentEl('gemini').classList.add('walking');
  getAgentEl('claude').classList.add('walking', 'walking-left');
  getAgentEl('mistral').classList.add('walking', 'walking-left');
  MODEL_IDS.forEach((id) => applyPosition(id, CENTER_POSITIONS[id]));
  // Remove walk cycle once they arrive (~700 ms transition)
  setTimeout(() => {
    MODEL_IDS.forEach((id) => getAgentEl(id).classList.remove('walking', 'walking-left'));
  }, 850);
}

function disperseAgents() {
  // Reverse directions for the return walk
  getAgentEl('gpt4').classList.add('walking-left');
  getAgentEl('gemini').classList.add('walking-left');
  getAgentEl('claude').classList.add('walking');
  getAgentEl('mistral').classList.add('walking');
  MODEL_IDS.forEach((id) => applyPosition(id, AGENT_POSITIONS[id]));
  setTimeout(() => {
    MODEL_IDS.forEach((id) => getAgentEl(id).classList.remove('walking', 'walking-left'));
  }, 850);
}

// ─────────────────────────────────────────────────────────────────────────────
// Intro animation — characters walk from corners and meet in the center
// ─────────────────────────────────────────────────────────────────────────────
const INTRO_GREETINGS = {
  gpt4:    '…Let\'s fight.',
  claude:  '♡ Hi everyone!',
  gemini:  'Time to battle!',
  mistral: '…Hmph.',
};

async function playIntroAnimation() {
  await delay(700);

  // Walk to center
  convergeAgents();

  await delay(1100);

  // Meeting! — burst the arena glow
  arenaGlow.classList.add('active', 'meeting');

  // Stagger greeting bubbles for each character
  MODEL_IDS.forEach((id, i) => {
    setTimeout(() => showBubble(id, INTRO_GREETINGS[id]), i * 180);
  });

  await delay(1800);

  // Clear meeting state
  MODEL_IDS.forEach((id) => hideBubble(id));
  arenaGlow.classList.remove('active', 'meeting');

  // Walk back to corners
  disperseAgents();
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
      showBubble(r.modelId, '★ LIMIT BREAK!');
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
    const liveBadge = (!r.isDemo) ? '<span class="live-badge">LIVE</span>' : '';
    header.innerHTML = `
      <span class="response-card-emoji">${r.emoji}</span>
      <span class="response-card-name" style="color:${r.color}">${r.name}</span>
      ${r.isWinner ? '<span class="response-card-badge">LIMIT BREAK</span>' : ''}
      ${liveBadge}
      <span class="response-card-score">Score: ${r.score} · ${r.latencyMs}ms${r.isDemo ? ' · training' : ''}</span>
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
  accordionToggle.textContent = 'Battle Log ▼';
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
  submitBtn.querySelector('.btn-icon').textContent = '⌛';
  thinkingOverlay.classList.add('visible');
  winnerPanel.classList.add('hidden');
  allResponses.classList.add('hidden');

  resetAgents();
  convergeAgents();
  setThinking();
  startThinkingBubbles();

  try {
    let data;

    if (backendAvailable) {
      const res = await fetch(`${API_BASE}/api/compete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      data = await res.json();
    } else {
      // Static / GitHub Pages mode — run competition entirely in the browser
      await delay(800 + Math.floor(Math.random() * 800));
      data = runLocalCompetition(prompt);
    }

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
    submitBtn.querySelector('.btn-icon').textContent = '⚔';
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
