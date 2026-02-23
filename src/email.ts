/**
 * email.ts  (exported as '@marslanmustafa/input-shield/email')
 *
 * Email-specific validation utilities.
 *
 * WHY THIS EXISTS:
 *   Nodemailer (and every other mail library) has zero content validation.
 *   Email bodies are almost always HTML — raw input-shield validators
 *   running on HTML strings will miss profanity/spam hidden inside tags,
 *   encoded as HTML entities, or buried in href attributes.
 *
 * WHAT THIS PROVIDES:
 *   - stripHtml()          → clean HTML → plain text for validation
 *   - validateMailContent() → validate a full Nodemailer mail options object
 */

import { createValidator, InputShieldValidator } from './validators/builder.js';

// ─── HTML Stripper ────────────────────────────────────────────────────────────

/**
 * Strip HTML and decode entities — producing clean plain text for validation.
 *
 * Handles the following attack vectors:
 *   - Tags wrapping profanity:   <b>f*ck</b>         → "f*ck"
 *   - Split-tag evasion:         <s>f</s><s>uck</s>  → "f uck" → skeleton → "fuck"
 *   - Decimal entities:          &#102;&#117;&#99;&#107; → "fuck"
 *   - Hex entities:              &#x66;&#x75;&#x63;&#x6B; → "fuck"
 *   - Spam URLs in href:         <a href="https://spam.com">click</a> → includes URL
 *   - Hidden CSS/scripts:        <style> and <script> blocks removed entirely
 *
 * @param html - Raw HTML string (e.g. Nodemailer `html` field)
 * @returns Plain text safe to pass to any input-shield validator
 */
export function stripHtml(html: string): string {
  // Step 0: Extract ALL url() values from inline styles FIRST, before tags are stripped.
  // This catches: style="background:url(https://tracker.spam.com/pixel)"
  // If we strip tags first, the URL inside the style attribute is lost forever.
  const styleUrls: string[] = [];
  const urlPattern = /url\(["']?(https?:\/\/[^"')]+)["']?\)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlPattern.exec(html)) !== null) {
    styleUrls.push(urlMatch[1]);
  }

  return [
    html
      // Remove <style> blocks entirely — CSS can visually hide text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      // Remove <script> blocks entirely
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      // Extract href values — link text may be clean but href is spam
      .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi, ' $1 ')
      // Preserve word boundaries at block-level closing tags
      // Without this: <p>free</p><p>money</p> → "freemoney" (breaks \b)
      .replace(/<\/(p|div|li|td|th|h[1-6]|blockquote)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      // Strip all remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode numeric entities BEFORE named (order matters)
      // &#102; → "f",  &#x66; → "f"
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Decode named entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'"),
    // Append extracted style URLs so spam detector sees them
    ...styleUrls,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Mail content validator ───────────────────────────────────────────────────

export interface MailContent {
  /** Email subject line */
  subject?: string;
  /** Plain text body */
  text?: string;
  /** HTML body — will be stripped before validation */
  html?: string;
}

export type MailValidationResult =
  | { isValid: true }
  | { isValid: false; field: 'subject' | 'text' | 'html'; reason: string; message: string };

/**
 * Validate a Nodemailer mail options object before passing to sendMail().
 *
 * Strips HTML from the `html` field automatically.
 * Validates subject, text, and html fields independently.
 *
 * @param mail     - The mail content to validate (subset of Nodemailer's MailOptions)
 * @param validator - Optional custom validator. Defaults to noProfanity + noSpam.
 *
 * @example
 * const result = validateMailContent({
 *   subject: 'Hello',
 *   html: '<p>Your order is confirmed.</p>',
 * });
 * if (!result.isValid) {
 *   throw new Error(result.message); // never reaches sendMail()
 * }
 * await transporter.sendMail({ ...mailOptions });
 */
export function validateMailContent(
  mail: MailContent,
  validator?: InputShieldValidator
): MailValidationResult {
  // Default validator: profanity + spam, generous length limits for email
  const v = validator ?? createValidator()
    .field('Email content')
    .min(1)
    .max(50000)
    .noProfanity()
    .noSpam();

  const fields: Array<{ key: 'subject' | 'text' | 'html'; value: string }> = [];

  if (mail.subject) {
    fields.push({ key: 'subject', value: mail.subject });
  }
  if (mail.text) {
    fields.push({ key: 'text', value: mail.text });
  }
  if (mail.html) {
    // Strip HTML before validating — this is the critical step
    fields.push({ key: 'html', value: stripHtml(mail.html) });
  }

  for (const { key, value } of fields) {
    const result = v.validate(value);
    if (!result.isValid) {
      return {
        isValid: false,
        field: key,
        reason: result.reason,
        message: result.message,
      };
    }
  }

  return { isValid: true };
}