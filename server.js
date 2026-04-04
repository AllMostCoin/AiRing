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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${data.error?.message || res.statusText}`);
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
  return data.candidates[0].content.parts[0].text.trim();
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
// Rate limiter — protect the competition endpoint from abuse
// ─────────────────────────────────────────────────────────────────────────────
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
    gpt4:    !!process.env.OPENAI_API_KEY,
    claude:  !!process.env.ANTHROPIC_API_KEY,
    gemini:  !!process.env.GOOGLE_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    copilot: !!process.env.GITHUB_TOKEN,
  };
  res.json({ models: AI_MODELS, configured, demoMode: Object.values(configured).every((v) => !v) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/compete — run the competition
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/compete', competeLimiter, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (prompt.trim().length > 2000) {
    return res.status(400).json({ error: 'prompt must be 2000 characters or fewer' });
  }
  const trimmed = prompt.trim();

  const callers = { gpt4: callOpenAI, claude: callAnthropic, gemini: callGoogle, mistral: callMistral, copilot: callCopilot };

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
