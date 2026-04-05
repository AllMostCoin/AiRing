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
    id: 'deepseek',
    name: 'DeepSeek',
    character: 'Yuffie',
    provider: 'deepseek',
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
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

async function callDeepSeek(prompt, key) {
  // DeepSeek — OpenAI-compatible endpoint
  // key may be supplied by the caller (proxy route) or read from the environment.
  const resolvedKey = key || process.env.DEEPSEEK_API_KEY;
  if (!resolvedKey) return null;
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${data.error?.message || res.statusText}`);
  if (!data.choices?.length || !data.choices[0]?.message?.content) throw new Error('DeepSeek returned no content');
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
  deepseek: [
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
});

const deepseekProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
});

const competeLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 20,               // max 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
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
    deepseek: !!process.env.DEEPSEEK_API_KEY,
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
// Route: POST /api/deepseek-proxy — proxy a user-supplied DeepSeek key through the backend
// Browsers cannot call api.deepseek.com directly (no CORS headers). This endpoint
// accepts the user's personal key in the request body, forwards the call
// server-side (CORS-free), and returns the text response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/deepseek-proxy', deepseekProxyLimiter, async (req, res) => {
  const { prompt, key } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  if (!key || typeof key !== 'string' || !key.trim().startsWith('ck_')) {
    return res.status(400).json({ error: 'valid DeepSeek API key is required (must start with ck_)' });
  }
  const trimmedKey = key.trim();
  try {
    const text = await callDeepSeek(trimmedPrompt, trimmedKey);
    if (text === null) {
      return res.status(502).json({ error: 'DeepSeek API did not return a response' });
    }
    res.json({ text });
  } catch (err) {
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

  const callers = { gpt4: callOpenAI, claude: callAnthropic, gemini: callGoogle, mistral: callMistral, copilot: callCopilot, grok: callXAI, deepseek: callDeepSeek };

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
// Rate limiter — protect the frontend catch-all from abuse
// ─────────────────────────────────────────────────────────────────────────────
const pageLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 120,              // generous limit for page loads
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a moment.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Serve frontend
// ─────────────────────────────────────────────────────────────────────────────
app.get('*', pageLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AI Ring server running at http://localhost:${PORT}`);
});
