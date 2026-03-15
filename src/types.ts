// ─── Failure Reasons ─────────────────────────────────────────────────────────
// Typed reason codes let consuming code branch on *why* input failed,
// not just that it did — enables custom error UI, analytics, etc.

export type FailReason =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'profanity'
  | 'spam'
  | 'gibberish'
  | 'low_effort'
  | 'repeating_chars'
  | 'excessive_symbols'
  | 'homoglyph_attack'   // e.g. Cyrillic "о" masquerading as Latin "o"
  | 'custom';

// ─── Result (discriminated union) ────────────────────────────────────────────
export type ValidationResult =
  | { isValid: true }
  | { isValid: false; reason: FailReason; message: string };

// ─── Gibberish sensitivity ───────────────────────────────────────────────────
export type GibberishSensitivity = 'loose' | 'normal' | 'strict';
//   loose  → only catches obvious keyboard mash (7+ consonants in a row)
//   normal → consonant clusters + low vowel ratio on long words
//   strict → also flags suspiciously short vowel ratio on short words

// ─── Spam strictness ──────────────────────────────────────────────────────────
export type SpamStrictness = 'low' | 'normal';
//   low    → only detects keywords (no link detection). Best for bios/messages.
//   normal → detects keywords AND links/URLs.

// ─── Builder / validator options ─────────────────────────────────────────────
export interface ValidationOptions {
  /** Display name used in error messages. Default: "Input" */
  fieldName?: string;
  /** Minimum character length (post-trim). Default: 2 */
  minLength?: number;
  /** Maximum character length. Default: 500 */
  maxLength?: number;
  /** Controls how aggressively gibberish is flagged. Default: "normal" */
  gibberishSensitivity?: GibberishSensitivity;
  /** Skip gibberish check entirely. Useful for short codes, IDs, non-English. */
  skipGibberishCheck?: boolean;
  /** Skip repeated-word detection. Useful for long-form natural language. */
  skipRepeatWordCheck?: boolean;
  /** Controls how aggressively spam is flagged. Default: "low" (no links) */
  spamStrictness?: SpamStrictness;
  /** Extra words/phrases to block (exact, case-insensitive). */
  customBlocklist?: string[];
  /** Strings always allowed, bypassing all checks (e.g. brand names, acronyms). */
  allowlist?: string[];
}
