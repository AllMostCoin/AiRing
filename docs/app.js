/* ═══════════════════════════════════════════════════════════════
   AI Ring — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Login Gate — protect the site with Phantom wallet when AIRING_LOGIN_HASH is set.
// AIRING_LOGIN_HASH is injected at deploy time via config.js and acts as a
// session token: any non-empty value enables the gate, and its value is stored
// in sessionStorage so that sessions are invalidated on each new deployment.
// If AIRING_LOGIN_HASH is empty the gate is skipped entirely.
// ─────────────────────────────────────────────────────────────────────────────
(function initLoginGate() {
  const loginHash = (typeof window !== 'undefined' && window.AIRING_LOGIN_HASH) || '';
  if (!loginHash) return;  // no login configured — open access

  const SS_KEY = 'airing_authenticated';

  function isAuthenticated() {
    try { return sessionStorage.getItem(SS_KEY) === loginHash; } catch { return false; }
  }

  function setAuthenticated() {
    try { sessionStorage.setItem(SS_KEY, loginHash); } catch { /* ignore */ }
  }

  function getPhantomProviderForLogin() {
    if (typeof window === 'undefined') return null;
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom)          return window.solana;
    return null;
  }

  function showGate() {
    const gate = document.getElementById('login-gate');
    if (gate) gate.classList.remove('hidden');
  }

  function hideGate() {
    const gate = document.getElementById('login-gate');
    if (gate) gate.classList.add('hidden');
  }

  function showLoginError(errEl, message) {
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.remove('hidden');
    errEl.style.animation = 'none';
    // Force reflow to re-trigger shake animation
    void errEl.offsetWidth;
    errEl.style.animation = '';
  }

  if (isAuthenticated()) return;  // already authenticated this session

  // Wait for DOM to be ready before showing the gate
  function onReady(fn) {
    if (document.readyState !== 'loading') { fn(); } else { document.addEventListener('DOMContentLoaded', fn); }
  }

  onReady(async () => {
    // Attempt silent reconnect before showing the gate.
    // waitForPhantomProvider waits up to 800 ms for phantom#initialized so the
    // gate is not shown just because the extension hasn't injected yet.
    const providerEarly = await waitForPhantomProvider(getPhantomProviderForLogin);
    if (providerEarly) {
      providerEarly.connect({ onlyIfTrusted: true })
        .then((resp) => {
          // Some Phantom versions set provider.publicKey rather than returning it
          if (resp?.publicKey ?? providerEarly.publicKey) {
            setAuthenticated();
            // Gate stays hidden — no need to show it
          } else {
            showGate();
          }
        })
        .catch(() => showGate());
    } else {
      showGate();
    }

    const btn   = document.getElementById('login-phantom-btn');
    const errEl = document.getElementById('login-error');

    if (!btn) return;

    btn.addEventListener('click', async () => {
      // Wait for phantom#initialized if the extension hasn't injected yet.
      const provider = await waitForPhantomProvider(getPhantomProviderForLogin);
      if (!provider) {
        // Phantom not installed — open the Phantom install page in a new tab
        // so the user stays on the login page in their regular browser.
        openPhantomOrRedirect();
        showLoginError(errEl, '◈ PHANTOM NOT FOUND — INSTALL PHANTOM');
        return;
      }

      btn.disabled = true;
      btn.textContent = '◈ CONNECTING…';
      if (errEl) errEl.classList.add('hidden');

      try {
        const resp = await provider.connect();
        // Some Phantom versions set provider.publicKey rather than returning it
        const pubkey = resp?.publicKey ?? provider.publicKey;
        if (pubkey) {
          setAuthenticated();
          hideGate();
        } else {
          // Connected but no public key — surface an error so the user can retry
          btn.textContent = '◈ CONNECT PHANTOM';
          btn.disabled = false;
          showLoginError(errEl, '✖ CONNECTION FAILED — TRY AGAIN');
        }
      } catch (err) {
        btn.textContent = '◈ CONNECT PHANTOM';
        btn.disabled = false;
        showLoginError(errEl, '✖ CONNECTION FAILED — TRY AGAIN');
        console.error('[login] phantom connect error:', err);
      }
    });
  });
}());

// same-origin by default; set window.AIRING_API_BASE to point to a remote backend.
// If the configured URL uses http:// but the page is served over HTTPS, upgrade it
// to https:// automatically to prevent mixed-content blocking of all API calls.
const API_BASE = (() => {
  const raw = (typeof window !== 'undefined' && window.AIRING_API_BASE) || '';
  if (raw.startsWith('http://') && window.location.protocol === 'https:') {
    return 'https://' + raw.slice('http://'.length);
  }
  return raw;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Local API key storage (Gemini + Claude + OpenAI — browser ↔ API directly, no backend needed)
// ─────────────────────────────────────────────────────────────────────────────
const LS_GEMINI_KEY    = 'airing_gemini_key';
const LS_GROK_KEY      = 'airing_grok_key';
const LS_CLAUDE_KEY    = 'airing_claude_key';
const LS_OLLAMA_MODEL  = 'airing_ollama_model';
const LS_OLLAMA_URL    = 'airing_ollama_url';
const LS_OPENAI_KEY    = 'airing_openai_key';
const LS_MISTRAL_KEY   = 'airing_mistral_key';
const LS_COPILOT_KEY   = 'airing_copilot_key';

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
  window.AIRING_GEMINI_KEY = '';
}

function getLocalGrokKey() {
  try {
    return localStorage.getItem(LS_GROK_KEY) || window.AIRING_GROK_KEY || '';
  } catch {
    return window.AIRING_GROK_KEY || '';
  }
}

function setLocalGrokKey(key) {
  try { localStorage.setItem(LS_GROK_KEY, key); } catch { /* ignore */ }
}

function clearLocalGrokKey() {
  try { localStorage.removeItem(LS_GROK_KEY); } catch { /* ignore */ }
  window.AIRING_GROK_KEY = '';
}

function getLocalClaudeKey() {
  try {
    return localStorage.getItem(LS_CLAUDE_KEY) || window.AIRING_CLAUDE_KEY || '';
  } catch {
    return window.AIRING_CLAUDE_KEY || '';
  }
}

function setLocalClaudeKey(key) {
  try { localStorage.setItem(LS_CLAUDE_KEY, key); } catch { /* ignore */ }
}

function clearLocalClaudeKey() {
  try { localStorage.removeItem(LS_CLAUDE_KEY); } catch { /* ignore */ }
  window.AIRING_CLAUDE_KEY = '';
}

function getLocalOllamaModel() {
  try {
    return localStorage.getItem(LS_OLLAMA_MODEL) || window.AIRING_OLLAMA_MODEL || '';
  } catch {
    return window.AIRING_OLLAMA_MODEL || '';
  }
}

function setLocalOllamaModel(model) {
  try { localStorage.setItem(LS_OLLAMA_MODEL, model); } catch { /* ignore */ }
}

function clearLocalOllamaModel() {
  try { localStorage.removeItem(LS_OLLAMA_MODEL); } catch { /* ignore */ }
  window.AIRING_OLLAMA_MODEL = '';
}

function getLocalOllamaUrl() {
  try {
    return localStorage.getItem(LS_OLLAMA_URL) || '';
  } catch {
    return '';
  }
}

function setLocalOllamaUrl(url) {
  try { localStorage.setItem(LS_OLLAMA_URL, url); } catch { /* ignore */ }
}

function clearLocalOllamaUrl() {
  try { localStorage.removeItem(LS_OLLAMA_URL); } catch { /* ignore */ }
}

function getLocalOpenAIKey() {
  try {
    return localStorage.getItem(LS_OPENAI_KEY) || window.AIRING_OPENAI_KEY || '';
  } catch {
    return window.AIRING_OPENAI_KEY || '';
  }
}

function setLocalOpenAIKey(key) {
  try { localStorage.setItem(LS_OPENAI_KEY, key); } catch { /* ignore */ }
}

function clearLocalOpenAIKey() {
  try { localStorage.removeItem(LS_OPENAI_KEY); } catch { /* ignore */ }
  window.AIRING_OPENAI_KEY = '';
}

function getLocalMistralKey() {
  try {
    return localStorage.getItem(LS_MISTRAL_KEY) || window.AIRING_MISTRAL_KEY || '';
  } catch {
    return window.AIRING_MISTRAL_KEY || '';
  }
}

function setLocalMistralKey(key) {
  try { localStorage.setItem(LS_MISTRAL_KEY, key); } catch { /* ignore */ }
}

function clearLocalMistralKey() {
  try { localStorage.removeItem(LS_MISTRAL_KEY); } catch { /* ignore */ }
  window.AIRING_MISTRAL_KEY = '';
}

function getLocalCopilotKey() {
  try {
    return localStorage.getItem(LS_COPILOT_KEY) || window.AIRING_COPILOT_KEY || '';
  } catch {
    return window.AIRING_COPILOT_KEY || '';
  }
}

function setLocalCopilotKey(key) {
  try { localStorage.setItem(LS_COPILOT_KEY, key); } catch { /* ignore */ }
}

function clearLocalCopilotKey() {
  try { localStorage.removeItem(LS_COPILOT_KEY); } catch { /* ignore */ }
  window.AIRING_COPILOT_KEY = '';
}

// Clear the stored key for a given model id and reset its settings input.
function clearModelKey(modelId) {
  const actions = {
    gemini:   () => { clearLocalGeminiKey();   if (geminiKeyInput)   geminiKeyInput.value   = ''; },
    grok:     () => { clearLocalGrokKey();     if (grokKeyInput)     grokKeyInput.value     = ''; },
    claude:   () => { clearLocalClaudeKey();   if (claudeKeyInput)   claudeKeyInput.value   = ''; },
    ollama: () => { clearLocalOllamaModel(); clearLocalOllamaUrl(); if (ollamaModelInput) ollamaModelInput.value = ''; if (ollamaUrlInput) ollamaUrlInput.value = ''; },
    gpt4:     () => { clearLocalOpenAIKey();   if (openaiKeyInput)   openaiKeyInput.value   = ''; },
    mistral:  () => { clearLocalMistralKey();  if (mistralKeyInput)  mistralKeyInput.value  = ''; },
    copilot:  () => { clearLocalCopilotKey();  if (copilotKeyInput)  copilotKeyInput.value  = ''; },
  };
  if (actions[modelId]) actions[modelId]();
}

async function callGeminiDirect(prompt, key) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error?.message || res.statusText;
    throw new Error(`Gemini API error: ${msg}`);
  }
  const data = await res.json();
  if (!data.candidates?.length || !data.candidates[0]?.content?.parts?.length) throw new Error('Gemini returned no content');
  const parts = data.candidates[0].content.parts;
  const textPart = parts.find((p) => !p.thought) || parts[0];
  if (!textPart?.text) throw new Error('Gemini returned no text part');
  return textPart.text.trim();
}

