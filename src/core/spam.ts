/**
 * spam.ts
 *
 * Spam detection.
 *
 * CRITICAL DESIGN DECISION:
 *   URL and domain patterns MUST run on the raw (or NFKC-only) text.
 *   If you normalize first (stripping dots, slashes, colons), URLs become
 *   undetectable. "https://spam.com" → after skeleton → "httpsspamcom" which
 *   no URL regex can match.
 *
 *   So: keyword spam runs on skeleton (catches leet evasion),
 *       URL/domain spam runs on NFKC-normalized raw text only.
 */

import { toSkeleton } from './normalize.js';
import type { SpamStrictness } from '../types.js';

// ─── Keyword spam — run on skeleton ──────────────────────────────────────────
// IMPORTANT: skeleton strips spaces to single space, so multi-word patterns
// must use \s+ not \s* (skeleton never has zero spaces between real words).
// "free money" → skeleton → "free money" (space preserved between words)
const KEYWORD_PATTERNS: RegExp[] = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bcasino\b/i,
  /\bpoker\b/i,
  /\bfree\s+money\b/i,       // skeleton preserves spaces between words
  /\bbuy\s+now\b/i,
  /\bclick\s+here\b/i,
  /\blorem\s+ipsum\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bmake\s+money\b/i,
  /\bget\s+rich\b/i,
  /\bonlyfans\b/i,            // skeleton collapses "only fans" → "only fans" but domain is onlyfans
];

// ─── URL / domain patterns — run on raw (NFKC-normalized) text ───────────────
const URL_PATTERNS: RegExp[] = [
  // Full URLs
  /https?:\/\/[^\s]{4,}/i,
  // Bare domains with common TLDs (not preceded by a letter — avoids "version2.0")
  /(?<![a-z])\b[a-z0-9]([a-z0-9-]{1,61})\.(com|net|org|io|xyz|ru|cn|co|info|biz|me|gg|app|dev|uk|de|fr)\b/i,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

/**
 * Returns true if text contains spam keywords (checked on skeleton)
 * or URLs/domains (checked on NFKC-only normalized text).
 *
 * @param text - The text to check
 * @param options.strictness - 'low' (keywords only) or 'normal' (keywords + links)
 */
export function containsSpam(text: string, options: { strictness?: SpamStrictness } = {}): boolean {
  const strictness = options.strictness ?? 'normal';
  const skeleton = toSkeleton(text);
  const nfkc = text.normalize('NFKC'); // preserves punctuation — ! stays !, not 'i'

  // Keywords: run on NFKC (not skeleton) so trailing punctuation like "money!"
  // doesn't get leet-converted and break \b word boundaries.
  // Leet-evaded keywords (v!agra) are caught by also testing the skeleton.
  if (KEYWORD_PATTERNS.some(p => p.test(nfkc) || p.test(skeleton))) return true;

  // URL detection only in 'normal' strictness
  if (strictness === 'normal') {
    if (URL_PATTERNS.some(p => p.test(nfkc))) return true;
  }

  return false;
}