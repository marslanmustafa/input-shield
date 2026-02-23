/**
 * profanity.ts
 *
 * Profanity detection. All patterns run against the skeleton (toSkeleton()),
 * meaning they automatically handle:
 *   - Leet-speak:     "f4ck", "@ss", "sh!t"
 *   - Homoglyphs:     "fuсk" (Cyrillic с), "аss" (Cyrillic а)
 *   - Separator dots: "f.u.c.k", "s-h-i-t"
 *   - Fullwidth:      "ｆｕｃｋ"
 *   - Repeated chars: "fuuuuck", "shhhhit"
 *
 * Pattern design:
 *   - Use \b word boundaries so "classic" doesn't match "ass"
 *   - Use + quantifiers to catch character stretching ("fuuuuck")
 *   - Cover plurals and -er/-ing forms (shits, bitch, bitching)
 */

import { toSkeleton } from './normalize.js';

// Each entry: [pattern, label] — label used for future i18n / logging
const PROFANITY_PATTERNS: RegExp[] = [
  // fuck — also matches 'fack' because leet '4' → 'a', so we allow u OR a in slot 2
  /\bf+[ua]+c+k+(e[dr]|ing|s|er)?\b/i,
  /\bs+h+i+t+(s|te[dr]|ting)?\b/i,
  /\bb+i+t+c+h+(e[sd]|ing)?\b/i,
  // ass — use (^|\s|[^a-z]) instead of \b so it catches "@ss" → "ass" at start of string
  /(?:^|(?<=[^a-z]))a+s{2,}(h+o+l+e+s?|e[sd]|ing)?\b/i,
  /\bc+u+n+t+s?\b/i,
  // dick — exclude as a proper first name before a capitalized surname
  /\bd+i+c+k+(s|ed|ing)?\b(?! [A-Z])/i,
  /\bp+r+i+c+k+s?\b/i,
  /\bb+a+s+t+a+r+d+s?\b/i,
  /\bw+h+o+r+e+s?\b/i,
  /\bf+a+g+(g+o+t+s?)?\b/i,
  /\bn+i+g+(g+e+r+s?|ga+s?)?\b/i,
  /\bfrick\b/i,
];

/**
 * Returns true if the skeleton of `text` matches any profanity pattern.
 * Always check skeleton — never raw — so bypasses don't work.
 */
export function containsProfanity(text: string): boolean {
  const skeleton = toSkeleton(text);
  return PROFANITY_PATTERNS.some(p => p.test(skeleton));
}

/**
 * Returns the specific pattern that matched, or null.
 * Useful for debug logging (never expose to users directly).
 */
export function getMatchedProfanityPattern(text: string): RegExp | null {
  const skeleton = toSkeleton(text);
  return PROFANITY_PATTERNS.find(p => p.test(skeleton)) ?? null;
}
