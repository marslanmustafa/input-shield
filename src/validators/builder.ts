/**
 * builder.ts
 *
 * Fluent builder API — the primary way developers use input-shield.
 *
 * Usage:
 *   const validator = createValidator()
 *     .field('Username')
 *     .min(3).max(30)
 *     .noProfanity()
 *     .noGibberish({ sensitivity: 'strict' })
 *     .noSpam()
 *     .allow('nginx', 'kubectl');
 *
 *   const result = validator.validate(userInput);
 *   if (!result.isValid) console.error(result.reason, result.message);
 *
 * Design principles:
 *   - Each check is opt-in via a chain method (not a giant options object)
 *   - Checks run in declaration order (you control the priority)
 *   - Returns typed FailReason, not just a boolean
 *   - Allowlist bypasses ALL checks (brand names, abbreviations, etc.)
 *   - Custom check via .custom() for domain-specific rules
 */

import { toSkeleton, toStructural } from '../core/normalize.js';
import { containsProfanity } from '../core/profanity.js';
import { containsSpam } from '../core/spam.js';
import { isGibberish, hasRepeatingChars } from '../core/gibberish.js';
import {
  hasExcessiveSymbols,
  hasLowAlphabetRatio,
  hasRepeatedContentWords,
  isLowEffortExact,
} from '../core/structure.js';
import type { ValidationResult, FailReason, GibberishSensitivity } from '../types.js';

// ─── Internal check type ──────────────────────────────────────────────────────
type CheckFn = (raw: string, skeleton: string) => CheckResult | null;
type CheckResult = { reason: FailReason; message: string };

// ─── Builder class ────────────────────────────────────────────────────────────
export class InputShieldValidator {
  private _fieldName = 'Input';
  private _min = 2;
  private _max = 500;
  private _allowlist = new Set<string>();
  private _checks: CheckFn[] = [];
  private _spamCheck: CheckFn | null = null;

  // ─── Configuration ──────────────────────────────────────────────────────────

  /** Set the field label used in error messages */
  field(name: string): this {
    this._fieldName = name;
    return this;
  }

  /** Minimum character length (post-trim). Default: 2 */
  min(n: number): this {
    this._min = n;
    return this;
  }

  /** Maximum character length. Default: 500 */
  max(n: number): this {
    this._max = n;
    return this;
  }

  /**
   * Add strings that always pass validation, regardless of other checks.
   * Useful for brand names, tech terms, or known-good short strings.
   *   .allow('nginx', 'kubectl', 'QA', 'IT')
   */
  allow(...words: string[]): this {
    words.forEach(w => this._allowlist.add(toSkeleton(w)));
    return this;
  }

  // ─── Check methods ──────────────────────────────────────────────────────────

  /** Block profanity, including leet-speak and homoglyph evasions */
  noProfanity(): this {
    this._checks.push((_raw, skeleton) =>
      containsProfanity(skeleton)
        ? { reason: 'profanity', message: 'contains inappropriate language.' }
        : null
    );
    return this;
  }

  /**
   * Block spam keywords and URLs.
   * Note: URL detection uses the raw string internally (not the skeleton),
   * so you don't need to worry about URLs being missed.
   */
  noSpam(): this {
    const spamFn: CheckFn = (raw) =>
      containsSpam(raw)
        ? { reason: 'spam', message: 'appears to contain spam or promotional content.' }
        : null;
    this._spamCheck = spamFn;
    this._checks.push(spamFn);
    return this;
  }

  /**
   * Block gibberish / keyboard mash.
   *
   * @param options.sensitivity
   *   'loose'  — only catches extreme mashing (7+ consonants). Safe for names.
   *   'normal' — default. Catches most mashing while allowing tech words.
   *   'strict' — also catches low vowel-ratio words. Best for usernames.
   */
  noGibberish(options: { sensitivity?: GibberishSensitivity } = {}): this {
    const sensitivity = options.sensitivity ?? 'normal';
    this._checks.push((raw) => {
      if (hasRepeatingChars(raw) || isGibberish(raw, sensitivity)) {
        return { reason: 'gibberish', message: 'appears to be gibberish or keyboard mash.' };
      }
      return null;
    });
    return this;
  }

  /** Block inputs that are structurally low quality (too many symbols, too few letters) */
  noLowQuality(): this {
    this._checks.push((raw, skeleton) => {
      if (hasExcessiveSymbols(raw)) {
        return { reason: 'excessive_symbols', message: 'contains too many special characters.' };
      }
      if (hasLowAlphabetRatio(raw)) {
        return { reason: 'low_effort', message: 'must contain more letters.' };
      }
      if (isLowEffortExact(skeleton)) {
        return { reason: 'low_effort', message: 'appears to be a placeholder or filler value.' };
      }
      return null;
    });
    return this;
  }

  /** Block inputs that repeat content words excessively */
  noRepeatedWords(): this {
    this._checks.push((raw) =>
      hasRepeatedContentWords(raw)
        ? { reason: 'low_effort', message: 'contains too many repeated words.' }
        : null
    );
    return this;
  }

  /**
   * Add a custom validation rule.
   *
   * @param fn      - Returns true if the input is INVALID (should be blocked)
   * @param reason  - The FailReason code to return
   * @param message - Human-readable message (do not include fieldName, it's prepended)
   *
   * @example
   * .custom(t => t.includes('@'), 'custom', 'product names cannot contain @')
   */
  custom(fn: (text: string) => boolean, reason: FailReason, message: string): this {
    this._checks.push((raw) =>
      fn(raw) ? { reason, message } : null
    );
    return this;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  validate(text: string): ValidationResult {
    const raw = (text ?? '').trim();
    const skeleton = toSkeleton(raw);
    const f = this._fieldName;

    // 1. Allowlist bypass
    if (this._allowlist.has(skeleton)) {
      return { isValid: true };
    }

    // 2. Empty
    if (!raw) {
      return { isValid: false, reason: 'empty', message: `${f} cannot be empty.` };
    }

    // 3. Length
    const displayLength = toStructural(raw).length;
    if (displayLength < this._min) {
      return { isValid: false, reason: 'too_short', message: `${f} must be at least ${this._min} characters.` };
    }
    if (displayLength > this._max) {
      return { isValid: false, reason: 'too_long', message: `${f} must be no more than ${this._max} characters.` };
    }

    // 4. Run spam check FIRST before other checks (priority override)
    // Reason: a URL like "https://spam.com" would otherwise get caught
    // by the gibberish heuristic (consonant clusters in domain names)
    // and return reason:'gibberish' instead of reason:'spam'.
    const spamCheck = this._checks.find(c => c === this._spamCheck);
    if (spamCheck) {
      const result = spamCheck(raw, skeleton);
      if (result) return { isValid: false, reason: result.reason, message: `${f} ${result.message}` };
    }

    // 5. Run remaining checks in declaration order
    for (const check of this._checks) {
      if (check === this._spamCheck) continue; // already ran above
      const result = check(raw, skeleton);
      if (result) {
        return { isValid: false, reason: result.reason, message: `${f} ${result.message}` };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate and throw if invalid. Useful in form libraries / Zod .superRefine().
   * @throws Error with the validation message
   */
  validateOrThrow(text: string): void {
    const result = this.validate(text);
    if (!result.isValid) throw new Error(result.message);
  }
}

/**
 * Create a new fluent validator.
 * No `new` keyword needed.
 *
 * @example
 * const v = createValidator().field('Username').min(3).noProfanity().noGibberish();
 */
export function createValidator(): InputShieldValidator {
  return new InputShieldValidator();
}
