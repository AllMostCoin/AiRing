'use strict';

/**
 * Integration tests for all Express API routes in server.js.
 * node-fetch is mocked so no real network calls are made.
 */

jest.mock('node-fetch');

const request = require('supertest');
const fetch   = require('node-fetch');
const { app } = require('../server');

// Helper: build a minimal OpenAI-compatible success response (choices array)
function mockChoicesResponse(content) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  };
}

// Helper: build a minimal Anthropic success response (content array)
function mockAnthropicResponse(text) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      content: [{ text }],
    }),
  };
}

// Helper: build a minimal Google / Gemini success response
function mockGeminiResponse(text) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

// Helper: build an error response from an AI API
function mockErrorResponse(status, message) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: jest.fn().mockResolvedValue({ error: { message } }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/models
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/models', () => {
  beforeEach(() => {
    // Ensure no API keys are set
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.XAI_API_KEY;
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_BASE_URL;
  });

  it('responds 200 with models array and configured flags', async () => {
    const res = await request(app).get('/api/models');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models).toHaveLength(7);
    expect(res.body.configured).toBeDefined();
  });

  it('reports demoMode:true when no keys are configured', async () => {
    const res = await request(app).get('/api/models');
    expect(res.body.demoMode).toBe(true);
    expect(Object.values(res.body.configured).every((v) => !v)).toBe(true);
  });

  it('reports demoMode:false when at least one key is configured', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const res = await request(app).get('/api/models');
    expect(res.body.demoMode).toBe(false);
    expect(res.body.configured.gpt4).toBe(true);
    delete process.env.OPENAI_API_KEY;
  });

  it('reports configured flags accurately for each provider', async () => {
    process.env.GOOGLE_API_KEY = 'google-key';
    process.env.MISTRAL_API_KEY = 'mistral-key';
    const res = await request(app).get('/api/models');
    expect(res.body.configured.gemini).toBe(true);
    expect(res.body.configured.mistral).toBe(true);
    expect(res.body.configured.gpt4).toBe(false);
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
  });

  it('treats OLLAMA_BASE_URL alone as ollama configured', async () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const res = await request(app).get('/api/models');
    expect(res.body.configured.ollama).toBe(true);
    delete process.env.OLLAMA_BASE_URL;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/grok-proxy
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/grok-proxy', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/grok-proxy').send({ key: 'xai-testkey' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns 400 when prompt is empty', async () => {
    const res = await request(app).post('/api/grok-proxy').send({ prompt: '   ', key: 'xai-testkey' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/grok-proxy')
      .send({ prompt: 'a'.repeat(2001), key: 'xai-testkey' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it('returns 400 when key is missing', async () => {
    const res = await request(app).post('/api/grok-proxy').send({ prompt: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/xai-/i);
  });

  it('returns 400 when key does not start with xai-', async () => {
    const res = await request(app)
      .post('/api/grok-proxy')
      .send({ prompt: 'hello', key: 'bad-key' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/xai-/i);
  });

  it('returns 200 with text on successful proxied call', async () => {
    fetch.mockResolvedValueOnce(mockChoicesResponse('Grok says hello'));
    const res = await request(app)
      .post('/api/grok-proxy')
      .send({ prompt: 'hello', key: 'xai-validkey123' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Grok says hello');
  });

  it('returns 502 when the upstream API returns an error', async () => {
    fetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API key'));
    const res = await request(app)
      .post('/api/grok-proxy')
      .send({ prompt: 'hello', key: 'xai-badkey' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
  });

  it('returns 502 when fetch throws (network error)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'));
    const res = await request(app)
      .post('/api/grok-proxy')
      .send({ prompt: 'hello', key: 'xai-netfail' });
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ollama-proxy
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/ollama-proxy', () => {
  beforeEach(() => {
    delete process.env.OLLAMA_BASE_URL;
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/ollama-proxy').send({ key: 'llama3.2' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when model name (key) is missing', async () => {
    const res = await request(app).post('/api/ollama-proxy').send({ prompt: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/model/i);
  });

  it('returns 400 when model name is blank', async () => {
    const res = await request(app).post('/api/ollama-proxy').send({ prompt: 'hello', key: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'x'.repeat(2001), key: 'llama3.2' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when user-supplied URL is not a valid URL', async () => {
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'hello', key: 'llama3.2', url: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid URL/i);
  });

  it('returns 400 when user-supplied URL uses http:// (SSRF protection)', async () => {
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'hello', key: 'llama3.2', url: 'http://localhost:11434' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/https/i);
  });

  it('accepts a valid https:// user URL and proxies the call', async () => {
    fetch.mockResolvedValueOnce(mockChoicesResponse('Ollama output'));
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'hello', key: 'llama3.2', url: 'https://my-ollama.example.com' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Ollama output');
  });

  it('uses server OLLAMA_BASE_URL (ignores user url when env is set)', async () => {
    process.env.OLLAMA_BASE_URL = 'http://internal:11434';
    fetch.mockResolvedValueOnce(mockChoicesResponse('Server ollama'));
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'hello', key: 'llama3.2', url: 'http://attacker.com' });
    // Should succeed using server URL, not error on the http:// client URL
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Server ollama');
    delete process.env.OLLAMA_BASE_URL;
  });

  it('returns 502 when upstream API returns an error', async () => {
    fetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal server error'));
    const res = await request(app)
      .post('/api/ollama-proxy')
      .send({ prompt: 'hello', key: 'llama3.2', url: 'https://my-ollama.example.com' });
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/openai-proxy
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/openai-proxy', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/openai-proxy').send({ key: 'sk-test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when key does not start with sk-', async () => {
    const res = await request(app)
      .post('/api/openai-proxy')
      .send({ prompt: 'hello', key: 'bad-key' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sk-/i);
  });

  it('returns 400 when key is missing', async () => {
    const res = await request(app).post('/api/openai-proxy').send({ prompt: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/openai-proxy')
      .send({ prompt: 'a'.repeat(2001), key: 'sk-test' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with text on success', async () => {
    fetch.mockResolvedValueOnce(mockChoicesResponse('GPT-4 response'));
    const res = await request(app)
      .post('/api/openai-proxy')
      .send({ prompt: 'hello', key: 'sk-validkey' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('GPT-4 response');
  });

  it('returns 502 when upstream API returns an error', async () => {
    fetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limit exceeded'));
    const res = await request(app)
      .post('/api/openai-proxy')
      .send({ prompt: 'hello', key: 'sk-ratelimited' });
    expect(res.status).toBe(502);
  });

  it('returns 502 when response has no choices', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ choices: [] }),
    });
    const res = await request(app)
      .post('/api/openai-proxy')
      .send({ prompt: 'hello', key: 'sk-nochoices' });
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mistral-proxy
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/mistral-proxy', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/mistral-proxy').send({ key: 'mistral-key' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when key is missing or blank', async () => {
    const res = await request(app).post('/api/mistral-proxy').send({ prompt: 'hello', key: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/mistral-proxy')
      .send({ prompt: 'a'.repeat(2001), key: 'mistral-key' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with text on success', async () => {
    fetch.mockResolvedValueOnce(mockChoicesResponse('Mistral output'));
    const res = await request(app)
      .post('/api/mistral-proxy')
      .send({ prompt: 'hello', key: 'mistral-key' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Mistral output');
  });

  it('returns 502 on upstream error', async () => {
    fetch.mockResolvedValueOnce(mockErrorResponse(403, 'Forbidden'));
    const res = await request(app)
      .post('/api/mistral-proxy')
      .send({ prompt: 'hello', key: 'mistral-key' });
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/copilot-proxy
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/copilot-proxy', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/copilot-proxy').send({ key: 'ghp_token' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when key is missing', async () => {
    const res = await request(app).post('/api/copilot-proxy').send({ prompt: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/copilot-proxy')
      .send({ prompt: 'a'.repeat(2001), key: 'ghp_token' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with text on success', async () => {
    fetch.mockResolvedValueOnce(mockChoicesResponse('Copilot response'));
    const res = await request(app)
      .post('/api/copilot-proxy')
      .send({ prompt: 'hello', key: 'ghp_token' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Copilot response');
  });

  it('returns 502 on upstream error', async () => {
    fetch.mockResolvedValueOnce(mockErrorResponse(401, 'Unauthorized'));
    const res = await request(app)
      .post('/api/copilot-proxy')
      .send({ prompt: 'hello', key: 'ghp_token' });
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compete
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/compete', () => {
  beforeEach(() => {
    // Clear all API keys so all models fall back to demo mode
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.XAI_API_KEY;
    delete process.env.OLLAMA_MODEL;
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/compete').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns 400 when prompt is empty / whitespace-only', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app)
      .post('/api/compete')
      .send({ prompt: 'z'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it('returns 200 with 7 demo results when no keys configured', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: 'What is AI?' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(7);
    expect(res.body.results.every((r) => r.isDemo)).toBe(true);
  });

  it('response includes required top-level fields', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: 'test prompt' });
    expect(res.body).toHaveProperty('prompt');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('winnerId');
    expect(res.body).toHaveProperty('winnerName');
  });

  it('each result has required per-model fields', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: 'test' });
    const REQUIRED = ['modelId', 'name', 'character', 'color', 'emoji', 'response', 'score', 'latencyMs', 'isDemo', 'isWinner'];
    for (const result of res.body.results) {
      for (const field of REQUIRED) {
        expect(result).toHaveProperty(field);
      }
    }
  });

  it('exactly one result has isWinner:true', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: 'test' });
    const winners = res.body.results.filter((r) => r.isWinner);
    expect(winners).toHaveLength(1);
    expect(winners[0].modelId).toBe(res.body.winnerId);
  });

  it('results are sorted by score descending', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: 'coding analysis task' });
    const scores = res.body.results.map((r) => r.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it('prompt is echoed back in response', async () => {
    const prompt = 'unique test prompt xyz';
    const res = await request(app).post('/api/compete').send({ prompt });
    expect(res.body.prompt).toBe(prompt);
  });

  it('trims leading/trailing whitespace from prompt', async () => {
    const res = await request(app).post('/api/compete').send({ prompt: '  hello world  ' });
    expect(res.body.prompt).toBe('hello world');
  });

  it('gracefully returns demo mode even when a model caller throws', async () => {
    // Set a key so at least one model tries a real call, then make fetch throw
    process.env.OPENAI_API_KEY = 'sk-throwkey';
    fetch.mockRejectedValue(new Error('Simulated network error'));
    const res = await request(app).post('/api/compete').send({ prompt: 'What is AI?' });
    // Should still return 200 with all 7 results in demo mode
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(7);
    const gpt4 = res.body.results.find((r) => r.modelId === 'gpt4');
    expect(gpt4.isDemo).toBe(true);
    expect(gpt4.error).toBeTruthy();
    delete process.env.OPENAI_API_KEY;
  });

  it('returns a live (non-demo) result for a model with a valid key + mocked fetch', async () => {
    process.env.OPENAI_API_KEY = 'sk-livekey';
    // The compete route calls callOpenAI → callGoogle → etc.
    // GPT-4's fetch call must succeed; all others will also call fetch if keyed.
    // Use mockResolvedValue (not Once) so every fetch call returns this response.
    fetch.mockResolvedValue(mockChoicesResponse('Live GPT-4 answer'));
    const res = await request(app).post('/api/compete').send({ prompt: 'What is AI?' });
    expect(res.status).toBe(200);
    const gpt4 = res.body.results.find((r) => r.modelId === 'gpt4');
    expect(gpt4.isDemo).toBe(false);
    expect(gpt4.response).toBe('Live GPT-4 answer');
    delete process.env.OPENAI_API_KEY;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/room-analyze
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_INITIAL_RESULTS = [
  { modelId: 'gpt4',    name: 'GPT-4',   response: 'GPT-4 initial answer about AI.' },
  { modelId: 'claude',  name: 'Claude',  response: 'Claude initial answer about AI.' },
  { modelId: 'gemini',  name: 'Gemini',  response: 'Gemini initial answer about AI.' },
  { modelId: 'mistral', name: 'Mistral', response: 'Mistral initial answer about AI.' },
  { modelId: 'copilot', name: 'Copilot', response: 'Copilot initial answer about AI.' },
  { modelId: 'grok',    name: 'Grok',    response: 'Grok initial answer about AI.' },
  { modelId: 'ollama',  name: 'Ollama',  response: 'Ollama initial answer about AI.' },
];

describe('POST /api/room-analyze', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.XAI_API_KEY;
    delete process.env.OLLAMA_MODEL;
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/room-analyze').send({ results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns 400 when prompt is empty', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: '   ', results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 2000 characters', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'z'.repeat(2001), results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it('returns 400 when results array is missing', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'What is AI?' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/results/i);
  });

  it('returns 400 when results array is empty', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'What is AI?', results: [] });
    expect(res.status).toBe(400);
  });

  it('returns 200 with 7 demo results when no API keys configured', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'What is AI?', results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(7);
    expect(res.body.results.every((r) => r.isDemo)).toBe(true);
  });

  it('response includes required top-level fields', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'test prompt', results: SAMPLE_INITIAL_RESULTS });
    expect(res.body).toHaveProperty('prompt');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('winnerId');
    expect(res.body).toHaveProperty('winnerName');
  });

  it('each result has required per-model fields', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'test', results: SAMPLE_INITIAL_RESULTS });
    const REQUIRED = ['modelId', 'name', 'character', 'color', 'emoji', 'response', 'score', 'latencyMs', 'isDemo', 'isWinner'];
    for (const result of res.body.results) {
      for (const field of REQUIRED) {
        expect(result).toHaveProperty(field);
      }
    }
  });

  it('exactly one result has isWinner:true', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'test', results: SAMPLE_INITIAL_RESULTS });
    const winners = res.body.results.filter((r) => r.isWinner);
    expect(winners).toHaveLength(1);
    expect(winners[0].modelId).toBe(res.body.winnerId);
  });

  it('results are sorted by score descending', async () => {
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'coding analysis task', results: SAMPLE_INITIAL_RESULTS });
    const scores = res.body.results.map((r) => r.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it('prompt is echoed back in response', async () => {
    const prompt = 'unique room analysis prompt xyz';
    const res = await request(app).post('/api/room-analyze').send({ prompt, results: SAMPLE_INITIAL_RESULTS });
    expect(res.body.prompt).toBe(prompt);
  });

  it('returns a live result for a model with a valid key + mocked fetch', async () => {
    process.env.OPENAI_API_KEY = 'sk-livekey';
    fetch.mockResolvedValue(mockChoicesResponse('Live GPT-4 room analysis answer'));
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'What is AI?', results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(200);
    const gpt4 = res.body.results.find((r) => r.modelId === 'gpt4');
    expect(gpt4.isDemo).toBe(false);
    expect(gpt4.response).toBe('Live GPT-4 room analysis answer');
    delete process.env.OPENAI_API_KEY;
  });

  it('gracefully falls back to demo when a model caller throws', async () => {
    process.env.OPENAI_API_KEY = 'sk-throwkey';
    fetch.mockRejectedValue(new Error('Simulated network error'));
    const res = await request(app).post('/api/room-analyze').send({ prompt: 'What is AI?', results: SAMPLE_INITIAL_RESULTS });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(7);
    const gpt4 = res.body.results.find((r) => r.modelId === 'gpt4');
    expect(gpt4.isDemo).toBe(true);
    delete process.env.OPENAI_API_KEY;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Catch-all — frontend serving
// ─────────────────────────────────────────────────────────────────────────────

describe('GET unknown routes', () => {
  it('serves the frontend HTML for unknown paths', async () => {
    const res = await request(app).get('/some/unknown/path');
    // The file may or may not exist in the test environment, but the route
    // should either return HTML (200) or a sendFile error (not 404 from Express
    // routing — the catch-all always hits).
    expect([200, 500]).toContain(res.status);
  });
});
