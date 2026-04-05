/* ═══════════════════════════════════════════════════════════════
   AI Ring — Shared Browser Utilities
   Pure, DOM-independent helpers used by app.js.
   Also exported for Node.js test consumption via module.exports.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// Returns a user-facing hint string for a failed live-call error.
// Credit/quota errors preserve the key (the key is valid; user needs to top up).
// Invalid/revoked key errors suggest using CLEAR.
function liveCallHint(errMessage) {
  if (/credit|quota/i.test(errMessage)) {
    return ' — credit balance low or quota exceeded. Top up your account to restore live mode.';
  }
  if (/401|403|unauthorized|invalid|forbidden/i.test(errMessage)) {
    return ' — key may be invalid or revoked. Hit CLEAR to remove it.';
  }
  return '';
}

// Returns true only when the error indicates the key itself is invalid/revoked
// (i.e., auto-clearing it is appropriate). Credit/quota errors are NOT included
// because the key is valid — the user just needs to fund their account.
function isInvalidKeyError(errMessage) {
  return /401|403|unauthorized|invalid|forbidden/i.test(errMessage);
}

// Escapes special HTML characters to prevent XSS when inserting user-supplied
// content into innerHTML.
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Unbiased Fisher-Yates shuffle — returns a new shuffled array without
// mutating the original.
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Export for Node.js (tests); in the browser these functions are global
// because the script is loaded before app.js.
if (typeof module !== 'undefined') {
  module.exports = { liveCallHint, isInvalidKeyError, escapeHtml, shuffleArray };
}
