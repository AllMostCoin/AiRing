'use strict';

/**
 * Tests for the pure utility functions in docs/utils.js.
 * These functions are shared between the browser runtime and the Node.js
 * test environment via the CommonJS export at the bottom of that file.
 */

const { liveCallHint, isInvalidKeyError, escapeHtml, shuffleArray } = require('../docs/utils');

// ─────────────────────────────────────────────────────────────────────────────
// liveCallHint
// ─────────────────────────────────────────────────────────────────────────────

describe('liveCallHint', () => {
  it('returns a credit/quota hint for "credit" errors', () => {
    const hint = liveCallHint('insufficient_credits: top up your account');
    expect(hint).toContain('credit balance low or quota exceeded');
  });

  it('returns a credit/quota hint for "quota" errors', () => {
    const hint = liveCallHint('quota exceeded');
    expect(hint).toContain('credit balance low or quota exceeded');
  });

  it('is case-insensitive for credit/quota matching', () => {
    expect(liveCallHint('CREDIT error')).toContain('credit balance');
    expect(liveCallHint('QUOTA limit')).toContain('credit balance');
  });

  it('returns an invalid-key hint for 401 errors', () => {
    const hint = liveCallHint('HTTP 401 Unauthorized');
    expect(hint).toContain('key may be invalid or revoked');
  });

  it('returns an invalid-key hint for 403 errors', () => {
    expect(liveCallHint('403 Forbidden')).toContain('key may be invalid or revoked');
  });

  it('returns an invalid-key hint for "unauthorized" in the message', () => {
    expect(liveCallHint('unauthorized request')).toContain('key may be invalid or revoked');
  });

  it('returns an invalid-key hint for "invalid" in the message', () => {
    expect(liveCallHint('invalid API key')).toContain('key may be invalid or revoked');
  });

  it('returns an invalid-key hint for "forbidden" in the message', () => {
    expect(liveCallHint('Access forbidden')).toContain('key may be invalid or revoked');
  });

  it('is case-insensitive for auth-error matching', () => {
    expect(liveCallHint('UNAUTHORIZED')).toContain('key may be invalid');
    expect(liveCallHint('FORBIDDEN')).toContain('key may be invalid');
    expect(liveCallHint('INVALID key')).toContain('key may be invalid');
  });

  it('returns an empty string for unrecognised errors', () => {
    expect(liveCallHint('network timeout')).toBe('');
    expect(liveCallHint('unexpected end of JSON input')).toBe('');
    expect(liveCallHint('')).toBe('');
  });

  it('credit/quota takes priority over auth keywords when both are present', () => {
    // If a message somehow contains both, credit/quota path fires first
    const hint = liveCallHint('credit quota 401 invalid');
    expect(hint).toContain('credit balance low or quota exceeded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isInvalidKeyError
// ─────────────────────────────────────────────────────────────────────────────

describe('isInvalidKeyError', () => {
  it('returns true for a message containing "401"', () => {
    expect(isInvalidKeyError('HTTP 401 Unauthorized')).toBe(true);
  });

  it('returns true for a message containing "403"', () => {
    expect(isInvalidKeyError('403 Forbidden')).toBe(true);
  });

  it('returns true for "unauthorized"', () => {
    expect(isInvalidKeyError('unauthorized')).toBe(true);
  });

  it('returns true for "invalid"', () => {
    expect(isInvalidKeyError('invalid API key')).toBe(true);
  });

  it('returns true for "forbidden"', () => {
    expect(isInvalidKeyError('forbidden resource')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isInvalidKeyError('INVALID KEY')).toBe(true);
    expect(isInvalidKeyError('FORBIDDEN')).toBe(true);
    expect(isInvalidKeyError('UNAUTHORIZED')).toBe(true);
  });

  it('returns false for credit/quota errors', () => {
    expect(isInvalidKeyError('credit balance low')).toBe(false);
    expect(isInvalidKeyError('quota exceeded')).toBe(false);
  });

  it('returns false for network/transient errors', () => {
    expect(isInvalidKeyError('Network failure')).toBe(false);
    expect(isInvalidKeyError('timeout')).toBe(false);
    expect(isInvalidKeyError('Internal Server Error')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isInvalidKeyError('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// escapeHtml
// ─────────────────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('3 > 2')).toBe('3 &gt; 2');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('escapes a combination of special characters', () => {
    const input  = '<script>alert("XSS & fun")</script>';
    const output = escapeHtml(input);
    expect(output).toBe('&lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&lt;/script&gt;');
  });

  it('returns the same string when there is nothing to escape', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes all occurrences (not just the first)', () => {
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shuffleArray
// ─────────────────────────────────────────────────────────────────────────────

describe('shuffleArray', () => {
  it('returns an array with the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort()).toEqual([...original].sort());
  });

  it('does not mutate the original array', () => {
    const original = [10, 20, 30];
    const copy     = [...original];
    shuffleArray(original);
    expect(original).toEqual(copy);
  });

  it('handles an empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });

  it('returns a new array (not the same reference)', () => {
    const original = [1, 2, 3];
    const shuffled = shuffleArray(original);
    expect(shuffled).not.toBe(original);
  });

  it('produces all permutations over many trials (randomness smoke test)', () => {
    // For a 3-element array there are 6 permutations.
    // Over 200 trials at least 2 distinct orderings should appear.
    const original = [1, 2, 3];
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      seen.add(shuffleArray(original).join(','));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