async function callGrokProxy(prompt, key) {
  // Route the xAI call through the backend to avoid browser CORS restrictions on api.x.ai.
  // The backend /api/grok-proxy endpoint accepts the user's key in the request body and
  // forwards the call server-side (CORS-free), then returns { text }.
  const res = await fetch(`${API_BASE}/api/grok-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, key }),
  });
  // Parse JSON only after confirming the server returned a JSON response.
  // A non-2xx response from a reverse proxy or static host returns HTML, which
  // would cause "Unexpected token '<'" if parsed unconditionally.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    throw new Error(`Grok proxy error: ${msg}`);
  }
  const data = await res.json();
  return data.text;
}

async function callOllamaProxy(prompt, model) {
  // Route the Ollama call through the backend to avoid browser CORS restrictions.
  // The backend /api/ollama-proxy endpoint accepts the model name and optional base
  // URL in the request body, forwards the call server-side (CORS-free), and returns { text }.
  const url = getLocalOllamaUrl();
  const body = { prompt, key: model };
  if (url) body.url = url;
  const res = await fetch(`${API_BASE}/api/ollama-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    throw new Error(`Ollama proxy error: ${msg}`);
  }
  const data = await res.json();
  return data.text;
}

async function callClaudeDirect(prompt, key) {
  // Anthropic Claude — called directly from the browser using the messages API
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  // Parse JSON only after confirming the server returned a JSON response.
  // A non-2xx response from a WAF or rate-limiter may return HTML, which would
  // cause "Unexpected token '<'" if parsed unconditionally.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error?.message || res.statusText;
    throw new Error(`Claude API error: ${msg}`);
  }
  const data = await res.json();
  if (!data.content?.length || !data.content[0]?.text) throw new Error('Claude returned no content');
  return data.content[0].text.trim();
}

async function callOpenAIDirect(prompt, key) {
  // OpenAI chat completions API — called directly from the browser.
  // OpenAI's API supports browser CORS; keep this in mind regarding key exposure.
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error?.message || res.statusText;
    throw new Error(`OpenAI API error: ${msg}`);
  }
  const data = await res.json();
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('OpenAI returned no content');
  return data.choices[0].message.content.trim();
}

async function callOpenAIProxy(prompt, key) {
  // Route the OpenAI call through the backend proxy (used when a backend is available
  // and the user's personal key needs to be forwarded server-side).
  const res = await fetch(`${API_BASE}/api/openai-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, key }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    throw new Error(`OpenAI proxy error: ${msg}`);
  }
  const data = await res.json();
  return data.text;
}

async function callMistralProxy(prompt, key) {
  // Route the Mistral call through the backend to avoid browser CORS restrictions on api.mistral.ai.
  const res = await fetch(`${API_BASE}/api/mistral-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, key }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    throw new Error(`Mistral proxy error: ${msg}`);
  }
  const data = await res.json();
  return data.text;
}

