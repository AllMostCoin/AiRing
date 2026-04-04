/* ═══════════════════════════════════════════════════════════════
   AI Ring — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = '';          // same-origin; adjust if server runs elsewhere

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

const MODEL_IDS = ['gpt4', 'claude', 'gemini', 'mistral', 'copilot'];

// Home positions — 5-character layout; far/near depth handled by CSS scale
const AGENT_POSITIONS = {
  gpt4:    { left: '10%',  right: '',     top: '12%',    bottom: '' },
  claude:  { left: '',     right: '10%',  top: '12%',    bottom: '' },
  gemini:  { left: '8%',   right: '',     top: '',       bottom: '12%' },
  mistral: { left: '',     right: '8%',   top: '',       bottom: '12%' },
  copilot: { left: '41%',  right: '',     top: '',       bottom: '12%' },
};

// Battle positions — converged on floor; far pair higher (near horizon), near pair lower
const CENTER_POSITIONS = {
  gpt4:    { left: '28%',  right: '',     top: '34%',    bottom: '' },
  claude:  { left: '',     right: '28%',  top: '34%',    bottom: '' },
  gemini:  { left: '28%',  right: '',     top: '',       bottom: '22%' },
  mistral: { left: '',     right: '28%',  top: '',       bottom: '22%' },
  copilot: { left: '41%',  right: '',     top: '',       bottom: '22%' },
};

// Approximate pixel-center of each character when converged (% of room)
// Far characters sit higher (near horizon), near sit lower (front of floor)
const BATTLE_POS = {
  gpt4:    { x: 34, y: 40 },
  claude:  { x: 66, y: 40 },
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
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) { demoBadge.classList.remove('hidden'); applyModelStatus(null); return; }
    const data = await res.json();
    backendAvailable = true;
    if (data.demoMode) demoBadge.classList.remove('hidden');
    applyModelStatus(data.configured || null);
  } catch (_) {
    // No backend (static hosting / GitHub Pages) — run fully client-side
    demoBadge.classList.remove('hidden');
    applyModelStatus(null);
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

function spawnScreenFlash() {
  const el = document.createElement('div');
  el.className = 'room-flash';
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

  const attPos = BATTLE_POS[attackerId];
  const defPos = BATTLE_POS[defenderId];
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
  if (Math.random() < 0.35) spawnScreenFlash();

  // 4. Defender flinches (pushed away from attacker)
  const flinchDir = attPos.x <= defPos.x ? 'flinching-right' : 'flinching-left';
  defenderEl.classList.add(flinchDir);
  await delay(340);
  defenderEl.classList.remove(flinchDir);
}

function startBattleSequence() {
  battleActive = true;
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
      'charging', 'lunging-right', 'lunging-left',
      'flinching-left', 'flinching-right',
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

function convergeAgents() {
  // Left-side characters walk right; right-side characters walk left
  getAgentEl('gpt4').classList.add('walking');
  getAgentEl('gemini').classList.add('walking');
  getAgentEl('claude').classList.add('walking-left');
  getAgentEl('mistral').classList.add('walking-left');
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
  gpt4:    'Not interested.',
  claude:  'Yo! AVALANCHE!',
  gemini:  'Nanaki, ready.',
  mistral: '#$%@! Let\'s go!',
  copilot: 'For the Planet!',
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
      ${r.isWinner ? '<span class="response-card-badge">ULTIMATE</span>' : ''}
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
  winnerPanel.classList.add('hidden');
  allResponses.classList.add('hidden');

  resetAgents();
  convergeAgents();
  setThinking();
  startThinkingBubbles();

  // Wait for characters to march in, then let the battle begin
  await delay(900);
  startBattleSequence();

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
      // Static / GitHub Pages mode — give enough time for a few battle rounds
      await delay(2200 + Math.floor(Math.random() * 800));
      data = runLocalCompetition(prompt);
    }

    // Battle concludes
    stopBattleSequence();
    stopThinkingBubbles();

    // Apply winner / loser states and trigger their pose animations
    data.results.forEach((r) => {
      const el = getAgentEl(r.modelId);
      el.classList.remove('thinking');
      getScoreEl(r.modelId).textContent = r.score;
      if (r.isWinner) {
        el.classList.add('winner');
        showBubble(r.modelId, '★ ULTIMATE!');
      } else {
        el.classList.add('loser');
      }
    });

    // Let victory pose + defeat play out
    await delay(2200);

    // Characters walk back to their corners
    disperseAgents();
    await delay(950);

    renderResults(data);
    addToHistory(data);
  } catch (err) {
    stopBattleSequence();
    stopThinkingBubbles();
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
