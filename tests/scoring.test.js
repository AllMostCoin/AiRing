'use strict';

/**
 * Tests for the scoring / demo-response logic in server.js.
 *
 * The identical logic is also present in docs/app.js (client-side copy).
 * Testing here therefore gives effective coverage of both implementations.
 */

const { scoreResponse, generateDemoResponse, buildRoomAnalysisPrompt, AI_MODELS, DEMO_TEMPLATES } = require('../server');

// ─────────────────────────────────────────────────────────────────────────────
// scoreResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreResponse', () => {
  const noStrengthModel = { strengths: [] };

  it('returns a non-negative integer', () => {
    const score = scoreResponse('hello world', 'hello world response', noStrengthModel);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('awards keyword-match points for each prompt word found in response', () => {
    // Prompt has 2 long-enough words: "coding" (6) and "techniques" (10).
    // Response repeats both words twice each → 4 matches × 2 pts = 8 pts.
    const model = { strengths: [] };
    const score = scoreResponse(
      'coding techniques',
      'Here are coding techniques. These coding techniques are useful.',
      model,
    );
    // keyword score must account for "coding" × 2 and "techniques" × 2
    const baseline = scoreResponse('coding techniques', 'no overlap here ever', model);
    expect(score).toBeGreaterThan(baseline);
  });

  it('ignores prompt words that are 3 characters or shorter', () => {
    // "the" and "cat" are ≤3 chars and should not count as keywords.
    const score = scoreResponse('the cat sat', 'the cat sat the cat sat', noStrengthModel);
    // Length bonus only — no keyword bonus for short words
    const lengthOnly = Math.min('the cat sat the cat sat'.length / 20, 30);
    expect(score).toBeLessThanOrEqual(Math.round(lengthOnly) + 10); // +10 slack
  });

  it('applies a length bonus capped at SCORE_LENGTH_CAP (30)', () => {
    // A very long response should not exceed the cap
    const longResponse = 'a'.repeat(10000);
    const score = scoreResponse('test', longResponse, noStrengthModel);
    // score = 0 keyword + 30 (capped) + 0 structure (no \n, list, :)
    expect(score).toBe(30);
  });

  it('awards a newline bonus for multi-paragraph responses', () => {
    const withNewline    = scoreResponse('test', 'line one\nline two', noStrengthModel);
    const withoutNewline = scoreResponse('test', 'line one line two', noStrengthModel);
    expect(withNewline).toBeGreaterThan(withoutNewline);
  });

  it('awards a list bonus for numbered lists (digit-dot or digit-paren)', () => {
    const withList    = scoreResponse('test', '1. First\n2. Second', noStrengthModel);
    const withoutList = scoreResponse('test', 'First Second', noStrengthModel);
    expect(withList).toBeGreaterThan(withoutList);
  });

  it('awards a colon bonus for structured key:value content', () => {
    const withColon    = scoreResponse('test', 'Key: value', noStrengthModel);
    const withoutColon = scoreResponse('test', 'Key value', noStrengthModel);
    expect(withColon).toBeGreaterThan(withoutColon);
  });

  it('awards strength bonus when prompt contains a model strength keyword', () => {
    const codingModel = { strengths: ['coding'] };
    const withStrength    = scoreResponse('coding problem', 'response text', codingModel);
    const withoutStrength = scoreResponse('writing problem', 'response text', codingModel);
    expect(withStrength).toBeGreaterThan(withoutStrength);
  });

  it('awards multiple strength bonuses for multiple matching keywords', () => {
    const model = { strengths: ['coding', 'analysis'] };
    const double = scoreResponse('coding analysis task', 'text', model);
    const single = scoreResponse('coding task only',     'text', model);
    expect(double).toBeGreaterThan(single);
  });

  it('strength match is case-insensitive on the prompt', () => {
    const model = { strengths: ['coding'] };
    const upperScore = scoreResponse('CODING challenge', 'text', model);
    const lowerScore = scoreResponse('coding challenge', 'text', model);
    expect(upperScore).toBe(lowerScore);
  });

  it('returns 0 for an empty response against an empty prompt', () => {
    const score = scoreResponse('', '', noStrengthModel);
    expect(score).toBe(0);
  });

  it('accumulated structure bonuses stack on top of keyword score', () => {
    const model = { strengths: [] };
    // Response with newline + list + colon
    const rich = scoreResponse('analysis', '1. analysis:\npoint two', model);
    // Response with none of those
    const plain = scoreResponse('analysis', 'analysis here', model);
    expect(rich).toBeGreaterThan(plain);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateDemoResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('generateDemoResponse', () => {
  const MODEL_IDS = Object.keys(DEMO_TEMPLATES);

  it('is defined for every AI model', () => {
    const serverModelIds = AI_MODELS.map((m) => m.id);
    for (const id of serverModelIds) {
      expect(DEMO_TEMPLATES[id]).toBeDefined();
    }
  });

  it('returns a non-empty string for each model', () => {
    for (const id of MODEL_IDS) {
      const result = generateDemoResponse(id, 'What is AI?');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('injects the prompt topic into the response', () => {
    const prompt = 'machine learning';
    for (const id of MODEL_IDS) {
      const result = generateDemoResponse(id, prompt);
      // The topic (quoted) should appear somewhere in the output
      expect(result).toContain(`"${prompt}"`);
    }
  });

  it('truncates prompts longer than 40 characters and appends ellipsis', () => {
    const longPrompt = 'a'.repeat(50);
    for (const id of MODEL_IDS) {
      const result = generateDemoResponse(id, longPrompt);
      expect(result).toContain('"' + 'a'.repeat(40) + '..."');
    }
  });

  it('does not truncate prompts of exactly 40 characters', () => {
    const prompt = 'b'.repeat(40);
    for (const id of MODEL_IDS) {
      const result = generateDemoResponse(id, prompt);
      expect(result).toContain(`"${prompt}"`);
      expect(result).not.toContain('...');
    }
  });

  it('replaces ALL occurrences of {topic} in a template', () => {
    // Patch a template temporarily to include {topic} twice
    const id = MODEL_IDS[0];
    const original = DEMO_TEMPLATES[id];
    DEMO_TEMPLATES[id] = ['{topic} and {topic}'];
    const result = generateDemoResponse(id, 'test');
    DEMO_TEMPLATES[id] = original; // restore
    // Both occurrences should be replaced
    expect(result).toBe('"test" and "test"');
  });

  it('each model has at least one template', () => {
    for (const id of MODEL_IDS) {
      expect(Array.isArray(DEMO_TEMPLATES[id])).toBe(true);
      expect(DEMO_TEMPLATES[id].length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AI_MODELS structure
// ─────────────────────────────────────────────────────────────────────────────

describe('AI_MODELS', () => {
  it('contains exactly 7 models', () => {
    expect(AI_MODELS).toHaveLength(7);
  });

  const REQUIRED_FIELDS = ['id', 'name', 'character', 'provider', 'color', 'emoji', 'strengths'];

  it.each(AI_MODELS.map((m) => [m.id, m]))(
    'model %s has all required fields',
    (_id, model) => {
      for (const field of REQUIRED_FIELDS) {
        expect(model).toHaveProperty(field);
      }
    },
  );

  it('each model has a non-empty strengths array', () => {
    for (const model of AI_MODELS) {
      expect(Array.isArray(model.strengths)).toBe(true);
      expect(model.strengths.length).toBeGreaterThan(0);
    }
  });

  it('all model ids are unique', () => {
    const ids = AI_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRoomAnalysisPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRoomAnalysisPrompt', () => {
  const otherResponses = [
    { name: 'Claude',  response: 'Claude says hello.' },
    { name: 'Gemini',  response: 'Gemini says hi.' },
  ];

  it('includes the original prompt in the output', () => {
    const result = buildRoomAnalysisPrompt('What is AI?', 'GPT-4', otherResponses);
    expect(result).toContain('What is AI?');
  });

  it('includes the model name in the output', () => {
    const result = buildRoomAnalysisPrompt('What is AI?', 'GPT-4', otherResponses);
    expect(result).toContain('GPT-4');
  });

  it('includes the other models\' names and responses', () => {
    const result = buildRoomAnalysisPrompt('test prompt', 'Mistral', otherResponses);
    expect(result).toContain('Claude');
    expect(result).toContain('Claude says hello.');
    expect(result).toContain('Gemini');
    expect(result).toContain('Gemini says hi.');
  });

  it('returns a non-empty string', () => {
    const result = buildRoomAnalysisPrompt('hello', 'Grok', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('works with an empty other-responses list', () => {
    expect(() => buildRoomAnalysisPrompt('test', 'Ollama', [])).not.toThrow();
  });
});
