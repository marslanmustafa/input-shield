/**
 * presets.ts
 *
 * Ready-to-use validators for the most common field types.
 * Zero config — import and call.
 *
 * All presets are pre-configured InputShieldValidator instances.
 * You can also use them as a starting point and extend with .custom():
 *
 *   import { usernameValidator } from 'input-shield/presets';
 *   // They're factories, so each call gives a fresh instance:
 *   const myValidator = usernameValidator().custom(t => t === 'admin', 'custom', 'reserved name');
 */

import { createValidator } from './builder.js';
import type { ValidationResult } from '../types.js';

/**
 * Username / display name.
 * 3–30 chars, no profanity, strict gibberish detection, no spam.
 * Repeated words allowed (e.g. "John John" as a nickname).
 */
export function validateUsername(text: string): ValidationResult {
  return createValidator()
    .field('Username')
    .min(3)
    .max(30)
    .noProfanity()
    .noGibberish({ sensitivity: 'strict' })
    .noLowQuality()
    .validate(text);
}

/**
 * Short text / name fields (product name, company name, form title).
 * 2–100 chars, no profanity, normal gibberish, no spam.
 */
export function validateShortText(text: string, fieldName = 'Name'): ValidationResult {
  return createValidator()
    .field(fieldName)
    .min(2)
    .max(100)
    .noProfanity()
    .noGibberish({ sensitivity: 'normal' })
    .noSpam()
    .noLowQuality()
    .validate(text);
}

/**
 * Bio / description / about me.
 * 10–300 chars, no profanity, no spam, loose gibberish (allows natural language).
 * Repeated words NOT flagged (natural in prose).
 */
export function validateBio(text: string): ValidationResult {
  return createValidator()
    .field('Bio')
    .min(10)
    .max(300)
    .noProfanity()
    .noSpam()
    .noGibberish({ sensitivity: 'loose' })
    .validate(text);
}

/**
 * Long-form text (comment, review, feedback).
 * 5–2000 chars, no profanity, no spam. No gibberish check
 * (long text can contain intentional fragments, code, etc.)
 */
export function validateLongText(text: string, fieldName = 'Message'): ValidationResult {
  return createValidator()
    .field(fieldName)
    .min(5)
    .max(2000)
    .noProfanity()
    .noSpam()
    .validate(text);
}

/**
 * Search query input.
 * 1–200 chars, no spam URLs (but allows short/fragmentary text).
 * Does NOT flag gibberish (code snippets, SKUs, part numbers are valid queries).
 */
export function validateSearchQuery(text: string): ValidationResult {
  return createValidator()
    .field('Search query')
    .min(1)
    .max(200)
    .noSpam()
    .validate(text);
}