async function callCopilotProxy(prompt, key) {
  // Route the GitHub Copilot call through the backend to avoid browser CORS restrictions.
  const res = await fetch(`${API_BASE}/api/copilot-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, key }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    throw new Error(`Copilot proxy error: ${msg}`);
  }
  const data = await res.json();
  return data.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side demo engine (mirrors server.js — used when no backend is present)
// ─────────────────────────────────────────────────────────────────────────────
const AI_MODELS_DATA = [
  { id: 'gpt4',     name: 'GPT-4',    character: 'Cloud',    color: '#4888d8', emoji: '⚔️',  strengths: ['reasoning', 'coding', 'analysis', 'general'] },
  { id: 'claude',   name: 'Claude',   character: 'Barret',   color: '#d84020', emoji: '🔫',  strengths: ['writing', 'analysis', 'safety', 'nuance'] },
  { id: 'gemini',   name: 'Gemini',   character: 'Red XIII', color: '#e04010', emoji: '🔥',  strengths: ['multimodal', 'search', 'factual', 'math'] },
  { id: 'mistral',  name: 'Mistral',  character: 'Cid',      color: '#20a8c0', emoji: '✈️',  strengths: ['coding', 'efficiency', 'multilingual', 'speed'] },
  { id: 'copilot',  name: 'Copilot',  character: 'Tifa',     color: '#e03860', emoji: '👊',  strengths: ['coding', 'autocomplete', 'refactoring', 'debugging'] },
  { id: 'grok',     name: 'Grok',     character: 'Vincent',  color: '#7030c8', emoji: '🦇',  strengths: ['reasoning', 'speed', 'creative', 'search'] },
  { id: 'ollama',   name: 'Ollama',   character: 'Yuffie',   color: '#0a84c8', emoji: '🌊',  strengths: ['reasoning', 'coding', 'math', 'efficiency'] },
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
  grok: [
    "Cutting straight to {topic}: the answer is simpler than most pretend. Strip the noise, follow first principles, and you get a clean solution. My reasoning chain is short but airtight — here's what actually matters.",
    "On {topic} — interesting problem. Most AI would hedge, but I'll tell you directly: the key insight is counterintuitive. The conventional wisdom here is wrong in at least two ways, and here's why the unconventional approach wins.",
    "Real-time analysis of {topic}: speed and clarity over verbosity. The creative angle nobody mentions is: what if the premise itself needs rethinking? My search-augmented reasoning surfaces a perspective that reframes the entire question.",
  ],
  ollama: [
    "Deeply analyzing {topic}: reasoning from first principles reveals a clear, efficient path forward. My chain-of-thought process identifies the key variables, eliminates noise, and surfaces the optimal solution — elegant in its simplicity.",
    "On {topic}, open-source reasoning engaged. The mathematical structure here is tractable: decompose into sub-problems, apply learned patterns, and synthesize with confidence. Here is the distilled, high-quality answer.",
    "Addressing {topic} with deep precision: the underlying logic is sound, the approach is transparent, and the answer is reproducible. Open knowledge deserves an open, verifiable response — so here it is, step by step.",
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
  const geminiKey   = getLocalGeminiKey();
  const grokKey     = getLocalGrokKey();
  const claudeKey   = getLocalClaudeKey();
  const ollamaModel = getLocalOllamaModel();
  const openaiKey   = getLocalOpenAIKey();
  const mistralKey  = getLocalMistralKey();
  const copilotKey  = getLocalCopilotKey();
  const results = await Promise.all(
    AI_MODELS_DATA.map(async (model) => {
      const start = Date.now();
      let text = null;
      let isDemo = true;
      try {
        if (model.id === 'gemini' && geminiKey) {
          text = await callGeminiDirect(prompt, geminiKey);
          isDemo = false;
        } else if (model.id === 'grok' && grokKey && backendAvailable) {
          // Grok requires the backend proxy (x.ai blocks browser CORS).
          // Skip on static/GitHub Pages hosting where backendAvailable is false.
          text = await callGrokProxy(prompt, grokKey);
          isDemo = false;
        } else if (model.id === 'grok' && grokKey && !backendAvailable) {
          // User has a Grok key but there is no backend to proxy through — show a
          // one-time hint so the user understands why Grok stays in demo mode.
          if (settingsStatus) {
            settingsStatus.textContent = '⚠ Grok key saved but no backend available — Grok requires the Node.js server to proxy requests (x.ai blocks browser CORS). Run the server locally or deploy it to go LIVE.';
            settingsStatus.className = 'settings-status err';
            settingsPanel.classList.remove('hidden');
          }
        } else if (model.id === 'claude' && claudeKey) {
          text = await callClaudeDirect(prompt, claudeKey);
          isDemo = false;
        } else if (model.id === 'ollama' && ollamaModel && backendAvailable) {
          // Ollama requires the backend proxy (local instance blocks browser CORS).
          text = await callOllamaProxy(prompt, ollamaModel);
          isDemo = false;
        } else if (model.id === 'ollama' && ollamaModel && !backendAvailable) {
          if (settingsStatus) {
            settingsStatus.textContent = '⚠ Ollama model saved but no backend available — Ollama requires the Node.js server to proxy requests. Run the server locally or deploy it to go LIVE.';
            settingsStatus.className = 'settings-status err';
            settingsPanel.classList.remove('hidden');
          }
        } else if (model.id === 'gpt4' && openaiKey) {
          // OpenAI supports browser CORS — call directly like Gemini and Claude.
          text = await callOpenAIDirect(prompt, openaiKey);
          isDemo = false;
        } else if (model.id === 'mistral' && mistralKey && backendAvailable) {
          text = await callMistralProxy(prompt, mistralKey);
          isDemo = false;
        } else if (model.id === 'mistral' && mistralKey && !backendAvailable) {
          if (settingsStatus) {
            settingsStatus.textContent = '⚠ Mistral key saved but no backend available — Mistral requires the Node.js server to proxy requests. Run the server locally or deploy it to go LIVE.';
            settingsStatus.className = 'settings-status err';
            settingsPanel.classList.remove('hidden');
          }
        } else if (model.id === 'copilot' && copilotKey && backendAvailable) {
          text = await callCopilotProxy(prompt, copilotKey);
          isDemo = false;
        } else if (model.id === 'copilot' && copilotKey && !backendAvailable) {
          if (settingsStatus) {
            settingsStatus.textContent = '⚠ Copilot token saved but no backend available — Copilot requires the Node.js server to proxy requests. Run the server locally or deploy it to go LIVE.';
            settingsStatus.className = 'settings-status err';
            settingsPanel.classList.remove('hidden');
          }
        }
      } catch (err) {
        text = null;
        // Surface a clear error with a hint to remove the bad key
        if (settingsStatus) {
          settingsStatus.textContent = `✗ ${model.name} live call failed: ${err.message}${liveCallHint(err.message)}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
          // Only auto-clear keys that are confirmed invalid/revoked. Credit/quota errors mean
          // the key itself is valid — preserve it so the model stays LIVE once the account is
          // topped up. For transient errors (network, timeout) the key is also kept.
          if (isInvalidKeyError(err.message)) {
            clearModelKey(model.id);
            checkServerMode();
          }
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
// Room analysis — each model sees what the others said and refines its answer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask each live model to review the other models' initial responses and deliver
 * its best answer. Falls back to the backend proxy when available, otherwise
 * calls each model directly (mirrors the hybrid path).
 */
async function runRoomAnalysis(prompt, initialData) {
  const initialResults = initialData.results;

  if (backendAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/room-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, results: initialResults, wallet: connectedWallet || undefined }),
      });
      if (res.ok) return await res.json();
    } catch (_) {
      // fall through to local path
    }
  }

  // Local / hybrid path: call each model with the analysis prompt directly
  const geminiKey   = getLocalGeminiKey();
  const grokKey     = getLocalGrokKey();
  const claudeKey   = getLocalClaudeKey();
  const ollamaModel = getLocalOllamaModel();
  const openaiKey   = getLocalOpenAIKey();
  const mistralKey  = getLocalMistralKey();
  const copilotKey  = getLocalCopilotKey();

  function buildAnalysisPrompt(model) {
    const others = initialResults.filter((r) => r.modelId !== model.id);
    const othersText = others.map((r) => `[${r.name}]: ${r.response}`).join('\n\n');
    return (
      `You are competing in the AI Ring arena. The original question was:\n"${prompt}"\n\n` +
      `Here is what the other AI models in the room answered:\n\n${othersText}\n\n` +
      `You are ${model.name}. Having reviewed the other models' responses, ` +
      `identify what is missing or could be improved, then provide your definitive best answer ` +
      `to the original question.`
    );
  }

  const results = await Promise.all(
    AI_MODELS_DATA.map(async (model) => {
      const start = Date.now();
      const analysisPrompt = buildAnalysisPrompt(model);
      let text = null;
      let isDemo = true;
      try {
        if (model.id === 'gemini' && geminiKey) {
          text = await callGeminiDirect(analysisPrompt, geminiKey);
          isDemo = false;
        } else if (model.id === 'grok' && grokKey && backendAvailable) {
          text = await callGrokProxy(analysisPrompt, grokKey);
          isDemo = false;
        } else if (model.id === 'claude' && claudeKey) {
          text = await callClaudeDirect(analysisPrompt, claudeKey);
          isDemo = false;
        } else if (model.id === 'ollama' && ollamaModel && backendAvailable) {
          text = await callOllamaProxy(analysisPrompt, ollamaModel);
          isDemo = false;
        } else if (model.id === 'gpt4' && openaiKey) {
          text = await callOpenAIDirect(analysisPrompt, openaiKey);
          isDemo = false;
        } else if (model.id === 'mistral' && mistralKey && backendAvailable) {
          text = await callMistralProxy(analysisPrompt, mistralKey);
          isDemo = false;
        } else if (model.id === 'copilot' && copilotKey && backendAvailable) {
          text = await callCopilotProxy(analysisPrompt, copilotKey);
          isDemo = false;
        }
      } catch (_) {
        text = null;
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
// Archive — persist the best answer across sessions (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

const LS_ARCHIVE = 'airing_archive';
const ARCHIVE_MAX = 20;

function loadArchive() {
  try {
    return JSON.parse(localStorage.getItem(LS_ARCHIVE) || '[]');
  } catch (_) {
    return [];
  }
}

function archiveBestAnswer(matchData) {
  const winner = matchData.results.find((r) => r.isWinner);
  if (!winner) return;
  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    prompt:    matchData.prompt,
    winner: {
      modelId:  winner.modelId,
      name:     winner.name,
      emoji:    winner.emoji,
      response: winner.response,
      score:    winner.score,
    },
  };
  const archive = loadArchive();
  archive.unshift(entry);
  if (archive.length > ARCHIVE_MAX) archive.length = ARCHIVE_MAX;
  try {
    localStorage.setItem(LS_ARCHIVE, JSON.stringify(archive));
  } catch (_) {
    // storage full — skip silently
  }
  renderArchive();
}

function renderArchive() {
  const archiveList = document.getElementById('archive-list');
  if (!archiveList) return;
  const archive = loadArchive();
  if (archive.length === 0) {
    archiveList.innerHTML = '<p class="history-empty">No archived answers yet.</p>';
    return;
  }
  archiveList.innerHTML = '';
  archive.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item archive-item';
    const date = new Date(entry.timestamp).toLocaleDateString();
    item.innerHTML =
      `<span class="history-prompt">${escapeHtml(entry.prompt)}</span>` +
      `<span class="history-winner">${entry.winner.emoji || ''} ${escapeHtml(entry.winner.name)} ★${entry.winner.score}</span>`;
    item.title = `${date} — Score: ${entry.winner.score}`;
    item.addEventListener('click', () => {
      winnerName.textContent = `${entry.winner.emoji || ''} ${entry.winner.name}`;
      winnerResponse.textContent = entry.winner.response;
      winnerPanel.classList.remove('hidden');
    });
    archiveList.appendChild(item);
  });
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
const geminiSaveBtn   = document.getElementById('gemini-save-btn');
const geminiClearBtn  = document.getElementById('gemini-clear-btn');
const grokKeyInput    = document.getElementById('grok-key-input');
const grokSaveBtn     = document.getElementById('grok-save-btn');
const grokClearBtn    = document.getElementById('grok-clear-btn');
const claudeKeyInput  = document.getElementById('claude-key-input');
const claudeSaveBtn   = document.getElementById('claude-save-btn');
const claudeClearBtn  = document.getElementById('claude-clear-btn');
const ollamaModelInput = document.getElementById('ollama-model-input');
const ollamaSaveBtn    = document.getElementById('ollama-save-btn');
const ollamaClearBtn   = document.getElementById('ollama-clear-btn');
const ollamaUrlInput   = document.getElementById('ollama-url-input');
const ollamaUrlSaveBtn = document.getElementById('ollama-url-save-btn');
const ollamaUrlClearBtn = document.getElementById('ollama-url-clear-btn');
const openaiKeyInput  = document.getElementById('openai-key-input');
const openaiSaveBtn   = document.getElementById('openai-save-btn');
const openaiClearBtn  = document.getElementById('openai-clear-btn');
const mistralKeyInput = document.getElementById('mistral-key-input');
const mistralSaveBtn  = document.getElementById('mistral-save-btn');
const mistralClearBtn = document.getElementById('mistral-clear-btn');
const copilotKeyInput = document.getElementById('copilot-key-input');
const copilotSaveBtn  = document.getElementById('copilot-save-btn');
const copilotClearBtn = document.getElementById('copilot-clear-btn');
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
    const serverMsgs = [];
    if (backendGeminiConfigured)   { geminiKeyInput.value   = ''; serverMsgs.push('Gemini');   }
    if (backendGrokConfigured)     { grokKeyInput.value     = ''; serverMsgs.push('Grok');     }
    if (backendClaudeConfigured)   { claudeKeyInput.value   = ''; serverMsgs.push('Claude');   }
    if (backendOllamaConfigured)   { ollamaModelInput.value = ''; serverMsgs.push('Ollama');    }
    if (backendGpt4Configured)     { openaiKeyInput.value   = ''; serverMsgs.push('GPT-4');    }
    if (backendMistralConfigured)  { mistralKeyInput.value  = ''; serverMsgs.push('Mistral');  }
    if (backendCopilotConfigured)  { copilotKeyInput.value  = ''; serverMsgs.push('Copilot');  }

    if (serverMsgs.length > 0) {
      settingsStatus.textContent = `✔ ${serverMsgs.join(', ')} key(s) active via server (.env)`;
      settingsStatus.className = 'settings-status ok';
    } else {
      const stored = getLocalGeminiKey();
      geminiKeyInput.value = stored;
      const grokStored = getLocalGrokKey();
      grokKeyInput.value = grokStored;
      const claudeStored = getLocalClaudeKey();
      claudeKeyInput.value = claudeStored;
      const ollamaStored = getLocalOllamaModel();
      ollamaModelInput.value = ollamaStored;
      const ollamaUrlStored = getLocalOllamaUrl();
      ollamaUrlInput.value = ollamaUrlStored;
      const openaiStored = getLocalOpenAIKey();
      openaiKeyInput.value = openaiStored;
      const mistralStored = getLocalMistralKey();
      mistralKeyInput.value = mistralStored;
      const copilotStored = getLocalCopilotKey();
      copilotKeyInput.value = copilotStored;
      if (stored || grokStored || claudeStored || ollamaStored || openaiStored || mistralStored || copilotStored) {
        settingsStatus.textContent = '● Key(s) loaded from local storage';
        settingsStatus.className = 'settings-status ok';
      } else {
        settingsStatus.textContent = '';
      }
    }
  }
});

