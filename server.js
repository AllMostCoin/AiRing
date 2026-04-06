'use strict';

// Load .env.example first as defaults, then override with .env if present.
// This lets users fill in API keys directly in .env.example without needing a separate .env file.
require('dotenv').config({ path: '.env.example' });
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

// ─────────────────────────────────────────────────────────────────────────────
// AI model definitions
// ─────────────────────────────────────────────────────────────────────────────
const AI_MODELS = [
  {
    id: 'gpt4',
    name: 'GPT-4',
    character: 'Cloud',
    provider: 'openai',
    color: '#4888d8',
    emoji: '⚔️',
    strengths: ['reasoning', 'coding', 'analysis', 'general'],
  },
  {
    id: 'claude',
    name: 'Claude',
    character: 'Barret',
    provider: 'anthropic',
    color: '#d84020',
    emoji: '🔫',
    strengths: ['writing', 'analysis', 'safety', 'nuance'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    character: 'Red XIII',
    provider: 'google',
    color: '#e04010',
    emoji: '🔥',
    strengths: ['multimodal', 'search', 'factual', 'math'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    character: 'Cid',
    provider: 'mistral',
    color: '#20a8c0',
    emoji: '✈️',
    strengths: ['coding', 'efficiency', 'multilingual', 'speed'],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    character: 'Tifa',
    provider: 'github',
    color: '#e03860',
    emoji: '👊',
    strengths: ['coding', 'autocomplete', 'refactoring', 'debugging'],
  },
  {
    id: 'grok',
    name: 'Grok',
    character: 'Vincent',
    provider: 'xai',
    color: '#7030c8',
    emoji: '🦇',
    strengths: ['reasoning', 'speed', 'creative', 'search'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    character: 'Yuffie',
    provider: 'ollama',
    color: '#0a84c8',
    emoji: '🌊',
    strengths: ['reasoning', 'coding', 'math', 'efficiency'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Real API callers (only active when keys are present)
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('OpenAI returned no content');
  return data.choices[0].message.content.trim();
}

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.content?.length || !data.content[0]?.text) throw new Error('Anthropic returned no content');
  return data.content[0].text.trim();
}

async function callGoogle(prompt) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.candidates?.length || !data.candidates[0]?.content?.parts?.length) throw new Error('Google returned no content');
  const parts = data.candidates[0].content.parts;
  const textPart = parts.find((p) => !p.thought) || parts[0];
  if (!textPart?.text) throw new Error('Google returned no text part');
  return textPart.text.trim();
}

async function callMistral(prompt) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mistral HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('Mistral returned no content');
  return data.choices[0].message.content.trim();
}

async function callCopilot(prompt) {
  // GitHub Models inference endpoint — requires a GitHub token with model permissions
  const key = process.env.GITHUB_TOKEN;
  if (!key) return null;
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub Copilot HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('GitHub Copilot returned no content');
  return data.choices[0].message.content.trim();
}

async function callXAI(prompt, key) {
  // xAI Grok — OpenAI-compatible endpoint
  // key may be supplied by the caller (proxy route) or read from the environment.
  const resolvedKey = key || process.env.XAI_API_KEY;
  if (!resolvedKey) return null;
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedKey}` },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`xAI Grok HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('xAI Grok returned no content');
  return data.choices[0].message.content.trim();
}

