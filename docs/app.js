/* ═══════════════════════════════════════════════════════════════
   AI Ring — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = '';          // same-origin; adjust if server runs elsewhere

// ─────────────────────────────────────────────────────────────────────────────
// Local API key storage (Gemini only — browser ↔ Google directly, no backend)
// ─────────────────────────────────────────────────────────────────────────────
const LS_GEMINI_KEY = 'airing_gemini_key';

function getLocalGeminiKey() {
  // Priority: user-supplied key in localStorage → site-wide key injected at deploy time
  try {
    return localStorage.getItem(LS_GEMINI_KEY) || window.AIRING_GEMINI_KEY || '';
  } catch {
    return window.AIRING_GEMINI_KEY || '';
  }
}

function setLocalGeminiKey(key) {
  try { localStorage.setItem(LS_GEMINI_KEY, key); } catch { /* ignore */ }
}

function clearLocalGeminiKey() {
  try { localStorage.removeItem(LS_GEMINI_KEY); } catch { /* ignore */ }
}

async function callGeminiDirect(prompt, key) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || res.statusText;
    throw new Error(`Gemini API error: ${msg}`);
  }
  return data.candidates[0].content.parts[0].text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side demo engine (mirrors server.js — used when no backend is present)
// ─────────────────────────────────────────────────────────────────────────────
const AI_MODELS_DATA = [
  { id: 'gpt4',    name: 'GPT-4',   character: 'Cloud',   color: '#4888d8', emoji: '⚔️', strengths: ['reasoning', 'coding', 'analysis', 'general'] },
  { id: 'claude',  name: 'Claude',  character: 'Barret',  color: '#d84020', emoji: '🔫', strengths: ['writing', 'analysis', 'safety', 'nuance'] },
  { id: 'gemini',  name: 'Gemini',  character: 'Red XIII',color: '#e04010', emoji: '🔥', strengths: ['multimodal', 'search', 'factual', 'math'] },
  { id: 'mistral', name: 'Mistral', character: 'Cid',     color: '#20a8c0', emoji: '✈️', strengths: ['coding', 'efficiency', 'multilingual', 'speed'] },
  { id: 'copilot', name: 'Copilot', character: 'Tifa',    color: '#e03860', emoji: '👊', strengths: ['coding', 'autocomplete', 'refactoring', 'debugging'] },
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
  copilot: [
    "// Autocomplete engaged for {topic}\nBased on patterns across millions of repos, here's the optimal implementation. I've inlined comments, handled edge cases, and added error boundaries. Would you like me to also generate unit tests?",
    "I've analyzed your codebase context for {topic}. Suggestions: 1) Refactor for type safety, 2) Extract reusable helpers, 3) Add guard clauses. My training on GitHub repositories shows this pattern reduces bugs by ~40%. Accepting suggestion…",
    "Scanning open-source patterns for {topic}. Top result: a clean, well-documented solution with zero security vulnerabilities detected. I can also suggest a Copilot Workspace task to automate this across your entire project.",
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

async function runHybridCompetition(prompt) {
  const geminiKey = getLocalGeminiKey();
  const results = await Promise.all(
    AI_MODELS_DATA.map(async (model) => {
      const start = Date.now();
      let text = null;
      let isDemo = true;
      try {
        if (model.id === 'gemini' && geminiKey) {
          text = await callGeminiDirect(prompt, geminiKey);
          isDemo = false;
        }
      } catch (err) {
        text = null;
        // Surface the error to the user via the settings status element
        if (settingsStatus) {
          settingsStatus.textContent = `✗ Gemini live call failed: ${err.message}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
        }
      }
      if (text === null) {
        text = generateDemoResponse(model.id, prompt);
        isDemo = true;
      }
      const latencyMs = Date.now() - start;
      const score = scoreResponse(prompt, text, model);
      return { model, response: text, latencyMs, score, isDemo };
    }),
  );
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
      isDemo:    r.isDemo,
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
const room            = document.getElementById('room');
const zoomBtn         = document.getElementById('zoom-btn');
const settingsBtn     = document.getElementById('settings-btn');
const settingsPanel   = document.getElementById('settings-panel');
const geminiKeyInput  = document.getElementById('gemini-key-input');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsClearBtn= document.getElementById('settings-clear-btn');
const settingsStatus  = document.getElementById('settings-status');
const roundIndicator  = document.getElementById('round-indicator');
const roundLabel      = document.getElementById('round-label');
const roundPips       = [
  document.getElementById('pip-1'),
  document.getElementById('pip-2'),
  document.getElementById('pip-3'),
];

// ─────────────────────────────────────────────────────────────────────────────
// Zoom (full-viewport arena) toggle
// ─────────────────────────────────────────────────────────────────────────────
zoomBtn.addEventListener('click', () => {
  const container = zoomBtn.parentElement;
  const zoomed = container.classList.toggle('zoomed');
  zoomBtn.textContent = zoomed ? '✕' : '⛶';
  zoomBtn.title = zoomed ? 'Exit fullscreen' : 'Toggle fullscreen arena';
  // Redraw floor to match new dimensions
  requestAnimationFrame(drawFloor);
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings panel handlers
// ─────────────────────────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
  const hidden = settingsPanel.classList.toggle('hidden');
  if (!hidden) {
    // Pre-fill with stored key (masked) when opening
    const stored = getLocalGeminiKey();
    geminiKeyInput.value = stored;
    settingsStatus.textContent = stored ? '● Key loaded from storage' : '';
    settingsStatus.className = 'settings-status ok';
  }
});

settingsSaveBtn.addEventListener('click', () => {
  const key = geminiKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalGeminiKey(key);
  settingsStatus.textContent = '✔ Key saved! Gemini will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  // Refresh model status badges
  checkServerMode();
});

settingsClearBtn.addEventListener('click', () => {
  clearLocalGeminiKey();
  geminiKeyInput.value = '';
  settingsStatus.textContent = '✔ Key cleared. Gemini will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

const MODEL_IDS = ['gpt4', 'claude', 'gemini', 'mistral', 'copilot'];

// Home positions — populated at runtime by initTeams() for a random 2 vs 3 split
const AGENT_POSITIONS = {};

// Team side assignment — populated by initTeams(); 'left' | 'right'
const agentSide = {};

// Floor slots for the 2-member side (left or right)
// far: near the center horizon; near: outer edge, floor-front
const SLOTS_2 = [
  { left: '22%', right: '',     top: '56%', bottom: '',    depth: 'far'  },
  { left: '2%',  right: '',     top: '',    bottom: '5%',  depth: 'near' },
];
const SLOTS_2_R = [
  { left: '',    right: '22%',  top: '56%', bottom: '',    depth: 'far'  },
  { left: '',    right: '2%',   top: '',    bottom: '5%',  depth: 'near' },
];

// Floor slots for the 3-member side (left or right)
// Staggered triangle: far → center-back, mid → outer edge mid-height, near → inner front
const SLOTS_3 = [
  { left: '28%', right: '',     top: '56%', bottom: '',    depth: 'far'  },
  { left: '1%',  right: '',     top: '',    bottom: '26%', depth: 'mid'  },
  { left: '14%', right: '',     top: '',    bottom: '3%',  depth: 'near' },
];
const SLOTS_3_R = [
  { left: '',    right: '28%',  top: '56%', bottom: '',    depth: 'far'  },
  { left: '',    right: '1%',   top: '',    bottom: '26%', depth: 'mid'  },
  { left: '',    right: '14%',  top: '',    bottom: '3%',  depth: 'near' },
];

// Assign characters to random 2 vs 3 floor slots and update their DOM state
function initTeams() {
  const shuffled = [...MODEL_IDS].sort(() => Math.random() - 0.5);
  const twoOnLeft = Math.random() < 0.5;

  const leftIds  = twoOnLeft ? shuffled.slice(0, 2) : shuffled.slice(0, 3);
  const rightIds = twoOnLeft ? shuffled.slice(2, 5) : shuffled.slice(3, 5);
  const leftSlots  = twoOnLeft ? SLOTS_2   : SLOTS_3;
  const rightSlots = twoOnLeft ? SLOTS_3_R : SLOTS_2_R;

  leftIds.forEach((id, i) => {
    const slot = leftSlots[i];
    AGENT_POSITIONS[id] = slot;
    agentSide[id] = 'left';
    const el = getAgentEl(id);
    if (el) {
      el.setAttribute('data-depth', slot.depth);
      el.classList.remove('facing-left');
      applyPosition(id, slot);
    }
  });

  rightIds.forEach((id, i) => {
    const slot = rightSlots[i];
    AGENT_POSITIONS[id] = slot;
    agentSide[id] = 'right';
    const el = getAgentEl(id);
    if (el) {
      el.setAttribute('data-depth', slot.depth);
      el.classList.add('facing-left');
      applyPosition(id, slot);
    }
  });
}

// Battle positions — converged on floor; all below horizon (~52%)
const CENTER_POSITIONS = {
  gpt4:    { left: '28%',  right: '',     top: '54%',    bottom: '' },
  claude:  { left: '',     right: '28%',  top: '54%',    bottom: '' },
  gemini:  { left: '28%',  right: '',     top: '',       bottom: '22%' },
  mistral: { left: '',     right: '28%',  top: '',       bottom: '22%' },
  copilot: { left: '41%',  right: '',     top: '',       bottom: '22%' },
};

// Approximate pixel-center of each character when converged (% of room)
// All positions are on the floor (y > 52 ensures below the horizon)
const BATTLE_POS = {
  gpt4:    { x: 34, y: 56 },
  claude:  { x: 66, y: 56 },
  gemini:  { x: 34, y: 66 },
  mistral: { x: 66, y: 66 },
  copilot: { x: 50, y: 70 },
};

// FF7-style damage number pool
const DAMAGE_POOL = [42, 64, 87, 99, 128, 175, 210, 256, 333, 512];

// Probability that an attack is a materia spell cast rather than a melee lunge
const MATERIA_CAST_CHANCE = 0.28;

// ─────────────────────────────────────────────────────────────────────────────
// Floor canvas — Mode 7 perspective checkerboard (SUPER 256 style)
// ─────────────────────────────────────────────────────────────────────────────
function drawFloor() {
  const roomEl = roomFloor.parentElement;
  const w = roomEl.clientWidth;
  const h = roomEl.clientHeight;
  roomFloor.width  = w;
  roomFloor.height = h;
  const ctx = roomFloor.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Floor starts just below the horizon (52% down)
  const HORIZON_Y = h * 0.52;
  const VP_X = w * 0.5;

  // Mako-tinted checkerboard colors
  const DARK  = '#001c38';
  const LIGHT = '#003060';
  const LINE  = '#001428';

  const ROWS = 22;
  const BASE_COLS = 6;

  for (let row = 0; row < ROWS; row++) {
    const t0 = row / ROWS;
    const t1 = (row + 1) / ROWS;
    // Perspective compression — rows bunch up near horizon
    const y0 = HORIZON_Y + (h - HORIZON_Y) * Math.pow(t0, 1.9);
    const y1 = HORIZON_Y + (h - HORIZON_Y) * Math.pow(t1, 1.9);

    const spread0 = (y0 - HORIZON_Y) / (h - HORIZON_Y);
    const spread1 = (y1 - HORIZON_Y) / (h - HORIZON_Y);

    // Left/right edge of each row — converge at vanishing point
    const lx0 = VP_X * (1 - spread0);
    const rx0 = w - VP_X * (1 - spread0);
    const lx1 = VP_X * (1 - spread1);
    const rx1 = w - VP_X * (1 - spread1);

    // More columns at the bottom, fewer near the horizon
    const cols = Math.max(2, BASE_COLS + Math.round(spread1 * 10));

    for (let col = 0; col < cols; col++) {
      const fx0 = col / cols;
      const fx1 = (col + 1) / cols;
      const x00 = lx0 + (rx0 - lx0) * fx0;
      const x10 = lx0 + (rx0 - lx0) * fx1;
      const x01 = lx1 + (rx1 - lx1) * fx0;
      const x11 = lx1 + (rx1 - lx1) * fx1;

      ctx.beginPath();
      ctx.moveTo(x00, y0);
      ctx.lineTo(x10, y0);
      ctx.lineTo(x11, y1);
      ctx.lineTo(x01, y1);
      ctx.closePath();

      ctx.fillStyle = (row + col) % 2 === 0 ? DARK : LIGHT;
      ctx.fill();

      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

window.addEventListener('resize', drawFloor);
// Wait for full page load so the room element is laid out with its final dimensions
window.addEventListener('load', () => {
  initTeams();
  drawFloor();
  playIntroAnimation();
});

// ─────────────────────────────────────────────────────────────────────────────
// Check server / demo mode — apply per-model LIVE/DEMO status badges
// ─────────────────────────────────────────────────────────────────────────────
let backendAvailable = false;

// Append a small LIVE/DEMO status indicator below each character label
function applyModelStatus(configured) {
  MODEL_IDS.forEach((id) => {
    const wrapper = getAgentEl(id);
    if (!wrapper) return;
    // Remove any existing status badge
    const existing = wrapper.querySelector('.api-status-badge');
    if (existing) existing.remove();
    const isLive = configured && configured[id];
    const badge = document.createElement('div');
    badge.className = `api-status-badge ${isLive ? 'api-live' : 'api-demo'}`;
    badge.textContent = isLive ? '● LIVE' : '○ DEMO';
    wrapper.appendChild(badge);
  });
}

async function checkServerMode() {
  // Shared fallback used when no backend is reachable (static / GitHub Pages).
  function applyLocalOnly() {
    const geminiKey = getLocalGeminiKey();
    const localConfigured = {
      gpt4: false, claude: false, gemini: !!geminiKey, mistral: false, copilot: false,
    };
    const anyLive = Object.values(localConfigured).some(Boolean);
    if (!anyLive) demoBadge.classList.remove('hidden');
    applyModelStatus(localConfigured);
  }

  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) {
      // Non-2xx (e.g. 404 on GitHub Pages) — treat same as no backend
      applyLocalOnly();
      return;
    }
    const data = await res.json();
    backendAvailable = true;
    // Merge server-configured status with any locally-stored Gemini key so the
    // badge correctly reflects LIVE when the user has saved their own key.
    const configured = data.configured || {};
    if (!configured.gemini && getLocalGeminiKey()) configured.gemini = true;
    const anyLive = Object.values(configured).some(Boolean);
    if (!anyLive) demoBadge.classList.remove('hidden');
    applyModelStatus(configured);
  } catch (_) {
    // Network error / no backend (static hosting / GitHub Pages)
    applyLocalOnly();
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
    el.classList.remove(
      'thinking', 'winner', 'loser',
      'charging', 'lunging-right', 'lunging-left',
      'flinching-left', 'flinching-right',
    );
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
  'Limit Break charging…',
  'Materia attuned…',
  'Mako energy rising…',
  'Summon loading…',
  'ATB gauge filling…',
  'Omnislash queuing…',
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
// Battle system — FF7-style fight choreography
// ─────────────────────────────────────────────────────────────────────────────

function spawnImpactFlash(pctX, pctY, color) {
  const el = document.createElement('div');
  el.className = 'impact-flash';
  el.style.cssText = `left:${pctX}%;top:${pctY}%;--color:${color}`;
  room.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function spawnDamageNumber(pctX, pctY, amount, color) {
  const el = document.createElement('div');
  el.className = 'damage-number';
  el.style.cssText = `left:${pctX}%;top:${pctY}%;color:${color}`;
  el.textContent = amount;
  room.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function spawnMateriaShot(fromX, fromY, toX, toY, color) {
  const el = document.createElement('div');
  el.className = 'materia-shot';
  // Compute pixel delta for the CSS translate (% in translate() is relative to
  // the element itself, not the container, so we convert to px via room size)
  const roomW = room.clientWidth;
  const roomH = room.clientHeight;
  const tx = Math.round((toX - fromX) / 100 * roomW);
  const ty = Math.round((toY - fromY) / 100 * roomH);
  const dist = Math.hypot(tx, ty);
  const dur  = Math.max(220, Math.round(dist * 1.1));
  el.style.cssText =
    `left:${fromX}%;top:${fromY}%;background:${color};` +
    `box-shadow:0 0 10px ${color},0 0 22px ${color};` +
    `--tx:${tx}px;--ty:${ty}px`;
  el.style.animationDuration = `${dur}ms`;
  room.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function spawnSparks(pctX, pctY, color) {
  const COUNT = 5;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * 2 * Math.PI + Math.random() * 0.8;
    const dist  = 22 + Math.random() * 24;
    const sx    = Math.round(Math.cos(angle) * dist);
    const sy    = Math.round(Math.sin(angle) * dist);
    const dur   = 280 + Math.floor(Math.random() * 140);
    const el    = document.createElement('div');
    el.className = 'spark';
    el.style.cssText =
      `left:${pctX}%;top:${pctY}%;background:${color};` +
      `box-shadow:0 0 4px ${color};` +
      `--sx:${sx}px;--sy:${sy}px;--dur:${dur}ms`;
    room.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}

function arenaShake() {
  room.classList.remove('shaking');
  void room.offsetWidth; // force reflow to restart animation
  room.classList.add('shaking');
  room.addEventListener('animationend', () => room.classList.remove('shaking'), { once: true });
}


function spawnScreenFlash() {
  const el = document.createElement('div');
  room.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

let battleActive    = false;
let battleLoopId    = null;

async function fireBattleRound() {
  // Pick a random attacker and a different random defender
  const order     = [...MODEL_IDS].sort(() => Math.random() - 0.5);
  const attackerId = order[0];
  const defenderId = order[1];
  const attackerEl = getAgentEl(attackerId);
  const defenderEl = getAgentEl(defenderId);
  const model      = AI_MODELS_DATA.find((m) => m.id === attackerId);
  const useSpell   = Math.random() < MATERIA_CAST_CHANCE;

  const attPos = agentXY(attackerId);
  const defPos = agentXY(defenderId);
  // Impact lands between attacker and defender, biased toward defender
  const impactX = defPos.x * 0.58 + attPos.x * 0.42;
  const impactY = defPos.y * 0.58 + attPos.y * 0.42;

  // 1. Charge
  attackerEl.classList.add('charging');
  await delay(230);
  attackerEl.classList.remove('charging');

  // 2. Attack
  if (useSpell) {
    spawnMateriaShot(attPos.x, attPos.y, defPos.x, defPos.y, model.color);
    await delay(310);
  } else {
    const dir = attPos.x <= defPos.x ? 'lunging-right' : 'lunging-left';
    attackerEl.classList.add(dir);
    await delay(210);
    attackerEl.classList.remove(dir);
  }

  // 3. Impact
  const dmg = DAMAGE_POOL[Math.floor(Math.random() * DAMAGE_POOL.length)];
  spawnImpactFlash(impactX, impactY, model.color);
  spawnDamageNumber(defPos.x, defPos.y - 9, dmg, model.color);
  spawnSparks(impactX, impactY, model.color);
  if (Math.random() < 0.50) spawnScreenFlash();
  if (Math.random() < 0.40) arenaShake();

  // 4. Defender flinches (pushed away from attacker)
  const flinchDir = attPos.x <= defPos.x ? 'flinching-right' : 'flinching-left';
  defenderEl.classList.add(flinchDir, 'hit');
  await delay(340);
  defenderEl.classList.remove(flinchDir, 'hit');
}

function startBattleSequence() {
  battleActive = true;
  MODEL_IDS.forEach((id) => getAgentEl(id).classList.add('fighting'));
  const loop = async () => {
    if (!battleActive) return;
    await fireBattleRound();
    if (battleActive) {
      battleLoopId = setTimeout(loop, 280 + Math.floor(Math.random() * 360));
    }
  };
  loop();
}

function stopBattleSequence() {
  battleActive = false;
  if (battleLoopId) { clearTimeout(battleLoopId); battleLoopId = null; }
  MODEL_IDS.forEach((id) =>
    getAgentEl(id).classList.remove(
      'fighting', 'charging', 'lunging-right', 'lunging-left',
      'flinching-left', 'flinching-right', 'hit',
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animate agents to center during competition
// ─────────────────────────────────────────────────────────────────────────────

function applyPosition(id, pos) {
  const el = getAgentEl(id);
  el.style.left   = pos.left   || '';
  el.style.right  = pos.right  || '';
  el.style.top    = pos.top    || '';
  el.style.bottom = pos.bottom || '';
}

// Convert a home AGENT_POSITIONS entry to a percentage x/y point for effects
function agentXY(id) {
  const pos = AGENT_POSITIONS[id];
  const x = pos.left  ? parseFloat(pos.left)  : 100 - parseFloat(pos.right);
  const y = pos.top   ? parseFloat(pos.top)   : 100 - parseFloat(pos.bottom);
  return { x, y };
}

async function convergeAgents() {
  // Characters stay in their home positions — no movement
}

function disperseAgents() {
  // Characters stay in their home positions — no movement
}

// ─────────────────────────────────────────────────────────────────────────────
// Intro animation — characters walk from corners and meet in the center
// ─────────────────────────────────────────────────────────────────────────────
const INTRO_GREETINGS = {
  gpt4:    'Not interested.',
  claude:  'Yo! AVALANCHE!',
  gemini:  'Nanaki, ready.',
  mistral: '#$%@! Let\'s go!',
  copilot: 'For the Planet!',
};

async function playIntroAnimation() {
  await delay(700);

  // Walk to center, one character at a time
  await convergeAgents();

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
  const { results, winnerId, winnerName: wName, totalRounds } = data;
  const maxScore = Math.max(...results.map((r) => r.score), 1);

  // Score display (agent classes already set by the battle flow;
  // re-applying them here is harmless and supports history replays)
  results.forEach((r) => {
    const el = getAgentEl(r.modelId);
    el.classList.remove('thinking');
    getScoreEl(r.modelId).textContent = r.score;
    if (r.isWinner) {
      el.classList.add('winner');
    } else {
      el.classList.add('loser');
    }
  });

  // Scoreboard
  scoreRows.innerHTML = '';
  const sorted = [...results].sort((a, b) => b.score - a.score);
  sorted.forEach((r) => {
    const pct = Math.round((r.score / maxScore) * 100);
    const winsLabel = totalRounds && r.roundWins !== undefined
      ? ` · ${r.roundWins}W` : '';
    const row = document.createElement('div');
    row.className = `score-row${r.isWinner ? ' winner-row' : ''}`;
    row.innerHTML = `
      <span class="score-row-emoji">${r.emoji}</span>
      <span class="score-row-name">${r.name}${r.isWinner ? ' 👑' : ''}</span>
      <div class="score-row-bar-wrap">
        <div class="score-row-bar" style="width:0; background:${r.color};" data-pct="${pct}"></div>
      </div>
      <span class="score-row-pts">${r.score}${winsLabel}</span>
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
  const winnerResult = results.find((r) => r.isWinner);
  const winsStr = (totalRounds && winnerResult?.roundWins !== undefined)
    ? ` (${winnerResult.roundWins}/${totalRounds} rounds)` : '';
  winnerName.textContent = `${winnerResult?.emoji || ''} ${wName}${winsStr}`;
  winnerResponse.textContent = winnerResult?.response || '';
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
    const winsInfo = (totalRounds && r.roundWins !== undefined)
      ? ` · ${r.roundWins}/${totalRounds} rounds` : '';
    header.innerHTML = `
      <span class="response-card-emoji">${r.emoji}</span>
      <span class="response-card-name" style="color:${r.color}">${r.name}</span>
      ${r.isWinner ? '<span class="response-card-badge">MATCH WIN</span>' : ''}
      ${liveBadge}
      <span class="response-card-score">Score: ${r.score}${winsInfo} · ${r.latencyMs}ms${r.isDemo ? ' · training' : ''}</span>
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
// Round system helpers
// ─────────────────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;

function showRoundBanner(roundNum) {
  roundLabel.textContent = `ROUND ${roundNum}`;
  roundIndicator.classList.remove('hidden', 'stamp');
  // Trigger reflow to restart animation
  void roundIndicator.offsetWidth;
  roundIndicator.classList.add('stamp');
}

function updateRoundPips(completedRounds) {
  roundPips.forEach((pip, i) => {
    pip.classList.remove('done', 'current');
    if (i < completedRounds) pip.classList.add('done');
    else if (i === completedRounds) pip.classList.add('current');
  });
}

function resetRoundPips() {
  roundPips.forEach((pip) => pip.classList.remove('done', 'current'));
}

// Fetch one round of competition results
async function fetchOneRound(prompt) {
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
    return res.json();
  }
  // Static / GitHub Pages mode
  const hasKey = !!getLocalGeminiKey();
  await delay(hasKey ? 800 : 2200 + Math.floor(Math.random() * 800));
  return runHybridCompetition(prompt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: run 3-round competition
// ─────────────────────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  // UI: loading
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.querySelector('.btn-icon').textContent = '⌛';
  winnerPanel.classList.add('hidden');
  allResponses.classList.add('hidden');

  resetAgents();
  resetRoundPips();

  // Accumulate wins and last-round data for each model
  const wins = {};  // modelId → number of round wins
  MODEL_IDS.forEach((id) => { wins[id] = 0; });
  const roundResults = [];  // one entry per round
  let lastData = null;

  try {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      // Show round banner
      showRoundBanner(round);
      updateRoundPips(round - 1);

      // Walk to center, one character at a time
      setThinking();
      startThinkingBubbles();
      await convergeAgents();
      startBattleSequence();

      // Fetch results for this round
      const data = await fetchOneRound(prompt);

      // Battle concludes
      stopBattleSequence();
      stopThinkingBubbles();
      lastData = data;
      roundResults.push(data);

      // Credit win to round winner
      wins[data.winnerId] = (wins[data.winnerId] || 0) + 1;

      // Show round result on characters
      const roundWinMsg = `ROUND ${round} WIN!`;
      data.results.forEach((r) => {
        const el = getAgentEl(r.modelId);
        el.classList.remove('thinking');
        getScoreEl(r.modelId).textContent = r.score;
        if (r.isWinner) {
          el.classList.add('winner');
          showBubble(r.modelId, round < TOTAL_ROUNDS ? roundWinMsg : '★ ULTIMATE!');
        } else {
          el.classList.add('loser');
        }
      });

      // Let victory / defeat pose play for a moment
      await delay(round < TOTAL_ROUNDS ? 1400 : 2200);

      // Mark pip as done
      updateRoundPips(round);

      if (round < TOTAL_ROUNDS) {
        // Reset agents for next round — disperse, then clear states
        disperseAgents();
        await delay(200);
        MODEL_IDS.forEach((id) => {
          const el = getAgentEl(id);
          el.classList.remove('winner', 'loser', 'thinking');
        });
        await delay(300);
      }
    }

    // Determine match winner (most round wins; score tiebreak on last round)
    const maxWins = Math.max(...MODEL_IDS.map((id) => wins[id]));
    let matchWinnerIds = MODEL_IDS.filter((id) => wins[id] === maxWins);
    if (matchWinnerIds.length > 1 && lastData) {
      // Tiebreak by score in the final round
      const lastRoundScores = {};
      lastData.results.forEach((r) => { lastRoundScores[r.modelId] = r.score; });
      matchWinnerIds.sort((a, b) => (lastRoundScores[b] || 0) - (lastRoundScores[a] || 0));
    }
    const matchWinnerId = matchWinnerIds[0];
    const matchWinnerModel = AI_MODELS_DATA.find((m) => m.id === matchWinnerId);

    // Compose aggregated results for renderResults
    const aggregated = AI_MODELS_DATA.map((model) => {
      // Sum scores across all rounds for this model
      const totalScore = roundResults.reduce((sum, rd) => {
        const r = rd.results.find((x) => x.modelId === model.id);
        return sum + (r ? r.score : 0);
      }, 0);
      // Use response from the winning round (or last round)
      const bestRound = roundResults.reduce((best, rd) => {
        const r = rd.results.find((x) => x.modelId === model.id);
        if (!best || (r && r.isWinner)) return r;
        return best;
      }, null) || lastData.results.find((x) => x.modelId === model.id);
      return {
        modelId:   model.id,
        name:      model.name,
        color:     model.color,
        emoji:     model.emoji,
        response:  bestRound ? bestRound.response : '',
        score:     totalScore,
        latencyMs: bestRound ? bestRound.latencyMs : 0,
        isDemo:    bestRound ? bestRound.isDemo : true,
        roundWins: wins[model.id],
        isWinner:  model.id === matchWinnerId,
      };
    });
    aggregated.sort((a, b) => b.score - a.score);

    const matchData = {
      prompt,
      results:    aggregated,
      winnerId:   matchWinnerId,
      winnerName: matchWinnerModel ? matchWinnerModel.name : matchWinnerId,
      totalRounds: TOTAL_ROUNDS,
    };

    // Highlight the overall match winner / losers
    MODEL_IDS.forEach((id) => {
      const el = getAgentEl(id);
      el.classList.remove('winner', 'loser');
      if (id === matchWinnerId) {
        el.classList.add('winner');
        showBubble(id, `★ MATCH WIN! (${wins[id]}W-${TOTAL_ROUNDS - wins[id]}L)`);
      } else {
        el.classList.add('loser');
      }
    });

    await delay(2200);

    // Characters walk back to their corners
    disperseAgents();
    await delay(100);

    renderResults(matchData);
    addToHistory(matchData);
  } catch (err) {
    stopBattleSequence();
    stopThinkingBubbles();
    disperseAgents();
    resetAgents();
    resetRoundPips();
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