geminiSaveBtn.addEventListener('click', () => {
  const key = geminiKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a Gemini key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalGeminiKey(key);
  settingsStatus.textContent = '✔ Gemini key saved! Gemini will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

geminiClearBtn.addEventListener('click', () => {
  clearLocalGeminiKey();
  geminiKeyInput.value = '';
  settingsStatus.textContent = '✔ Gemini key cleared. Gemini will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

grokSaveBtn.addEventListener('click', () => {
  const key = grokKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a Grok key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalGrokKey(key);
  settingsStatus.textContent = '✔ Grok key saved! Grok will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

grokClearBtn.addEventListener('click', () => {
  clearLocalGrokKey();
  grokKeyInput.value = '';
  settingsStatus.textContent = '✔ Grok key cleared. Grok will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

claudeSaveBtn.addEventListener('click', () => {
  const key = claudeKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a Claude key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalClaudeKey(key);
  settingsStatus.textContent = '✔ Claude key saved! Claude will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

claudeClearBtn.addEventListener('click', () => {
  clearLocalClaudeKey();
  claudeKeyInput.value = '';
  settingsStatus.textContent = '✔ Claude key cleared. Claude will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

ollamaSaveBtn.addEventListener('click', () => {
  const model = ollamaModelInput.value.trim();
  if (!model) {
    settingsStatus.textContent = '✗ Please enter an Ollama model name first (e.g. llama3.2).';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalOllamaModel(model);
  settingsStatus.textContent = '✔ Ollama model saved! Ollama will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

ollamaClearBtn.addEventListener('click', () => {
  clearLocalOllamaModel();
  ollamaModelInput.value = '';
  settingsStatus.textContent = '✔ Ollama model cleared. Ollama will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

ollamaUrlSaveBtn.addEventListener('click', () => {
  const url = ollamaUrlInput.value.trim();
  if (!url) {
    settingsStatus.textContent = '✗ Please enter an Ollama base URL first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    settingsStatus.textContent = '✗ Invalid URL — must start with https:// (for http, set OLLAMA_BASE_URL on the server)';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalOllamaUrl(url);
  settingsStatus.textContent = '✔ Ollama base URL saved!';
  settingsStatus.className = 'settings-status ok';
});

ollamaUrlClearBtn.addEventListener('click', () => {
  clearLocalOllamaUrl();
  ollamaUrlInput.value = '';
  settingsStatus.textContent = '✔ Ollama base URL cleared. Backend default will be used.';
  settingsStatus.className = 'settings-status ok';
});

openaiSaveBtn.addEventListener('click', () => {
  const key = openaiKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter an OpenAI key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalOpenAIKey(key);
  settingsStatus.textContent = '✔ OpenAI key saved! GPT-4 will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

openaiClearBtn.addEventListener('click', () => {
  clearLocalOpenAIKey();
  openaiKeyInput.value = '';
  settingsStatus.textContent = '✔ OpenAI key cleared. GPT-4 will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

mistralSaveBtn.addEventListener('click', () => {
  const key = mistralKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a Mistral key first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalMistralKey(key);
  settingsStatus.textContent = '✔ Mistral key saved! Mistral will run LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

mistralClearBtn.addEventListener('click', () => {
  clearLocalMistralKey();
  mistralKeyInput.value = '';
  settingsStatus.textContent = '✔ Mistral key cleared. Mistral will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

copilotSaveBtn.addEventListener('click', () => {
  const key = copilotKeyInput.value.trim();
  if (!key) {
    settingsStatus.textContent = '✗ Please enter a GitHub token first.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  if (!key.startsWith('ghp_') && !key.startsWith('github_pat_') && !key.startsWith('ghs_')) {
    settingsStatus.textContent = '✗ GitHub token must start with ghp_, github_pat_, or ghs_. Generate one at github.com/settings/tokens with models:read permission.';
    settingsStatus.className = 'settings-status err';
    return;
  }
  setLocalCopilotKey(key);
  settingsStatus.textContent = backendAvailable
    ? '✔ GitHub token saved! Copilot will run LIVE.'
    : '✔ GitHub token saved! Copilot requires the Node.js backend — set BACKEND_URL to go LIVE.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

copilotClearBtn.addEventListener('click', () => {
  clearLocalCopilotKey();
  copilotKeyInput.value = '';
  settingsStatus.textContent = '✔ GitHub token cleared. Copilot will run in DEMO mode.';
  settingsStatus.className = 'settings-status ok';
  checkServerMode();
});

const MODEL_IDS = ['gpt4', 'claude', 'gemini', 'mistral', 'copilot', 'grok', 'ollama'];

// Home positions — populated at runtime by initTeams() for a random split
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

// Floor slots for the 4-member side (left or right)
const SLOTS_4 = [
  { left: '26%', right: '',     top: '56%', bottom: '',    depth: 'far'  },
  { left: '8%',  right: '',     top: '56%', bottom: '',    depth: 'far'  },
  { left: '1%',  right: '',     top: '',    bottom: '26%', depth: 'mid'  },
  { left: '14%', right: '',     top: '',    bottom: '3%',  depth: 'near' },
];
const SLOTS_4_R = [
  { left: '',    right: '26%',  top: '56%', bottom: '',    depth: 'far'  },
  { left: '',    right: '8%',   top: '56%', bottom: '',    depth: 'far'  },
  { left: '',    right: '1%',   top: '',    bottom: '26%', depth: 'mid'  },
  { left: '',    right: '14%',  top: '',    bottom: '3%',  depth: 'near' },
];

// Assign characters to random split floor slots and update their DOM state
function initTeams() {
  const shuffled = shuffleArray(MODEL_IDS);
  const total = MODEL_IDS.length; // 7
  const leftCount = Math.random() < 0.5 ? 3 : 4;
  const rightCount = total - leftCount;

  const leftIds  = shuffled.slice(0, leftCount);
  const rightIds = shuffled.slice(leftCount);

  const SLOT_MAP = { 2: SLOTS_2, 3: SLOTS_3, 4: SLOTS_4 };
  const SLOT_MAP_R = { 2: SLOTS_2_R, 3: SLOTS_3_R, 4: SLOTS_4_R };
  const leftSlots  = SLOT_MAP[leftCount];
  const rightSlots = SLOT_MAP_R[rightCount];

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
  gpt4:     { left: '22%',  right: '',     top: '54%',    bottom: '' },
  claude:   { left: '',     right: '22%',  top: '54%',    bottom: '' },
  gemini:   { left: '22%',  right: '',     top: '',       bottom: '22%' },
  mistral:  { left: '',     right: '22%',  top: '',       bottom: '22%' },
  copilot:  { left: '37%',  right: '',     top: '',       bottom: '22%' },
  grok:     { left: '37%',  right: '',     top: '54%',    bottom: '' },
  ollama:   { left: '',     right: '37%',  top: '',       bottom: '22%' },
};

// Approximate pixel-center of each character when converged (% of room)
// All positions are on the floor (y > 52 ensures below the horizon)
const BATTLE_POS = {
  gpt4:     { x: 28, y: 56 },
  claude:   { x: 72, y: 56 },
  gemini:   { x: 28, y: 66 },
  mistral:  { x: 72, y: 66 },
  copilot:  { x: 43, y: 70 },
  grok:     { x: 43, y: 56 },
  ollama:   { x: 57, y: 70 },
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
let backendGeminiConfigured   = false;  // true when GOOGLE_API_KEY is set in server .env
let backendGrokConfigured     = false;  // true when XAI_API_KEY is set in server .env
let backendClaudeConfigured   = false;  // true when ANTHROPIC_API_KEY is set in server .env
let backendOllamaConfigured   = false;  // true when OLLAMA_MODEL or OLLAMA_BASE_URL is set in server .env
let backendGpt4Configured     = false;  // true when OPENAI_API_KEY is set in server .env
let backendMistralConfigured  = false;  // true when MISTRAL_API_KEY is set in server .env
let backendCopilotConfigured  = false;  // true when GITHUB_TOKEN is set in server .env

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

// Update a single model's badge without touching the others
function setModelBadge(modelId, isLive) {
  const wrapper = getAgentEl(modelId);
  if (!wrapper) return;
  const existing = wrapper.querySelector('.api-status-badge');
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.className = `api-status-badge ${isLive ? 'api-live' : 'api-demo'}`;
  badge.textContent = isLive ? '● LIVE' : '○ DEMO';
  wrapper.appendChild(badge);
}

async function checkServerMode() {
  // Shared fallback used when no backend is reachable (static / GitHub Pages).
  function applyLocalOnly() {
    backendGeminiConfigured   = false;
    backendGrokConfigured     = false;
    backendClaudeConfigured   = false;
    backendOllamaConfigured   = false;
    backendGpt4Configured     = false;
    backendMistralConfigured  = false;
    backendCopilotConfigured  = false;
    const geminiKey   = getLocalGeminiKey();
    const claudeKey   = getLocalClaudeKey();
    const openaiKey   = getLocalOpenAIKey();
    const localConfigured = {
      // Gemini, Claude, and OpenAI support direct browser calls; show them as live if a key is stored.
      claude: !!claudeKey, gemini: !!geminiKey, gpt4: !!openaiKey,
      // All other models require the backend proxy; without a backend they cannot
      // run live even if a key is present, so keep them as DEMO.
      mistral: false, copilot: false, grok: false, ollama: false,
    };
    const anyLive = Object.values(localConfigured).some(Boolean);
    demoBadge.classList.toggle('hidden', anyLive);
    applyModelStatus(localConfigured);
    // Auto-open settings panel once per session when no keys that work on static hosting
    // are present, so users know exactly how to activate live mode.
    if (!geminiKey && !claudeKey && !openaiKey && !sessionStorage.getItem('airing_settings_shown')) {
      sessionStorage.setItem('airing_settings_shown', '1');
      settingsPanel.classList.remove('hidden');
      // If backend-only keys were injected at deploy time (COPILOT_API_KEY, GROK_API_KEY, or
      // MISTRAL_API_KEY set in GitHub Secrets) but BACKEND_URL was not set, surface a targeted
      // hint so the deployer understands why those models stay in DEMO mode.
      const backendKeyInjected = !!(window.AIRING_COPILOT_KEY || window.AIRING_GROK_KEY || window.AIRING_MISTRAL_KEY);
      if (backendKeyInjected) {
        settingsStatus.textContent = '⚠ API key configured but no backend available — Copilot, Grok, and Mistral require the Node.js backend. Set the BACKEND_URL secret and redeploy to go LIVE.';
        settingsStatus.className = 'settings-status err';
      } else {
        settingsStatus.textContent = '⚡ Paste your Gemini, Claude, or OpenAI key and hit SAVE to go LIVE! (Grok, Mistral, Copilot, and Ollama require the Node.js backend.)';
        settingsStatus.className = 'settings-status info';
      }
    }
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
    backendGeminiConfigured   = !!(data.configured && data.configured.gemini);
    backendGrokConfigured     = !!(data.configured && data.configured.grok);
    backendClaudeConfigured   = !!(data.configured && data.configured.claude);
    backendOllamaConfigured   = !!(data.configured && data.configured.ollama);
    backendGpt4Configured     = !!(data.configured && data.configured.gpt4);
    backendMistralConfigured  = !!(data.configured && data.configured.mistral);
    backendCopilotConfigured  = !!(data.configured && data.configured.copilot);
    // Merge server-configured status with any locally-stored keys
    const configured = data.configured || {};
    if (!configured.gemini   && getLocalGeminiKey())   configured.gemini   = true;
    if (!configured.grok     && getLocalGrokKey())     configured.grok     = true;
    if (!configured.claude   && getLocalClaudeKey())   configured.claude   = true;
    if (!configured.ollama   && getLocalOllamaModel()) configured.ollama   = true;
    if (!configured.gpt4     && getLocalOpenAIKey())   configured.gpt4     = true;
    if (!configured.mistral  && getLocalMistralKey())  configured.mistral  = true;
    if (!configured.copilot  && getLocalCopilotKey())  configured.copilot  = true;
    const anyLive = Object.values(configured).some(Boolean);
    demoBadge.classList.toggle('hidden', anyLive);
    applyModelStatus(configured);
  } catch (_) {
    // Network error / no backend (static hosting / GitHub Pages)
    applyLocalOnly();
  }
}

checkServerMode();
renderArchive();

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
  el.className = 'room-flash';
  room.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

let battleActive    = false;
let battleLoopId    = null;

async function fireBattleRound() {
  // Pick a random attacker and a different random defender
  const order     = shuffleArray(MODEL_IDS);
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
  gpt4:     'Not interested.',
  claude:   'Yo! AVALANCHE!',
  gemini:   'Nanaki, ready.',
  mistral:  '#$%@! Let\'s go!',
  copilot:  'For the Planet!',
  grok:     "Hmph. Let's get this over with.",
  ollama:   'Gimme all your Materia!',
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
// Win narrative
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compose a short FF7-flavoured narrative explaining why the winner won.
 * Works purely from the aggregated match data — no extra API calls needed.
 */
function generateWinNarrative(data) {
  const { results, prompt, totalRounds } = data;
  const sorted    = [...results].sort((a, b) => b.score - a.score);
  const winner    = sorted[0];
  const runnerUp  = sorted[1];

  if (!winner) return '';

  const lines = [];

  // ── Opening: who won? ───────────────────────────────────────────────────────
  const character = AI_MODELS_DATA.find((m) => m.id === winner.modelId)?.character || winner.name;
  lines.push(`${winner.emoji} ${character} (${winner.name}) claimed victory in the arena.`);

  // ── Score margin ────────────────────────────────────────────────────────────
  if (runnerUp) {
    const margin = winner.score - runnerUp.score;
    if (margin === 0) {
      lines.push(`A razor-thin tie on points — the tiebreaker round decided the outcome.`);
    } else if (margin <= 5) {
      lines.push(`A narrow ${margin}-point edge over ${runnerUp.name} sealed the match.`);
    } else if (margin <= 20) {
      lines.push(`${winner.name} pulled ahead by ${margin} points, outclassing ${runnerUp.name} in the process.`);
    } else {
      lines.push(`${winner.name} dominated with a ${margin}-point lead over ${runnerUp.name} — an overwhelming victory.`);
    }
  }

  // ── Response quality signals ─────────────────────────────────────────────
  const resp      = winner.response || '';
  const hasLists  = /\d+[.)]\s/.test(resp);
  const hasSections = (resp.match(/\n/g) || []).length >= 2;
  const hasColons = resp.includes(':');
  const wordCount = resp.split(/\s+/).filter(Boolean).length;

  const factors = [];
  if (wordCount > 200)  factors.push('a thorough, detailed response');
  else if (wordCount > 80) factors.push('a concise but complete answer');
  else                  factors.push('a focused reply');
  if (hasLists)         factors.push('numbered structure');
  if (hasSections)      factors.push('well-organised paragraphs');
  if (hasColons)        factors.push('clear key-value formatting');

  // Keyword relevance check (mirrors server-side scoring heuristic)
  const MIN_KEYWORD_LENGTH = 3;  // minimum word length to count as a scored keyword
  const promptWords = new Set(
    prompt.toLowerCase().split(/\W+/).filter((w) => w.length > MIN_KEYWORD_LENGTH),
  );
  const respWords   = resp.toLowerCase().split(/\W+/);
  const kwHits      = respWords.filter((w) => promptWords.has(w)).length;
  if (kwHits >= 5)  factors.push('strong on-topic keyword coverage');
  else if (kwHits >= 2) factors.push('solid keyword relevance');

  if (factors.length) {
    lines.push(`Victory was built on: ${factors.join(', ')}.`);
  }

  // ── Speed ────────────────────────────────────────────────────────────────
  if (winner.latencyMs > 0) {
    if (winner.latencyMs < 500) {
      lines.push(`${character} also struck fast — response delivered in just ${winner.latencyMs} ms.`);
    } else if (winner.latencyMs < 2000) {
      lines.push(`Response time was solid at ${winner.latencyMs} ms.`);
    } else {
      lines.push(`The deliberate ${winner.latencyMs} ms response time paid off in depth.`);
    }
  }

  // ── Multi-round performance ──────────────────────────────────────────────
  if (totalRounds && totalRounds > 1 && winner.roundWins !== undefined) {
    const losses = totalRounds - winner.roundWins;
    if (winner.roundWins === totalRounds) {
      lines.push(`A flawless ${totalRounds}-round sweep — ${character} was untouchable today.`);
    } else {
      lines.push(`${character} took ${winner.roundWins} of ${totalRounds} rounds, despite ${losses} ${losses === 1 ? 'loss' : 'losses'}, to claim the title.`);
    }
  }

  // ── Closing flavour ─────────────────────────────────────────────────────
  const closings = [
    `The Limit Break has been activated — ${character} stands supreme.`,
    `Midgar bows to the champion.`,
    `${character}'s Materia burns brightest today.`,
    `Another battle etched into the Quest Log.`,
  ];
  lines.push(closings[Math.floor(Math.random() * closings.length)]);

  return lines.join('\n');
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

  // Win narrative
  const narrativeEl = document.getElementById('win-narrative');
  if (narrativeEl) {
    narrativeEl.textContent = generateWinNarrative(data);
    narrativeEl.classList.remove('hidden');
  }

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

    // Show API error hint when a model fell back to demo due to a live-call failure
    if (r.isDemo && r.error) {
      const errNote = document.createElement('div');
      errNote.className = 'response-card-error';
      errNote.textContent = `⚠ Live call failed: ${r.error}`;
      card.appendChild(errNote);
    }

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
let TOTAL_ROUNDS = 1;

// Wire up rounds selector buttons
document.querySelectorAll('.rounds-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    TOTAL_ROUNDS = Number(btn.dataset.rounds);
    document.querySelectorAll('.rounds-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    resetRoundPips();
  });
});

// Initialise pip visibility for the default round count (TOTAL_ROUNDS = 1)
resetRoundPips();

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
    if (i >= TOTAL_ROUNDS) return;  // hide pips beyond the configured round count
    if (i < completedRounds) pip.classList.add('done');
    else if (i === completedRounds) pip.classList.add('current');
  });
}

function resetRoundPips() {
  roundPips.forEach((pip, i) => {
    pip.classList.remove('done', 'current');
    pip.classList.toggle('hidden', i >= TOTAL_ROUNDS);
  });
}

// Fetch one round of competition results
async function fetchOneRound(prompt) {
  if (backendAvailable) {
    const res = await fetch(`${API_BASE}/api/compete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, wallet: connectedWallet || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();

    // Build wallet context string for fallback proxy calls so every AI model
    // receives the same wallet holdings context that /api/compete injected
    // server-side.  currentPortfolio is populated when the wallet connects.
    let promptWithCtx = prompt;
    if (currentPortfolio) {
      const walletCtx =
        `[ROOM CONTEXT — WALLET HOLDINGS]\n` +
        `SOL: ${currentPortfolio.sol.toFixed(4)}\n` +
        (currentPortfolio.tokens.length
          ? currentPortfolio.tokens.map((t) => `${t.symbol}: ${t.amount}`).join('\n')
          : '(no tracked SPL tokens)') +
        '\n\n';
      promptWithCtx = walletCtx + prompt;
    }

    // If the backend doesn't have XAI_API_KEY but the user saved a personal Grok
    // key, overlay the Grok result via the proxy endpoint (server-side, CORS-free).
    const grokKey = getLocalGrokKey();
    if (grokKey && !backendGrokConfigured) {
      const grokResult = data.results.find((r) => r.modelId === 'grok');
      if (grokResult && grokResult.isDemo) {
        try {
          const proxyStart = Date.now();
          const text = await callGrokProxy(promptWithCtx, grokKey);
          grokResult.response = text;
          grokResult.isDemo = false;
          grokResult.latencyMs = Date.now() - proxyStart;
          const grokModel = AI_MODELS_DATA.find((m) => m.id === 'grok');
          grokResult.score = scoreResponse(prompt, text, grokModel);
          // Re-sort and refresh winner flags
          data.results.sort((a, b) => b.score - a.score);
          const newWinner = data.results[0];
          data.winnerId = newWinner.modelId;
          data.winnerName = newWinner.name;
          data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
        } catch (err) {
          // Proxy call failed — surface the error so the user knows why Grok is in demo mode
          settingsStatus.textContent = `✗ Grok live call failed: ${err.message}${liveCallHint(err.message)}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
          if (isInvalidKeyError(err.message)) { clearModelKey('grok'); checkServerMode(); }
        }
      }
    }

    // If the backend doesn't have ANTHROPIC_API_KEY but the user saved a personal Claude
    // key, call Claude directly from the browser (Anthropic supports CORS with the
    // anthropic-dangerous-direct-browser-access header) and overlay the demo result.
    const claudeKey = getLocalClaudeKey();
    if (claudeKey && !backendClaudeConfigured) {
      const claudeResult = data.results.find((r) => r.modelId === 'claude');
      if (claudeResult && claudeResult.isDemo) {
        try {
          const claudeStart = Date.now();
          const text = await callClaudeDirect(promptWithCtx, claudeKey);
          claudeResult.response = text;
          claudeResult.isDemo = false;
          claudeResult.latencyMs = Date.now() - claudeStart;
          const claudeModel = AI_MODELS_DATA.find((m) => m.id === 'claude');
          claudeResult.score = scoreResponse(prompt, text, claudeModel);
          // Re-sort and refresh winner flags
          data.results.sort((a, b) => b.score - a.score);
          const newWinner = data.results[0];
          data.winnerId = newWinner.modelId;
          data.winnerName = newWinner.name;
          data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
        } catch (err) {
          // Direct call failed — surface the error so the user knows why Claude is in demo mode
          settingsStatus.textContent = `✗ Claude live call failed: ${err.message}${liveCallHint(err.message)}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
          if (isInvalidKeyError(err.message)) { clearModelKey('claude'); checkServerMode(); }
        }
      }
    }

    // If the backend doesn't have OLLAMA_MODEL but the user saved a model name,
    // overlay the Ollama result via the proxy endpoint (server-side, CORS-free).
    const ollamaModel = getLocalOllamaModel();
    if (ollamaModel && !backendOllamaConfigured) {
      const ollamaResult = data.results.find((r) => r.modelId === 'ollama');
      if (ollamaResult && ollamaResult.isDemo) {
        try {
          const ollamaStart = Date.now();
          const text = await callOllamaProxy(promptWithCtx, ollamaModel);
          ollamaResult.response = text;
          ollamaResult.isDemo = false;
          ollamaResult.latencyMs = Date.now() - ollamaStart;
          const ollamaModelData = AI_MODELS_DATA.find((m) => m.id === 'ollama');
          ollamaResult.score = scoreResponse(prompt, text, ollamaModelData);
          // Re-sort and refresh winner flags
          data.results.sort((a, b) => b.score - a.score);
          const newWinner = data.results[0];
          data.winnerId = newWinner.modelId;
          data.winnerName = newWinner.name;
          data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
        } catch (err) {
          settingsStatus.textContent = `✗ Ollama live call failed: ${err.message}${liveCallHint(err.message)}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
          if (isInvalidKeyError(err.message)) { clearModelKey('ollama'); checkServerMode(); }
        }
      }
    }

    // If the backend doesn't have OPENAI_API_KEY (or has one that is failing),
    // and the user saved a personal OpenAI key, overlay the GPT-4 result via
    // the proxy endpoint (server-side, CORS-free).
    const openaiKey = getLocalOpenAIKey();
    const gpt4Result = data.results.find((r) => r.modelId === 'gpt4');
    if (openaiKey && gpt4Result && gpt4Result.isDemo && (!backendGpt4Configured || gpt4Result.error)) {
      try {
        const gpt4Start = Date.now();
        const text = await callOpenAIProxy(promptWithCtx, openaiKey);
        gpt4Result.response = text;
        gpt4Result.isDemo = false;
        gpt4Result.error = null;
        gpt4Result.latencyMs = Date.now() - gpt4Start;
        const gpt4Model = AI_MODELS_DATA.find((m) => m.id === 'gpt4');
        gpt4Result.score = scoreResponse(prompt, text, gpt4Model);
        data.results.sort((a, b) => b.score - a.score);
        const newWinner = data.results[0];
        data.winnerId = newWinner.modelId;
        data.winnerName = newWinner.name;
        data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
      } catch (err) {
        settingsStatus.textContent = `✗ GPT-4 live call failed: ${err.message}${liveCallHint(err.message)}`;
        settingsStatus.className = 'settings-status err';
        settingsPanel.classList.remove('hidden');
        if (isInvalidKeyError(err.message)) { clearModelKey('gpt4'); checkServerMode(); }
      }
    }

    // If the backend doesn't have MISTRAL_API_KEY but the user saved a personal Mistral
    // key, overlay the Mistral result via the proxy endpoint (server-side, CORS-free).
    const mistralKey = getLocalMistralKey();
    if (mistralKey && !backendMistralConfigured) {
      const mistralResult = data.results.find((r) => r.modelId === 'mistral');
      if (mistralResult && mistralResult.isDemo) {
        try {
          const mistralStart = Date.now();
          const text = await callMistralProxy(promptWithCtx, mistralKey);
          mistralResult.response = text;
          mistralResult.isDemo = false;
          mistralResult.latencyMs = Date.now() - mistralStart;
          const mistralModel = AI_MODELS_DATA.find((m) => m.id === 'mistral');
          mistralResult.score = scoreResponse(prompt, text, mistralModel);
          data.results.sort((a, b) => b.score - a.score);
          const newWinner = data.results[0];
          data.winnerId = newWinner.modelId;
          data.winnerName = newWinner.name;
          data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
        } catch (err) {
          settingsStatus.textContent = `✗ Mistral live call failed: ${err.message}${liveCallHint(err.message)}`;
          settingsStatus.className = 'settings-status err';
          settingsPanel.classList.remove('hidden');
          if (isInvalidKeyError(err.message)) { clearModelKey('mistral'); checkServerMode(); }
        }
      }
    }

    // If the backend doesn't have GITHUB_TOKEN, or its configured token returned an error,
    // and the user saved a personal GitHub token, overlay the Copilot result via the proxy
    // endpoint (server-side, CORS-free).  This mirrors the GPT-4 fallback pattern so that
    // a valid personal token always takes precedence over a failing backend-configured token.
    const copilotKey = getLocalCopilotKey();
    const copilotResult = data.results.find((r) => r.modelId === 'copilot');
    if (copilotKey && copilotResult && copilotResult.isDemo && (!backendCopilotConfigured || copilotResult.error)) {
      try {
        const copilotStart = Date.now();
        const text = await callCopilotProxy(promptWithCtx, copilotKey);
        copilotResult.response = text;
        copilotResult.isDemo = false;
        copilotResult.error = null;
        copilotResult.latencyMs = Date.now() - copilotStart;
        const copilotModel = AI_MODELS_DATA.find((m) => m.id === 'copilot');
        copilotResult.score = scoreResponse(prompt, text, copilotModel);
        data.results.sort((a, b) => b.score - a.score);
        const newWinner = data.results[0];
        data.winnerId = newWinner.modelId;
        data.winnerName = newWinner.name;
        data.results.forEach((r) => { r.isWinner = r.modelId === data.winnerId; });
      } catch (err) {
        settingsStatus.textContent = `✗ Copilot live call failed: ${err.message}${liveCallHint(err.message)}`;
        settingsStatus.className = 'settings-status err';
        settingsPanel.classList.remove('hidden');
        if (isInvalidKeyError(err.message)) { clearModelKey('copilot'); checkServerMode(); }
      }
    }

    return data;
  }
  // Static / GitHub Pages mode
  const hasKey = !!(getLocalGeminiKey() || getLocalGrokKey() || getLocalClaudeKey() || getLocalOllamaModel() || getLocalOpenAIKey() || getLocalMistralKey() || getLocalCopilotKey());
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
  const narrativeReset = document.getElementById('win-narrative');
  if (narrativeReset) narrativeReset.classList.add('hidden');

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
    let matchWinnerId = matchWinnerIds[0];
    let matchWinnerModel = AI_MODELS_DATA.find((m) => m.id === matchWinnerId);

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
        error:     bestRound ? (bestRound.error || null) : null,
        roundWins: wins[model.id],
        isWinner:  model.id === matchWinnerId,
      };
    });
    aggregated.sort((a, b) => b.score - a.score);

    // ── Room analysis phase — each model reviews the other models' answers ──
    // Show analysis bubbles while waiting
    MODEL_IDS.forEach((id) => {
      const el = getAgentEl(id);
      el.classList.remove('winner', 'loser');
      showBubble(id, '🔍 analyzing...');
    });

    let analysisData = null;
    try {
      analysisData = await runRoomAnalysis(prompt, { prompt, results: aggregated });
    } catch (_) {
      // Room analysis failed — proceed with initial scores
    }

    if (analysisData) {
      // Merge room analysis scores/responses into aggregated results
      analysisData.results.forEach((ar) => {
        const r = aggregated.find((x) => x.modelId === ar.modelId);
        if (r) {
          // Add analysis score on top of round scores
          r.score += ar.score;
          // Replace response with the refined analysis response
          r.response = ar.response;
          if (!ar.isDemo) r.isDemo = false;
        }
      });
      // Re-sort and re-determine winner based on combined scores
      aggregated.sort((a, b) => b.score - a.score);
      matchWinnerId = aggregated[0].modelId;
      matchWinnerModel = AI_MODELS_DATA.find((m) => m.id === matchWinnerId);
      aggregated.forEach((r) => { r.isWinner = r.modelId === matchWinnerId; });
    }
    // ── End room analysis ────────────────────────────────────────────────────

    const matchData = {
      prompt,
      results:    aggregated,
      winnerId:   matchWinnerId,
      winnerName: matchWinnerModel ? matchWinnerModel.name : matchWinnerId,
      totalRounds: TOTAL_ROUNDS > 1 ? TOTAL_ROUNDS : null,
    };

    // Highlight the overall match winner / losers
    MODEL_IDS.forEach((id) => {
      const el = getAgentEl(id);
      el.classList.remove('winner', 'loser');
      if (id === matchWinnerId) {
        el.classList.add('winner');
        showBubble(id, TOTAL_ROUNDS > 1 ? `★ MATCH WIN! (${wins[id]}W-${TOTAL_ROUNDS - wins[id]}L)` : '★ WIN!');
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
    archiveBestAnswer(matchData);

    // Surface any API errors from the match to the settings panel
    const failedLive = aggregated.filter((r) => r.isDemo && r.error);
    if (failedLive.length > 0 && settingsStatus) {
      const names = failedLive.map((r) => r.name).join(', ');
      const firstErr = failedLive[0].error;
      settingsStatus.textContent = `⚠ ${names} fell back to demo — ${firstErr}`;
      settingsStatus.className = 'settings-status err';
      settingsPanel.classList.remove('hidden');
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Solana Wallet & Trading Module
// All private-key operations happen inside Phantom — keys never leave the browser.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SLIPPAGE_BPS_FE = 50;    // 0.5 % default — mirrors server constant
const MAX_SLIPPAGE_BPS_FE     = 5000;  // 50 % hard cap — mirrors server constant
const MAX_TRADE_HISTORY       = 50;    // maximum entries stored in localStorage
const DISPLAYED_TRADE_HISTORY = 20;    // maximum entries shown in the UI
// Delay (ms) before refreshing portfolio after a trade to allow on-chain settlement
const PORTFOLIO_REFRESH_DELAY_MS = 4000;
// Assumed total portfolio value in USD used to size auto-trade positions
const AUTO_TRADE_PORTFOLIO_USD = 1000;

// Token mint → decimals map (mirrors TRACKED_TOKENS on the backend)
const TOKEN_DECIMALS = {
  'So11111111111111111111111111111111111111112':   9,  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,  // USDC
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5,  // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  6,  // JUP
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 6,  // WIF
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 6,  // PYTH
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R':  6,  // RAY
};

// Symbol → mint address lookup (used by auto-fill and trade history display)
const SYMBOL_TO_MINT = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF:  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RAY:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};

function mintToSymbol(mint) {
  return Object.entries(SYMBOL_TO_MINT).find(([, m]) => m === mint)?.[0] || mint.slice(0, 4);
}

const LS_TRADE_HISTORY = 'airing_trade_history';
let connectedWallet   = null;
let currentPortfolio  = null;
let latestMarketData  = null;
let tradeHistory      = [];

try {
  const stored = localStorage.getItem(LS_TRADE_HISTORY);
  if (stored) tradeHistory = JSON.parse(stored);
} catch { tradeHistory = []; }

// ── DOM refs ───────────────────────────────────────────────────
const walletBtn             = document.getElementById('wallet-btn');
const walletPanelEl         = document.getElementById('wallet-panel');
const walletConnectBtn      = document.getElementById('wallet-connect-btn');
const walletAddressDisplay  = document.getElementById('wallet-address-display');
const walletDisconnectBtn   = document.getElementById('wallet-disconnect-btn');
const tickerGridEl          = document.getElementById('ticker-grid');
const refreshMarketBtn      = document.getElementById('refresh-market-btn');
const portfolioPanelEl      = document.getElementById('portfolio-panel');
const portfolioDisplayEl    = document.getElementById('portfolio-display');
const analyzeMarketBtn      = document.getElementById('analyze-market-btn');
const autoTradeToggle       = document.getElementById('auto-trade-toggle');
const tradeRecommendation   = document.getElementById('trade-recommendation');
const recommendationDisplay = document.getElementById('recommendation-display');
const executeTradeBtnEl     = document.getElementById('execute-trade-btn');
const tradeFromSelect       = document.getElementById('trade-from-select');
const tradeToSelect         = document.getElementById('trade-to-select');
const tradeAmountInput      = document.getElementById('trade-amount-input');
const tradeSlippageInput    = document.getElementById('trade-slippage-input');
const tradeStatusEl         = document.getElementById('trade-status');
const tradeHistoryListEl    = document.getElementById('trade-history-list');
const socialSignalsPanelEl  = document.getElementById('social-signals-panel');
const socialSignalsListEl   = document.getElementById('social-signals-list');
const refreshSignalsBtn     = document.getElementById('refresh-signals-btn');

// ── Toggle wallet panel ────────────────────────────────────────
if (walletBtn) {
  walletBtn.addEventListener('click', () => {
    walletPanelEl.classList.toggle('hidden');
    // Close settings panel when opening wallet panel and vice-versa
    if (!walletPanelEl.classList.contains('hidden')) {
      settingsPanel.classList.add('hidden');
      refreshMarketData();
    }
  });
}

// Also close wallet panel when settings opens
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (!walletPanelEl.classList.contains('hidden')) {
      walletPanelEl.classList.add('hidden');
    }
  }, true /* capture — runs before existing listener */);
}

// ── Phantom wallet helpers ─────────────────────────────────────
function getPhantomProvider() {
  if (typeof window === 'undefined') return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom)          return window.solana;
  return null;
}

// Redirects the current page into Phantom's in-app browser via Phantom's
// Universal Link so that window.phantom.solana is injected and login works.
// On mobile with Phantom installed this opens the app directly via Universal
// Link; on desktop without the extension it opens the Phantom website in a new
// tab so the user stays on the login page.
function openPhantomOrRedirect() {
  const encodedUrl = encodeURIComponent(window.location.href);
  const encodedRef = encodeURIComponent(window.location.origin);
  window.open(
    `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedRef}`,
    '_blank',
    'noopener,noreferrer'
  );
}

// Returns the Phantom provider, waiting up to `timeout` ms for the
// phantom#initialized event in case the extension is still injecting.
function waitForPhantomProvider(getProviderFn, timeout) {
  return new Promise((resolve) => {
    const provider = getProviderFn();
    if (provider) { resolve(provider); return; }
    const t = setTimeout(() => resolve(null), timeout || 800);
    window.addEventListener('phantom#initialized', () => {
      clearTimeout(t);
      resolve(getProviderFn());
    }, { once: true });
  });
}

function onWalletConnected(pubkey) {
  connectedWallet = pubkey;
  const short = `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
  if (walletConnectBtn) {
    walletConnectBtn.textContent = '◈ CONNECTED';
    walletConnectBtn.classList.add('connected');
    walletConnectBtn.disabled = true;
  }
  if (walletAddressDisplay) {
    walletAddressDisplay.textContent = short;
    walletAddressDisplay.title = pubkey;
    walletAddressDisplay.classList.remove('hidden');
  }
  if (walletDisconnectBtn) walletDisconnectBtn.classList.remove('hidden');
  if (executeTradeBtnEl)   executeTradeBtnEl.disabled = false;
  if (portfolioPanelEl)    portfolioPanelEl.classList.remove('hidden');
  fetchPortfolioData(pubkey);
}

function onWalletDisconnected() {
  connectedWallet = null;
  currentPortfolio = null;
  if (walletConnectBtn) {
    walletConnectBtn.textContent = '◈ CONNECT PHANTOM';
    walletConnectBtn.classList.remove('connected');
    walletConnectBtn.disabled = false;
  }
  if (walletAddressDisplay) walletAddressDisplay.classList.add('hidden');
  if (walletDisconnectBtn)  walletDisconnectBtn.classList.add('hidden');
  if (portfolioPanelEl)     portfolioPanelEl.classList.add('hidden');
  if (executeTradeBtnEl)    executeTradeBtnEl.disabled = true;
}

if (walletConnectBtn) {
  walletConnectBtn.addEventListener('click', async () => {
    // Wait for phantom#initialized if the extension hasn't injected yet.
    const provider = await waitForPhantomProvider(getPhantomProvider);
    if (!provider) {
      openPhantomOrRedirect();
      return;
    }
    try {
      walletConnectBtn.disabled = true;
      walletConnectBtn.textContent = '◈ CONNECTING…';
      const resp = await provider.connect();
      onWalletConnected(resp.publicKey.toString());
    } catch (err) {
      walletConnectBtn.textContent = '◈ CONNECT PHANTOM';
      walletConnectBtn.disabled = false;
      console.error('[wallet] connect error:', err);
    }
  });
}

if (walletDisconnectBtn) {
  walletDisconnectBtn.addEventListener('click', async () => {
    const provider = getPhantomProvider();
    if (provider) { try { await provider.disconnect(); } catch { /* ignore */ } }
    onWalletDisconnected();
  });
}

// Listen for Phantom events and attempt silent reconnect.
// Uses waitForPhantomProvider so that the listeners and silent reconnect are
// still set up when Phantom is slow to inject (fires phantom#initialized late).
(async function initPhantomListeners() {
  const provider = await waitForPhantomProvider(getPhantomProvider);
  if (!provider) return;
  provider.on('connect',        (pk) => onWalletConnected(pk.toString()));
  provider.on('disconnect',     ()   => onWalletDisconnected());
  provider.on('accountChanged', (pk) => { if (pk) onWalletConnected(pk.toString()); else onWalletDisconnected(); });
  // Silently reconnect if the user previously approved this dApp
  provider.connect({ onlyIfTrusted: true })
    .then((resp) => {
      // Some Phantom versions set provider.publicKey rather than returning it
      const pk = resp?.publicKey ?? provider.publicKey;
      if (pk) onWalletConnected(pk.toString());
    })
    .catch(() => { /* not previously trusted — require explicit connect */ });
}());

// ── Market data ────────────────────────────────────────────────
async function refreshMarketData() {
  if (!tickerGridEl) return;
  tickerGridEl.innerHTML = '<span class="ticker-loading">Loading market data…</span>';
  try {
    const res = await fetch(`${API_BASE}/api/market-data`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    latestMarketData = data.tokens;
    renderTicker(data.tokens, data.stale);
  } catch (err) {
    if (tickerGridEl) {
      tickerGridEl.innerHTML = `<span class="ticker-loading" style="color:#ff4040">⚠ ${escapeHtml(err.message)}</span>`;
    }
  }
}

function renderTicker(tokens, stale) {
  if (!tickerGridEl) return;
  const cards = tokens.map((t) => {
    const rawPrice = Number(t.price);
    const price = t.price !== null
      ? (rawPrice < 0.01 ? `$${rawPrice.toExponential(3)}` : `$${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`)
      : 'N/A';
    const change      = t.change24h !== null ? `${t.change24h >= 0 ? '+' : ''}${Number(t.change24h).toFixed(2)}%` : '—';
    const changeClass = t.change24h === null ? 'flat' : t.change24h >= 0 ? 'up' : 'down';
    return `<div class="ticker-card">
      <div class="ticker-symbol">${escapeHtml(t.symbol)}</div>
      <div class="ticker-price">${escapeHtml(price)}</div>
      <div class="ticker-change ${changeClass}">${escapeHtml(change)}</div>
    </div>`;
  }).join('');
  const staleNotice = stale
    ? '<span class="ticker-loading ticker-loading--stale">⚠ prices may be delayed</span>'
    : '';
  tickerGridEl.innerHTML = cards + staleNotice;
}

if (refreshMarketBtn) {
  refreshMarketBtn.addEventListener('click', refreshMarketData);
}

// ── Portfolio ──────────────────────────────────────────────────
async function fetchPortfolioData(walletAddress) {
  if (!portfolioDisplayEl) return;
  portfolioDisplayEl.textContent = 'Loading…';
  try {
    const res = await fetch(`${API_BASE}/api/portfolio/${encodeURIComponent(walletAddress)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentPortfolio = data;
    renderPortfolio(data);
  } catch (err) {
    if (portfolioDisplayEl) portfolioDisplayEl.textContent = `Failed to load: ${err.message}`;
  }
}

function renderPortfolio(portfolio) {
  if (!portfolioDisplayEl) return;
  let html = `<strong>SOL:</strong> ${Number(portfolio.sol).toFixed(4)}`;
  if (portfolio.tokens && portfolio.tokens.length > 0) {
    html += portfolio.tokens
      .map((t) => `<br><strong>${escapeHtml(t.symbol)}:</strong> ${t.amount}`)
      .join('');
  } else {
    html += '<br><span style="color:var(--text-muted)">No tracked SPL tokens</span>';
  }
  portfolioDisplayEl.innerHTML = html;
}

// ── Social signals — fetch and render ─────────────────────────
async function fetchSocialSignals() {
  if (!socialSignalsListEl) return;
  socialSignalsListEl.textContent = 'Loading…';
  try {
    const res = await fetch(`${API_BASE}/api/social-signals`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderSocialSignals(data);
  } catch (err) {
    if (socialSignalsListEl) {
      socialSignalsListEl.textContent = `Failed to load: ${err.message}`;
    }
  }
}

function renderSocialSignals(data) {
  if (!socialSignalsPanelEl || !socialSignalsListEl) return;
  const { signals, sources } = data;
  const active = Object.entries(sources || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  if (!signals) {
    socialSignalsListEl.innerHTML =
      '<span style="color:var(--text-muted)">No social API keys configured. ' +
      'Add CRYPTOPANIC_API_KEY, TWITTER_BEARER_TOKEN, or TELEGRAM_BOT_TOKEN in your .env file.</span>';
    return;
  }

  const lines = signals.split('\n').filter(Boolean);
  socialSignalsListEl.innerHTML = lines
    .map((line) => `<div class="signal-item">${escapeHtml(line)}</div>`)
    .join('');

  if (active) {
    const label = socialSignalsPanelEl.querySelector('.social-sources-label');
    if (label) label.textContent = `Sources: ${active}`;
  }
}

if (refreshSignalsBtn) {
  refreshSignalsBtn.addEventListener('click', fetchSocialSignals);
}

// ── Trading analysis — AI room battles on live market data ─────
if (analyzeMarketBtn) {
  analyzeMarketBtn.addEventListener('click', runTradingAnalysis);
}

async function runTradingAnalysis() {
  if (!analyzeMarketBtn) return;
  analyzeMarketBtn.disabled = true;
  analyzeMarketBtn.innerHTML = '<span class="btn-icon">⚔</span> ANALYZING…';

  try {
    const res = await fetch(`${API_BASE}/api/trading-analysis`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ wallet: connectedWallet || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();

    // Refresh market ticker with the data returned from analysis
    if (data.marketData) {
      latestMarketData = data.marketData;
      renderTicker(data.marketData);
    }

    // Refresh social signals panel from the analysis response
    if (data.socialSignals !== undefined) {
      renderSocialSignals({ signals: data.socialSignals, sources: {} });
    }

    const winner = data.results.find((r) => r.isWinner);

    // Show the winning recommendation panel
    if (winner && tradeRecommendation && recommendationDisplay) {
      recommendationDisplay.textContent = winner.response;
      tradeRecommendation.classList.remove('hidden');
      autoFillTradeForm(winner.response);
    }

    // Surface the analysis in the main battle room (quest log + scoreboard)
    if (winnerPanel && winnerName && winnerResponse) {
      winnerPanel.classList.remove('hidden');
      winnerName.textContent = `${winner?.emoji || ''} ${data.winnerName}`;
      winnerResponse.textContent = winner?.response || '';
    }
    const analysisEntry = {
      prompt:     '⚔ MARKET ANALYSIS',
      results:    data.results,
      winnerId:   data.winnerId,
      winnerName: data.winnerName,
    };
    renderResults(analysisEntry);
    addToHistory(analysisEntry);

    // Auto-execute if toggle is on and wallet is connected
    if (autoTradeToggle?.checked && connectedWallet) {
      const parsedTrade = parseTradeRecommendation(winner?.response || '', data.marketData);
      if (parsedTrade) await executeTrade(parsedTrade);
    }
  } catch (err) {
    if (tradeStatusEl) {
      tradeStatusEl.textContent = `✗ Analysis failed: ${escapeHtml(err.message)}`;
      tradeStatusEl.className = 'settings-status err';
    }
  } finally {
    analyzeMarketBtn.disabled = false;
    analyzeMarketBtn.innerHTML = '<span class="btn-icon">⚔</span> ANALYZE MARKET';
  }
}

// Pre-fill the trade form from an AI recommendation string
function autoFillTradeForm(recommendation) {
  if (!recommendation) return;
  const actionMatch = recommendation.match(/ACTION:\s*(BUY|SELL|HOLD)\s+(\w+)/i);
  if (!actionMatch) return;
  const action = actionMatch[1].toUpperCase();
  const symbol = actionMatch[2].toUpperCase();
  if (action === 'HOLD') return;
  const targetMint = SYMBOL_TO_MINT[symbol];
  if (!targetMint) return;
  if (action === 'BUY') {
    if (tradeFromSelect) tradeFromSelect.value = SYMBOL_TO_MINT.SOL;
    if (tradeToSelect)   tradeToSelect.value   = targetMint;
  } else {
    if (tradeFromSelect) tradeFromSelect.value = targetMint;
    if (tradeToSelect)   tradeToSelect.value   = SYMBOL_TO_MINT.USDC;
  }
}

// Parse an AI recommendation into a structured trade object for auto-execute
function parseTradeRecommendation(recommendation, marketData) {
  const actionMatch = recommendation.match(/ACTION:\s*(BUY|SELL|HOLD)\s+(\w+)/i);
  const sizeMatch   = recommendation.match(/SIZE:\s*([\d.]+)%/i);
  if (!actionMatch) return null;
  const action = actionMatch[1].toUpperCase();
  const symbol = actionMatch[2].toUpperCase();
  if (action === 'HOLD') return null;

  const targetMint = SYMBOL_TO_MINT[symbol];
  if (!targetMint) return null;

  const sizePct  = sizeMatch ? Math.min(parseFloat(sizeMatch[1]) / 100, 0.20) : 0.05; // cap at 20%
  const solToken = (marketData || []).find((t) => t.symbol === 'SOL');
  const solPrice = solToken?.price || 100;
  const solAmountUi       = Math.max(0.001, (sizePct * AUTO_TRADE_PORTFOLIO_USD) / solPrice);
  const solAmountLamports = Math.floor(solAmountUi * 1e9);

  if (action === 'BUY') {
    return { inputMint: SYMBOL_TO_MINT.SOL, outputMint: targetMint, amount: solAmountLamports, userPublicKey: connectedWallet, slippageBps: DEFAULT_SLIPPAGE_BPS_FE };
  }
  const targetDecimals = TOKEN_DECIMALS[targetMint] ?? 6;
  return { inputMint: targetMint, outputMint: SYMBOL_TO_MINT.USDC, amount: Math.floor(solAmountUi * Math.pow(10, targetDecimals)), userPublicKey: connectedWallet, slippageBps: DEFAULT_SLIPPAGE_BPS_FE };
}

// ── Execute trade button ───────────────────────────────────────
if (executeTradeBtnEl) {
  executeTradeBtnEl.addEventListener('click', async () => {
    if (!connectedWallet) {
      if (tradeStatusEl) { tradeStatusEl.textContent = '✗ Connect wallet first'; tradeStatusEl.className = 'settings-status err'; }
      return;
    }
    const inputMint  = tradeFromSelect?.value;
    const outputMint = tradeToSelect?.value;
    const amountUi   = parseFloat(tradeAmountInput?.value || '0');
    const slippage   = Math.max(1, Math.min(parseInt(tradeSlippageInput?.value || String(DEFAULT_SLIPPAGE_BPS_FE), 10), MAX_SLIPPAGE_BPS_FE));

    if (!inputMint || !outputMint) {
      if (tradeStatusEl) { tradeStatusEl.textContent = '✗ Select tokens'; tradeStatusEl.className = 'settings-status err'; }
      return;
    }
    if (inputMint === outputMint) {
      if (tradeStatusEl) { tradeStatusEl.textContent = '✗ From and To tokens must differ'; tradeStatusEl.className = 'settings-status err'; }
      return;
    }
    if (!amountUi || amountUi <= 0) {
      if (tradeStatusEl) { tradeStatusEl.textContent = '✗ Enter a valid amount'; tradeStatusEl.className = 'settings-status err'; }
      return;
    }
    const decimals   = TOKEN_DECIMALS[inputMint] ?? 9;
    const amountBase = Math.floor(amountUi * Math.pow(10, decimals));
    if (amountBase <= 0) {
      if (tradeStatusEl) { tradeStatusEl.textContent = '✗ Amount too small'; tradeStatusEl.className = 'settings-status err'; }
      return;
    }
    await executeTrade({ inputMint, outputMint, amount: amountBase, userPublicKey: connectedWallet, slippageBps: slippage });
  });
}

// Core trade execution: create unsigned tx via backend → sign in Phantom → submit
async function executeTrade({ inputMint, outputMint, amount, userPublicKey, slippageBps = DEFAULT_SLIPPAGE_BPS_FE }) {
  const inputSym  = mintToSymbol(inputMint);
  const outputSym = mintToSymbol(outputMint);

  if (executeTradeBtnEl) executeTradeBtnEl.disabled = true;
  if (tradeStatusEl) { tradeStatusEl.textContent = '⟳ Getting quote…'; tradeStatusEl.className = 'settings-status info'; }

  try {
    // 1. Ask the backend to build the unsigned Jupiter V6 swap transaction
    const createRes = await fetch(`${API_BASE}/api/create-swap`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inputMint, outputMint, amount, userPublicKey, slippageBps }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || `HTTP ${createRes.status}`);

    const { swapTransaction, quote } = createData;
    if (tradeStatusEl) { tradeStatusEl.textContent = '⟳ Approve transaction in Phantom…'; }

    // 2. Deserialise the base64-encoded VersionedTransaction using @solana/web3.js
    const provider = getPhantomProvider();
    if (!provider) throw new Error('Phantom wallet not found — install it at phantom.app');

    const solanaWeb3 = window.solanaWeb3;
    if (!solanaWeb3?.VersionedTransaction) throw new Error('@solana/web3.js not loaded');

    const txBytes = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
    const transaction = solanaWeb3.VersionedTransaction.deserialize(txBytes);

    // 3. Sign and send via Phantom (Phantom handles the RPC submission)
    const { signature } = await provider.signAndSendTransaction(transaction);
    if (!signature) throw new Error('No signature returned from Phantom');

    const explorerUrl = `https://solscan.io/tx/${signature}`;
    if (tradeStatusEl) {
      tradeStatusEl.innerHTML = `✓ Sent! <a href="${explorerUrl}" target="_blank" rel="noopener" style="color:var(--border-gold)">View on Solscan ↗</a>`;
      tradeStatusEl.className = 'settings-status ok';
    }

    addTradeHistoryEntry({
      action:    `${inputSym} → ${outputSym}`,
      inAmount:  quote.inAmount,
      outAmount: quote.outAmount,
      signature,
      timestamp: new Date().toISOString(),
      status:    'success',
    });

    // Refresh portfolio after a short delay so the on-chain state settles
    if (connectedWallet) setTimeout(() => fetchPortfolioData(connectedWallet), PORTFOLIO_REFRESH_DELAY_MS);

  } catch (err) {
    if (tradeStatusEl) {
      tradeStatusEl.textContent = `✗ Trade failed: ${escapeHtml(err.message)}`;
      tradeStatusEl.className = 'settings-status err';
    }
    addTradeHistoryEntry({
      action:    `${inputSym} → ${outputSym}`,
      timestamp: new Date().toISOString(),
      status:    'failed',
      error:     err.message,
    });
  } finally {
    if (executeTradeBtnEl) executeTradeBtnEl.disabled = !connectedWallet;
  }
}

// ── Trade history ──────────────────────────────────────────────
function addTradeHistoryEntry(entry) {
  tradeHistory.unshift(entry);
  if (tradeHistory.length > MAX_TRADE_HISTORY) tradeHistory = tradeHistory.slice(0, MAX_TRADE_HISTORY);
  try { localStorage.setItem(LS_TRADE_HISTORY, JSON.stringify(tradeHistory)); } catch { /* ignore */ }
  renderTradeHistory();
}

function renderTradeHistory() {
  if (!tradeHistoryListEl) return;
  if (tradeHistory.length === 0) {
    tradeHistoryListEl.innerHTML = '<p class="history-empty">No trades executed yet.</p>';
    return;
  }
  tradeHistoryListEl.innerHTML = tradeHistory.slice(0, DISPLAYED_TRADE_HISTORY).map((t) => {
    const time        = new Date(t.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const statusClass = t.status === 'success' ? 'ok' : 'fail';
    const label       = t.signature
      ? `<a href="https://solscan.io/tx/${t.signature}" target="_blank" rel="noopener" style="color:var(--border-gold)">${escapeHtml(t.action)}</a>`
      : escapeHtml(t.action);
    return `<div class="trade-history-item">
      <span class="trade-history-action">${label} <span class="trade-history-status ${statusClass}">[${escapeHtml(t.status)}]</span></span>
      <span class="trade-history-time">${escapeHtml(time)}</span>
    </div>`;
  }).join('');
}

renderTradeHistory();

// ── Auto-load social signals when the trading panel is first opened ────────
(function initSocialSignals() {
  if (socialSignalsPanelEl && backendAvailable) {
    fetchSocialSignals();
  }
}());
