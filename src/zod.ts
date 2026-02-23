/**
 * zod.ts  (exported as 'input-shield/zod')
 *
 * Zod integration helpers. Import from the subpath to keep Zod out of the
 * main bundle if you don't use it — zero cost if unused.
 *
 * Usage:
 *   import { z } from 'zod';
 *   import { shieldString } from 'input-shield/zod';
 *
 *   const schema = z.object({
 *     username: shieldString(v => v.min(3).max(20).noProfanity().noGibberish()),
 *     bio:      shieldString(v => v.min(10).max(300).noProfanity().noSpam()),
 *   });
 *
 * Or use the preset helpers:
 *   import { zodUsername, zodBio } from 'input-shield/zod';
 *
 *   const schema = z.object({
 *     username: zodUsername(),
 *     bio: zodBio(),
 *   });
 */

import { z } from 'zod';
import { createValidator, InputShieldValidator } from './validators/builder.js';
import {
  validateUsername,
  validateBio,
  validateShortText,
  validateLongText,
} from './validators/presets.js';

/**
 * Wraps a configured InputShieldValidator as a Zod string schema.
 *
 * @param configure - Callback that receives a fresh validator and returns it configured
 * @returns z.ZodEffects<z.ZodString>
 *
 * @example
 * shieldString(v => v.field('Bio').min(10).noProfanity().noSpam())
 */
export function shieldString(
  configure: (v: InputShieldValidator) => InputShieldValidator
): z.ZodEffects<z.ZodString> {
  const validator = configure(createValidator());
  return z.string().superRefine((val, ctx) => {
    const result = validator.validate(val);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
        params: { reason: result.reason },
      });
    }
  });
}

/** Zod schema for usernames (3–30 chars, no profanity, strict gibberish) */
export function zodUsername(): z.ZodEffects<z.ZodString> {
  return z.string().superRefine((val, ctx) => {
    const result = validateUsername(val);
    if (!result.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  });
}

/** Zod schema for bios (10–300 chars, no profanity, no spam) */
export function zodBio(): z.ZodEffects<z.ZodString> {
  return z.string().superRefine((val, ctx) => {
    const result = validateBio(val);
    if (!result.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  });
}

/** Zod schema for short text fields (2–100 chars) */
export function zodShortText(fieldName?: string): z.ZodEffects<z.ZodString> {
  return z.string().superRefine((val, ctx) => {
    const result = validateShortText(val, fieldName);
    if (!result.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  });
}

/** Zod schema for long text / comments (5–2000 chars) */
export function zodLongText(fieldName?: string): z.ZodEffects<z.ZodString> {
  return z.string().superRefine((val, ctx) => {
    const result = validateLongText(val, fieldName);
    if (!result.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  });
}