async function callOllama(prompt, model, baseUrlOverride) {
  // Ollama — free local inference, OpenAI-compatible API.
  // model may be supplied by the caller (proxy route) or read from the environment.
  // baseUrlOverride may be supplied by the proxy route (user-configured Ollama URL).
  // When a user provides a URL it is validated as https:// only and reconstructed
  // from parsed URL components before reaching this function (see /api/ollama-proxy).
  const resolvedModel = model || process.env.OLLAMA_MODEL;
  if (!resolvedModel) return null;  // no model configured → demo mode
  const baseUrl = (baseUrlOverride || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  // lgtm[js/request-forgery] - baseUrl is either from trusted server env or a user-supplied https:// URL validated and reconstructed in /api/ollama-proxy
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedModel}` },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('Ollama returned no content');
  return data.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo mode responses (used when no API keys are set)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Scoring constants
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_KEYWORD_MATCH   = 2;   // points per prompt-word found in response
const SCORE_LENGTH_CAP      = 30;  // maximum points awarded for response length
const SCORE_LENGTH_DIVISOR  = 20;  // chars-per-point for length scoring
const SCORE_NEWLINE_BONUS   = 5;   // bonus for multi-paragraph responses
const SCORE_LIST_BONUS      = 5;   // bonus for numbered lists
const SCORE_COLON_BONUS     = 3;   // bonus for structured key:value content
const SCORE_STRENGTH_BONUS  = 10;  // bonus per matched model-strength keyword

// ─────────────────────────────────────────────────────────────────────────────
// Scoring: pick the best response to represent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a response based on simple heuristics:
 * - length (more thorough = slightly better, up to a cap)
 * - keyword matches with the prompt
 * - structural quality (lists, paragraphs)
 */
function scoreResponse(prompt, response, model) {
  let score = 0;
  const promptWords = new Set(
    prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  const responseWords = response.toLowerCase().split(/\W+/);

  // Keyword overlap
  for (const word of responseWords) {
    if (promptWords.has(word)) score += SCORE_KEYWORD_MATCH;
  }

  // Length score (capped)
  score += Math.min(response.length / SCORE_LENGTH_DIVISOR, SCORE_LENGTH_CAP);

  // Structure bonus
  if (response.includes('\n')) score += SCORE_NEWLINE_BONUS;
  if (/\d+\)|\d+\./.test(response)) score += SCORE_LIST_BONUS;
  if (response.includes(':')) score += SCORE_COLON_BONUS;

  // Model strength bonus based on prompt keywords
  const promptLower = prompt.toLowerCase();
  for (const strength of model.strengths) {
    if (promptLower.includes(strength)) score += SCORE_STRENGTH_BONUS;
  }

  return Math.round(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiters
// ─────────────────────────────────────────────────────────────────────────────
const grokProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const ollamaProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const openaiProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const mistralProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const copilotProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const competeLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 20,               // max 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/models — list available models
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/models', (_req, res) => {
  const configured = {
    gpt4:     !!process.env.OPENAI_API_KEY,
    claude:   !!process.env.ANTHROPIC_API_KEY,
    gemini:   !!process.env.GOOGLE_API_KEY,
    mistral:  !!process.env.MISTRAL_API_KEY,
    copilot:  !!process.env.GITHUB_TOKEN,
    grok:     !!process.env.XAI_API_KEY,
    ollama:   !!(process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL),
  };
  res.json({ models: AI_MODELS, configured, demoMode: Object.values(configured).every((v) => !v) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/grok-proxy — proxy a user-supplied xAI key through the backend
// Browsers cannot call api.x.ai directly (no CORS headers). This endpoint
// accepts the user's personal key in the request body, forwards the call
// server-side (CORS-free), and returns the text response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/grok-proxy', grokProxyLimiter, async (req, res) => {
  const { prompt, key } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || !key.trim().startsWith('xai-')) {
    return res.status(400).json({ error: 'valid xAI API key is required (must start with xai-)' });
  }
  const trimmedKey = key.trim();
  try {
    const text = await callXAI(trimmedPrompt, trimmedKey);
    if (text === null) {
      return res.status(502).json({ error: 'xAI API did not return a response' });
    }
    res.json({ text });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/ollama-proxy — proxy a user-supplied Ollama model through the backend
// Browsers cannot call a local Ollama instance directly (CORS). This endpoint
// accepts the model name in the request body, forwards the call server-side
// (CORS-free), and returns the text response.
//
// Security: user-provided base URLs are restricted to https:// only to reduce
// the risk of server-side request forgery targeting internal http:// services.
// If you need http:// (e.g. local development), configure OLLAMA_BASE_URL on the server.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ollama-proxy', ollamaProxyLimiter, async (req, res) => {
  const { prompt, key, url } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return res.status(400).json({ error: 'Ollama model name is required (e.g. llama3.2)' });
  }
  const trimmedModel = key.trim();

  // If the server has OLLAMA_BASE_URL configured, always use it (trusted server config).
  // Otherwise, accept an https:// URL from the client so users can point to their own
  // publicly hosted Ollama instance. http:// is intentionally disallowed for client-supplied
  // URLs to reduce the SSRF attack surface against internal http services.
  let resolvedBaseUrl;
  if (process.env.OLLAMA_BASE_URL) {
    resolvedBaseUrl = undefined; // callOllama will read from env
  } else if (url) {
    if (typeof url !== 'string') {
      return res.status(400).json({ error: 'url must be a string' });
    }
    const trimmedUrl = url.trim();
    let parsed;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      return res.status(400).json({ error: 'url must be a valid URL' });
    }
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'user-supplied base url must use https. For http (e.g. local dev), set OLLAMA_BASE_URL on the server instead.' });
    }
    // Reconstruct from parsed URL components to avoid passing raw user input downstream.
    resolvedBaseUrl = `${parsed.protocol}//${parsed.host}`;
  }

  try {
    const text = await callOllama(trimmedPrompt, trimmedModel, resolvedBaseUrl);
    if (text === null) {
      return res.status(502).json({ error: 'Ollama did not return a response' });
    }
    res.json({ text });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/openai-proxy — proxy a user-supplied OpenAI key through the backend
// Browsers cannot call api.openai.com directly (no CORS headers). This endpoint
// accepts the user's personal key in the request body, forwards the call
// server-side (CORS-free), and returns the text response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/openai-proxy', openaiProxyLimiter, async (req, res) => {
  const { prompt, key } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || !key.trim().startsWith('sk-')) {
    return res.status(400).json({ error: 'valid OpenAI API key is required (must start with sk-)' });
  }
  const trimmedKey = key.trim();
  try {
    const res2 = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmedKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: trimmedPrompt }], max_tokens: 512 }),
    });
    const data = await res2.json();
    if (!res2.ok) throw new Error(`OpenAI HTTP ${res2.status}: ${data.error?.message || res2.statusText}`);
    if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('OpenAI returned no content');
    res.json({ text: data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/mistral-proxy — proxy a user-supplied Mistral key through the backend
// Browsers cannot call api.mistral.ai directly (CORS). This endpoint accepts the
// user's personal key in the request body, forwards the call server-side, and
// returns the text response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/mistral-proxy', mistralProxyLimiter, async (req, res) => {
  const { prompt, key } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return res.status(400).json({ error: 'Mistral API key is required' });
  }
  const trimmedKey = key.trim();
  try {
    const res2 = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmedKey}` },
      body: JSON.stringify({ model: 'mistral-large-latest', messages: [{ role: 'user', content: trimmedPrompt }], max_tokens: 512 }),
    });
    const data = await res2.json();
    if (!res2.ok) throw new Error(`Mistral HTTP ${res2.status}: ${data.error?.message || res2.statusText}`);
    if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('Mistral returned no content');
    res.json({ text: data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/copilot-proxy — proxy a user-supplied GitHub token through the backend
// Browsers cannot call models.github.ai directly (CORS). This endpoint
// accepts the user's personal GitHub token in the request body, forwards the call
// server-side (CORS-free), and returns the text response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/copilot-proxy', copilotProxyLimiter, async (req, res) => {
  const { prompt, key } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return res.status(400).json({ error: 'GitHub token is required' });
  }
  const trimmedKey = key.trim();
  if (!trimmedKey.startsWith('ghp_') && !trimmedKey.startsWith('github_pat_') && !trimmedKey.startsWith('ghs_')) {
    return res.status(400).json({ error: 'GitHub token must start with ghp_, github_pat_, or ghs_. Generate one at github.com/settings/tokens with models:read permission.' });
  }
  try {
    const res2 = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmedKey}` },
      body: JSON.stringify({ model: 'openai/gpt-4o', messages: [{ role: 'user', content: trimmedPrompt }], max_tokens: 512 }),
    });
    const data = await res2.json().catch(() => ({}));
    if (!res2.ok) {
      const msg = data.error?.message || data.message || res2.statusText;
      console.error(`[copilot] GitHub Models API HTTP ${res2.status}: ${msg}`);
      throw new Error(`GitHub Copilot HTTP ${res2.status}: ${msg}`);
    }
    if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('GitHub Copilot returned no content');
    res.json({ text: data.choices[0].message.content.trim() });
  } catch (err) {
    console.error(`[copilot] proxy error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/compete — run the competition
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/compete', competeLimiter, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmed = prompt.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }

  const callers = { gpt4: callOpenAI, claude: callAnthropic, gemini: callGoogle, mistral: callMistral, copilot: callCopilot, grok: callXAI, ollama: callOllama };

  // Call all models in parallel
  const results = await Promise.all(
    AI_MODELS.map(async (model) => {
      const start = Date.now();
      try {
        let text = await callers[model.id](trimmed);
        const isDemo = text === null;
        if (isDemo) text = generateDemoResponse(model.id, trimmed);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(trimmed, text, model);
        return { model, response: text, latencyMs, score, isDemo, error: null };
      } catch (err) {
        console.error(`[${model.id}] API call failed: ${err.message}`);
        const text = generateDemoResponse(model.id, trimmed);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(trimmed, text, model);
        return { model, response: text, latencyMs, score, isDemo: true, error: err.message };
      }
    }),
  );

  // Sort by score descending, pick winner
  results.sort((a, b) => b.score - a.score);
  const winner = results[0];

  res.json({
    prompt: trimmed,
    results: results.map((r) => ({
      modelId: r.model.id,
      name: r.model.name,
      character: r.model.character,
      color: r.model.color,
      emoji: r.model.emoji,
      response: r.response,
      score: r.score,
      latencyMs: r.latencyMs,
      isDemo: r.isDemo,
      error: r.error || null,
      isWinner: r.model.id === winner.model.id,
    })),
    winnerId: winner.model.id,
    winnerName: winner.model.name,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Room analysis helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a prompt that asks a model to analyze what the other models said
 * and then deliver its best possible answer.
 */
function buildRoomAnalysisPrompt(originalPrompt, modelName, otherResponses) {
  const others = otherResponses
    .map((r) => `[${r.name}]: ${r.response}`)
    .join('\n\n');
  return (
    `You are competing in the AI Ring arena. The original question was:\n"${originalPrompt}"\n\n` +
    `Here is what the other AI models in the room answered:\n\n${others}\n\n` +
    `You are ${modelName}. Having reviewed the other models' responses, ` +
    `identify what is missing or could be improved, then provide your definitive best answer ` +
    `to the original question.`
  );
}

const roomAnalyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/room-analyze — each model analyzes the other models' answers
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/room-analyze', roomAnalyzeLimiter, async (req, res) => {
  const { prompt, results: initialResults } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!Array.isArray(initialResults) || initialResults.length === 0) {
    return res.status(400).json({ error: 'results array is required' });
  }
  const trimmed = prompt.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }

  const callers = { gpt4: callOpenAI, claude: callAnthropic, gemini: callGoogle, mistral: callMistral, copilot: callCopilot, grok: callXAI, ollama: callOllama };

  const results = await Promise.all(
    AI_MODELS.map(async (model) => {
      const start = Date.now();
      // Build context from the other models' responses (exclude this model)
      const others = initialResults.filter((r) => r.modelId !== model.id);
      const analysisPrompt = buildRoomAnalysisPrompt(trimmed, model.name, others);
      try {
        let text = await callers[model.id](analysisPrompt);
        const isDemo = text === null;
        if (isDemo) text = generateDemoResponse(model.id, trimmed);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(trimmed, text, model);
        return { model, response: text, latencyMs, score, isDemo, error: null };
      } catch (err) {
        console.error(`[${model.id}] room-analyze failed: ${err.message}`);
        const text = generateDemoResponse(model.id, trimmed);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(trimmed, text, model);
        return { model, response: text, latencyMs, score, isDemo: true, error: err.message };
      }
    }),
  );

  results.sort((a, b) => b.score - a.score);
  const winner = results[0];

  res.json({
    prompt: trimmed,
    results: results.map((r) => ({
      modelId:   r.model.id,
      name:      r.model.name,
      character: r.model.character,
      color:     r.model.color,
      emoji:     r.model.emoji,
      response:  r.response,
      score:     r.score,
      latencyMs: r.latencyMs,
      isDemo:    r.isDemo,
      error:     r.error || null,
      isWinner:  r.model.id === winner.model.id,
    })),
    winnerId:   winner.model.id,
    winnerName: winner.model.name,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Solana / Trading — constants and helpers
// ─────────────────────────────────────────────────────────────────────────────

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const DEFAULT_SLIPPAGE_BPS = 50;   // 0.5 % — sensible default for liquid pairs
const MAX_SLIPPAGE_BPS     = 5000; // 50 % — hard cap to protect users

const TRACKED_TOKENS = [
  { symbol: 'SOL',  mint: 'So11111111111111111111111111111111111111112',   decimals: 9 },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'JUP',  mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  decimals: 6 },
  { symbol: 'WIF',  mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6 },
  { symbol: 'RAY',  mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',  decimals: 6 },
];

function isValidSolanaAddress(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

async function fetchMarketData() {
  const mintList = TRACKED_TOKENS.map((t) => t.mint).join(',');

  // Jupiter Price API v2 (free, no auth required)
  const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${mintList}`, {
    headers: { Accept: 'application/json' },
  });
  if (!jupRes.ok) throw new Error(`Jupiter Price API HTTP ${jupRes.status}`);
  const jupData = await jupRes.json();

  // DexScreener for 24-h change / volume (free, no auth required)
  const dexRes = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${mintList}`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);
  const dexData = dexRes && dexRes.ok ? await dexRes.json().catch(() => ({})) : {};

  // Map each mint to the highest-liquidity DexScreener pair
  const dexByMint = {};
  if (Array.isArray(dexData.pairs)) {
    for (const pair of dexData.pairs) {
      const mint = pair.baseToken?.address;
      if (!mint) continue;
      if (!dexByMint[mint] || (pair.liquidity?.usd || 0) > (dexByMint[mint].liquidity?.usd || 0)) {
        dexByMint[mint] = pair;
      }
    }
  }

  return TRACKED_TOKENS.map((token) => {
    const priceInfo = jupData.data?.[token.mint];
    const dexPair   = dexByMint[token.mint] || null;
    return {
      symbol:    token.symbol,
      mint:      token.mint,
      price:     priceInfo?.price ?? null,
      change24h: dexPair?.priceChange?.h24 ?? null,
      volume24h: dexPair?.volume?.h24 ?? null,
      liquidity: dexPair?.liquidity?.usd ?? null,
      txns24h:   dexPair
        ? (dexPair.txns?.h24?.buys || 0) + (dexPair.txns?.h24?.sells || 0)
        : null,
    };
  });
}

async function fetchWalletPortfolio(walletAddress) {
  const rpcPost = (method, params) =>
    fetch(SOLANA_RPC_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }).then((r) => r.json());

  const [balRes, tokRes] = await Promise.all([
    rpcPost('getBalance', [walletAddress, { commitment: 'confirmed' }]),
    rpcPost('getTokenAccountsByOwner', [
      walletAddress,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]),
  ]);

  const solBalance = (balRes.result?.value ?? 0) / 1e9;
  const accounts   = tokRes.result?.value ?? [];

  const trackedMints = new Set(TRACKED_TOKENS.map((t) => t.mint));
  const tokens = accounts
    .filter((acc) => trackedMints.has(acc.account?.data?.parsed?.info?.mint))
    .map((acc) => {
      const info     = acc.account.data.parsed.info;
      const tokenDef = TRACKED_TOKENS.find((t) => t.mint === info.mint);
      return {
        symbol:   tokenDef?.symbol || info.mint.slice(0, 4),
        mint:     info.mint,
        amount:   info.tokenAmount?.uiAmount ?? 0,
        decimals: info.tokenAmount?.decimals ?? 0,
      };
    })
    .filter((t) => t.amount > 0);

  return { sol: solBalance, tokens };
}

function buildTradingPrompt(marketData, portfolio) {
  const priceLines = marketData
    .map((t) => {
      const price  = t.price     !== null ? `$${Number(t.price).toPrecision(6)}`                                                              : 'N/A';
      const change = t.change24h !== null ? `${t.change24h >= 0 ? '+' : ''}${Number(t.change24h).toFixed(2)}%`                               : 'N/A';
      const vol    = t.volume24h !== null ? `$${Number(t.volume24h).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'N/A';
      return `${t.symbol}: price=${price} | 24h=${change} | vol=${vol}`;
    })
    .join('\n');

  const portfolioSection = portfolio
    ? `WALLET HOLDINGS:\nSOL: ${portfolio.sol.toFixed(4)}\n` +
      (portfolio.tokens.length
        ? portfolio.tokens.map((t) => `${t.symbol}: ${t.amount}`).join('\n')
        : '(no tracked SPL tokens in wallet)')
    : 'WALLET: not connected';

  return (
    `You are an expert Solana DeFi trader and on-chain analyst. ` +
    `Analyze the following LIVE market data and provide a specific, actionable trading recommendation.\n\n` +
    `LIVE SOLANA MARKET DATA (UTC ${new Date().toISOString()}):\n${priceLines}\n\n` +
    `${portfolioSection}\n\n` +
    `Based on price action, momentum, volume, and risk management principles, ` +
    `provide your BEST trading recommendation in this EXACT format:\n` +
    `ACTION: [BUY/SELL/HOLD] [TOKEN]\n` +
    `ENTRY: $[price]\n` +
    `TARGET: $[price]\n` +
    `STOP: $[price]\n` +
    `RISK: [LOW/MEDIUM/HIGH]\n` +
    `SIZE: [X]% of portfolio\n` +
    `RATIONALE: [concise technical + sentiment analysis, 2–3 sentences]`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiters for Solana / trading endpoints
// ─────────────────────────────────────────────────────────────────────────────

const marketDataLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const portfolioLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const tradingAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const createSwapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/market-data — real-time Solana token prices + signals
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/market-data', marketDataLimiter, async (_req, res) => {
  try {
    const tokens = await fetchMarketData();
    res.json({ tokens, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[market-data]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/portfolio/:wallet — SOL + SPL token balances for a wallet
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/portfolio/:wallet', portfolioLimiter, async (req, res) => {
  const { wallet } = req.params;
  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }
  try {
    const portfolio = await fetchWalletPortfolio(wallet);
    res.json(portfolio);
  } catch (err) {
    console.error('[portfolio]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/trading-analysis — all 7 AI models analyze live market data
// and compete to give the best Solana trading recommendation
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/trading-analysis', tradingAnalysisLimiter, async (req, res) => {
  const { wallet } = req.body;
  if (wallet && !isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }

  let marketData, portfolio;
  try {
    [marketData, portfolio] = await Promise.all([
      fetchMarketData(),
      wallet ? fetchWalletPortfolio(wallet).catch(() => null) : Promise.resolve(null),
    ]);
  } catch (err) {
    console.error('[trading-analysis] market fetch failed:', err.message);
    return res.status(502).json({ error: `Failed to fetch market data: ${err.message}` });
  }

  const prompt = buildTradingPrompt(marketData, portfolio);
  const callers = { gpt4: callOpenAI, claude: callAnthropic, gemini: callGoogle, mistral: callMistral, copilot: callCopilot, grok: callXAI, ollama: callOllama };

  const results = await Promise.all(
    AI_MODELS.map(async (model) => {
      const start = Date.now();
      try {
        let text = await callers[model.id](prompt);
        const isDemo = text === null;
        if (isDemo) text = generateDemoResponse(model.id, prompt);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(prompt, text, model);
        return { model, response: text, latencyMs, score, isDemo, error: null };
      } catch (err) {
        console.error(`[${model.id}] trading-analysis failed: ${err.message}`);
        const text = generateDemoResponse(model.id, prompt);
        const latencyMs = Date.now() - start;
        const score = scoreResponse(prompt, text, model);
        return { model, response: text, latencyMs, score, isDemo: true, error: err.message };
      }
    }),
  );

  results.sort((a, b) => b.score - a.score);
  const winner = results[0];

  res.json({
    prompt,
    marketData,
    results: results.map((r) => ({
      modelId:   r.model.id,
      name:      r.model.name,
      character: r.model.character,
      color:     r.model.color,
      emoji:     r.model.emoji,
      response:  r.response,
      score:     r.score,
      latencyMs: r.latencyMs,
      isDemo:    r.isDemo,
      error:     r.error || null,
      isWinner:  r.model.id === winner.model.id,
    })),
    winnerId:   winner.model.id,
    winnerName: winner.model.name,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/create-swap — build an unsigned Jupiter V6 swap transaction.
// The browser (Phantom) will sign and submit it — the private key never leaves
// the client.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/create-swap', createSwapLimiter, async (req, res) => {
  const { inputMint, outputMint, amount, userPublicKey, slippageBps = DEFAULT_SLIPPAGE_BPS } = req.body;

  if (!isValidSolanaAddress(inputMint))     return res.status(400).json({ error: 'Invalid inputMint' });
  if (!isValidSolanaAddress(outputMint))    return res.status(400).json({ error: 'Invalid outputMint' });
  if (!isValidSolanaAddress(userPublicKey)) return res.status(400).json({ error: 'Invalid userPublicKey' });
  if (!Number.isInteger(amount) || amount <= 0)
    return res.status(400).json({ error: 'amount must be a positive integer (base units)' });

  // Restrict swaps to tracked tokens only
  const knownMints = new Set(TRACKED_TOKENS.map((t) => t.mint));
  if (!knownMints.has(inputMint))  return res.status(400).json({ error: 'inputMint not in tracked token list' });
  if (!knownMints.has(outputMint)) return res.status(400).json({ error: 'outputMint not in tracked token list' });

  const slippage = Math.max(0, Math.min(Number(slippageBps) || DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS));

  try {
    // Step 1: get a quote from Jupiter V6
    const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
    quoteUrl.searchParams.set('inputMint',      inputMint);
    quoteUrl.searchParams.set('outputMint',     outputMint);
    quoteUrl.searchParams.set('amount',         String(amount));
    quoteUrl.searchParams.set('slippageBps',    String(slippage));
    quoteUrl.searchParams.set('onlyDirectRoutes', 'false');

    const quoteRes  = await fetch(quoteUrl.toString(), { headers: { Accept: 'application/json' } });
    const quoteData = await quoteRes.json();
    if (!quoteRes.ok || quoteData.error)
      throw new Error(quoteData.error || `Jupiter quote HTTP ${quoteRes.status}`);

    // Step 2: build the unsigned swap transaction (base64-encoded VersionedTransaction)
    const swapRes  = await fetch('https://quote-api.jup.ag/v6/swap', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({
        quoteResponse:             quoteData,
        userPublicKey,
        wrapAndUnwrapSol:          true,
        dynamicComputeUnitLimit:   true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    const swapData = await swapRes.json();
    if (!swapRes.ok || swapData.error)
      throw new Error(swapData.error || `Jupiter swap HTTP ${swapRes.status}`);

    res.json({
      swapTransaction: swapData.swapTransaction,
      quote: {
        inputMint,
        outputMint,
        inAmount:        quoteData.inAmount,
        outAmount:       quoteData.outAmount,
        priceImpactPct:  quoteData.priceImpactPct,
        slippageBps:     slippage,
      },
    });
  } catch (err) {
    console.error('[create-swap]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter — protect the frontend catch-all from abuse
// ─────────────────────────────────────────────────────────────────────────────
const pageLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 120,              // generous limit for page loads
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ─────────────────────────────────────────────────────────────────────────────
// Serve frontend
// ─────────────────────────────────────────────────────────────────────────────
app.get('*', pageLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AI Ring server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, scoreResponse, generateDemoResponse, buildRoomAnalysisPrompt, buildTradingPrompt, AI_MODELS, DEMO_TEMPLATES, TRACKED_TOKENS, isValidSolanaAddress };
