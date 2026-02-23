/**
 * gibberish.ts
 *
 * Gibberish / keyboard-mash detection with a configurable sensitivity scale.
 *
 * Why sensitivity levels?
 *   "Strict" mode is needed for display names & usernames.
 *   "Loose" mode prevents false positives on:
 *     - Polish names:        "Krzysztof", "Szczepański"
 *     - Technical strings:   "kubectl", "nginx", "src"
 *     - Abbreviations:       "HVAC", "VLSI"
 *     - Short legitimate words like "nth", "gym", "lynx"
 *
 * Heuristics used (layered by sensitivity):
 *   LOOSE:  7+ consonants in a row (obvious keyboard mash only)
 *   NORMAL: 6+ consonants in a row OR vowel ratio < 10% on words ≥ 8 chars
 *   STRICT: 5+ consonants in a row OR vowel ratio < 15% on words ≥ 6 chars
 *           OR no vowels at all on words ≥ 4 chars
 *
 * All checks run on the skeleton so leet/homoglyphs are already resolved.
 */

import { toSkeleton } from './normalize.js';
import type { GibberishSensitivity } from '../types.js';

// Legitimate words that trip consonant/vowel heuristics — never flag these.
const GIBBERISH_ALLOWLIST = new Set([
  'rhythm', 'rhythms',
  'krzysztof', 'szczepanski', 'grzegorz', 'przemek',
  'strength', 'strengths',
  'lymph', 'nymph', 'nymphs',
  'glyph', 'glyphs', 'crypt', 'crypts',
  'tryst', 'pygmy', 'synth', 'psych',
]);

interface SensitivityConfig {
  consonantRun: number;   // consecutive consonants that trigger flag
  vowelRatioMin: number;  // minimum vowel ratio (below this = gibberish)
  vowelRatioWordLen: number; // word must be at least this long for ratio check
  noVowelWordLen: number; // word with zero vowels flagged if >= this length
}

const CONFIGS: Record<GibberishSensitivity, SensitivityConfig> = {
  loose: {
    consonantRun: 7,
    vowelRatioMin: 0.05,
    vowelRatioWordLen: 12,
    noVowelWordLen: 6,
  },
  normal: {
    consonantRun: 6,
    vowelRatioMin: 0.10,
    vowelRatioWordLen: 8,
    noVowelWordLen: 5,
  },
  strict: {
    consonantRun: 5,
    vowelRatioMin: 0.15,
    vowelRatioWordLen: 6,
    noVowelWordLen: 4,
  },
};

const CONSONANT_RUN_PATTERNS: Record<GibberishSensitivity, RegExp> = {
  loose: /[bcdfghjklmnpqrstvwxyz]{7,}/i,
  normal: /[bcdfghjklmnpqrstvwxyz]{6,}/i,
  strict: /[bcdfghjklmnpqrstvwxyz]{5,}/i,
};

/**
 * Returns true if the given word (already skeleton-normalized, no spaces)
 * looks like gibberish at the given sensitivity.
 */
function isWordGibberish(word: string, sensitivity: GibberishSensitivity): boolean {
  if (word.length > 25) return true;

  // Never flag known legitimate words
  if (GIBBERISH_ALLOWLIST.has(word)) return false;

  const cfg = CONFIGS[sensitivity];

  if (CONSONANT_RUN_PATTERNS[sensitivity].test(word)) return true;

  if (word.length >= cfg.vowelRatioWordLen) {
    const vowels = (word.match(/[aeiou]/g) ?? []).length;
    if (vowels / word.length < cfg.vowelRatioMin) return true;
  }

  // Zero-vowel check — only apply to words NOT in allowlist (already checked above)
  if (word.length >= cfg.noVowelWordLen) {
    const vowels = (word.match(/[aeiou]/g) ?? []).length;
    if (vowels === 0) return true;
  }

  return false;
}

/**
 * Returns true if any word in the text looks like gibberish.
 *
 * Filters out very short words (< 4 chars) before applying heuristics
 * to prevent false positives on "by", "mr", "st", "nth", etc.
 */
export function isGibberish(
  text: string,
  sensitivity: GibberishSensitivity = 'normal'
): boolean {
  const skeleton = toSkeleton(text);
  const words = skeleton.split(' ').filter(w => w.length >= 4);

  // If there are no words long enough to check, it's not gibberish by this heuristic
  if (words.length === 0) return false;

  return words.some(word => isWordGibberish(word, sensitivity));
}

/**
 * Returns true if the text contains 5+ of the same character consecutively.
 * e.g. "aaaaaaa", "!!!!!!", "heeeeey" (5 e's)
 * Runs on skeleton so leet chars are already resolved.
 */
export function hasRepeatingChars(text: string): boolean {
  return /(.)\1{3,}/.test(toSkeleton(text));
}
