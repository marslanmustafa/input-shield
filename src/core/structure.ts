/**
 * structure.ts
 *
 * Structural quality checks. These run on the NFKC-normalized original text
 * (not the full skeleton), because they're measuring the *shape* of the input
 * (symbol density, letter presence) — not its semantic content.
 *
 * Running these on the skeleton would give wrong results because the skeleton
 * strips ALL symbols, making everything look clean structurally.
 */

import { toStructural } from './normalize.js';

/**
 * Returns true if more than 40% of characters are symbols
 * (not letters, digits, or whitespace).
 *
 * Short strings (< 5 chars) are excluded — too noisy to judge.
 * e.g. "!!??@@##" → 100% symbols → flagged
 *      "Hello!!"  → 22% symbols → pass
 */
export function hasExcessiveSymbols(text: string): boolean {
  const s = toStructural(text);
  if (s.length < 5) return false;
  const symbols = (s.match(/[^a-zA-Z0-9\s]/g) ?? []).length;
  return symbols / s.length > 0.40;
}

/**
 * Returns true if fewer than 20% of characters are letters AND
 * there are fewer than 3 total letter characters.
 *
 * This catches strings like "123 456", "--- ---", "42", "!2!"
 * but allows legitimate short inputs like "QA", "IT", "Go".
 *
 * Both conditions must be true to avoid false positives.
 */
export function hasLowAlphabetRatio(text: string): boolean {
  const s = toStructural(text);
  const letters = (s.match(/[a-zA-Z]/g) ?? []).length;

  // Short strings (≤ 5 chars): only flag if ZERO letters (e.g. "123", "!!!")
  // This allows "QA", "IT", "Go", "v2" to pass
  if (s.length <= 5) return letters === 0;

  // Medium+ strings: must have at least 3 letters
  if (letters < 3) return true;

  // Long strings (≥ 15 chars): flag if mostly non-letter
  if (s.length >= 15 && letters / s.length < 0.20) return true;

  return false;
}

/**
 * Detects repeated *content* words (length > 3).
 * Stop words ("the", "and", "for") are excluded to avoid false positives
 * in natural English sentences.
 *
 * Flags only when 2+ distinct content words appear more than once.
 * "the cat sat on the mat" → 0 repeated content words → pass
 * "cat cat cat dog dog"    → "cat" repeated, "dog" repeated → flag
 */
export function hasRepeatedContentWords(text: string): boolean {
  const s = toStructural(text).toLowerCase();
  const words = s
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const seen = new Set<string>();
  let repeatCount = 0;

  for (const word of words) {
    if (seen.has(word)) repeatCount++;
    seen.add(word);
  }

  return repeatCount >= 2;
}

// ─── Low-effort exact matches ─────────────────────────────────────────────────
// Short exact-match blocklist for obvious filler inputs.
// These are checked against the SKELETON so leet evasions are caught too.
const LOW_EFFORT_SET = new Set([
  'test', 'testing', 'tester',
  'demo', 'sample', 'trial',
  'asdf', 'qwer', 'zxcv', 'qwerty', 'qwertyuiop',
  'placeholder', 'foo', 'bar', 'baz', 'foobar',
  'helloworld',   // "hello world" after skeleton strip
  'loremipsum',   // same
  'aaa', 'bbb',   // caught by repeatingChars too, belt-and-suspenders
  'xxx', 'yyy', 'zzz',
  'na', 'none', 'null', 'undefined', 'nope', 'no', 'n/a',
]);

/**
 * Returns true if the skeleton of `text` exactly matches a known low-effort phrase.
 */
export function isLowEffortExact(skeletonText: string): boolean {
  // Remove spaces for compound checks ("hello world" → "helloworld")
  const noSpaces = skeletonText.replace(/\s/g, '');
  return LOW_EFFORT_SET.has(skeletonText) || LOW_EFFORT_SET.has(noSpaces);
}
