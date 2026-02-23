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
  // fuck — no boundaries needed, no legitimate English words contain 'fuck'
  /f+[ua]+c+k+/i,
  // shit — left boundary to prevent 'mishit'
  /(?<![a-z])s+h+i+t+/i,
  // bitch — no boundaries needed
  /b+i+t+c+h+/i,
  // ass — strictly bounded to avoid 'assassin', 'classic', 'bass'
  /(?<![a-z])a+s{2,}(h+o+l+e+s?|e[sd]|ing)?(?![a-z])/i,
  // cunt — left boundary for 'scunthorpe'
  /(?<![a-z])c+u+n+t+/i,
  // dick — strictly bounded to avoid 'dickens', 'medick'
  /(?<![a-z])d+i+c+k+(s|ed|ing)?(?![a-z])(?! [A-Z])/i,
  // prick — strictly bounded to avoid 'prickly'
  /(?<![a-z])p+r+i+c+k+s?(?![a-z])/i,
  // bastard — no boundaries needed
  /b+a+s+t+a+r+d+/i,
  // whore — left boundary
  /(?<![a-z])w+h+o+r+e+/i,
  // fag / faggot — left boundary, right boundary for 'fag' to avoid 'fagus'
  /(?<![a-z])f+a+g+(g+o+t+s?)?(?![a-z])/i,
  // nigger / nigga — left boundary for 'snigger'
  /(?<![a-z])n+i+g+(g+e+r+s?|ga+s?)/i,
  // frick — strictly bounded
  /(?<![a-z])frick(?![a-z])/i,
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
