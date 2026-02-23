/**
 * input-shield
 *
 * One install. No config. Clean inputs.
 *
 * Main entry: validation primitives + fluent builder + presets
 * Zod integration: import from 'input-shield/zod' (separate subpath)
 */

// ─── Builder (primary API) ───────────────────────────────────────────────────
export { createValidator, InputShieldValidator } from './validators/builder.js';

// ─── Presets (batteries included) ───────────────────────────────────────────
export {
  validateUsername,
  validateShortText,
  validateBio,
  validateLongText,
  validateSearchQuery,
} from './validators/presets.js';

// ─── Core primitives (tree-shakeable, use individually if needed) ────────────
export { toSkeleton, toStructural } from './core/normalize.js';
export { containsProfanity, getMatchedProfanityPattern } from './core/profanity.js';
export { containsSpam } from './core/spam.js';
export { isGibberish, hasRepeatingChars } from './core/gibberish.js';
export {
  hasExcessiveSymbols,
  hasLowAlphabetRatio,
  hasRepeatedContentWords,
  isLowEffortExact,
} from './core/structure.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  FailReason,
  ValidationResult,
  GibberishSensitivity,
  ValidationOptions,
} from './types.js';
