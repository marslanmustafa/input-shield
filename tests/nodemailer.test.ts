/**
 * tests/nodemailer.test.ts
 *
 * Nodemailer-specific HTML email validation tests.
 *
 * Covers:
 *   1. HTML stripping (tags, entities, hrefs, style background URLs)
 *   2. Profanity hidden in HTML
 *   3. Spam URLs hidden in HTML attributes
 *   4. Real-world email spam content triggers:
 *      - ALL CAPS abuse
 *      - Excessive exclamation marks (!!!)
 *      - Spam phrases: "Guaranteed", "Earn $$$", "Act now", "Click here"
 *      - Link shorteners (bit.ly, tinyurl, t.co)
 *      - Mismatched link text vs href (phishing pattern)
 *   5. Gibberish/random string subjects ("dfjsdfsldjf", "asdfghjkl")
 *   6. Full validateMailContent() integration
 */

import { describe, it, expect } from 'vitest';
import { containsSpam } from '../src/core/spam.js';
import { containsProfanity } from '../src/core/profanity.js';
import { createValidator } from '../src/validators/builder.js';
import { stripHtml, validateMailContent } from '../src/email.js';

// ─── Email-specific heuristics ────────────────────────────────────────────────
// These live at the app layer — email-specific checks that don't belong
// in general text validation.

/** True if 3+ words are fully uppercase (excludes short words like "OK", "US") */
function hasExcessiveCaps(text: string): boolean {
  const words = text.replace(/<[^>]+>/g, '').split(/\s+/);
  const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  return capsWords.length >= 3;
}

/** True if text contains 3 or more exclamation marks */
function hasExcessiveExclamations(text: string): boolean {
  return (text.match(/!/g) ?? []).length >= 3;
}

/** True if text contains a known URL shortener domain */
function hasLinkShortener(text: string): boolean {
  return /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|short\.io|rb\.gy|cutt\.ly)\b/i.test(text);
}

/**
 * True if an anchor's visible text looks like a domain but doesn't match the href.
 * Classic phishing pattern: <a href="https://evil.ru">paypal.com</a>
 */
function hasMismatchedLinks(html: string): boolean {
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].toLowerCase();
    const visibleText = match[2].toLowerCase().trim();
    if (/\.(com|org|net|io)/.test(visibleText)) {
      try {
        const hrefDomain = new URL(href.startsWith('http') ? href : `https://${href}`).hostname;
        const visibleDomain = visibleText.replace(/https?:\/\//, '').split('/')[0];
        if (!hrefDomain.includes(visibleDomain)) return true;
      } catch {
        return true; // unparseable href is suspicious
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. stripHtml
// ═══════════════════════════════════════════════════════════════════════════════
describe('stripHtml — HTML stripping utility', () => {
  it('strips basic tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('strips inline styles (attribute only, not value)', () => {
    expect(stripHtml('<span style="color:red">buy now</span>')).toBe('buy now');
  });

  it('removes entire <style> block', () => {
    const html = '<style>.hidden { display:none }</style><p>buy viagra</p>';
    expect(stripHtml(html)).toContain('buy viagra');
    expect(stripHtml(html)).not.toContain('display');
  });

  it('removes entire <script> block', () => {
    expect(stripHtml('<script>alert("xss")</script><p>hello</p>')).toBe('hello');
  });

  it('decodes &nbsp; entity', () => {
    expect(stripHtml('free&nbsp;money')).toBe('free money');
  });

  it('decodes decimal numeric entities — &#102;&#117;&#99;&#107; = "fuck"', () => {
    expect(stripHtml('&#102;&#117;&#99;&#107;')).toBe('fuck');
  });

  it('decodes hex numeric entities — &#x66;&#x75;&#x63;&#x6B; = "fuck"', () => {
    expect(stripHtml('&#x66;&#x75;&#x63;&#x6B;')).toBe('fuck');
  });

  it('extracts href URLs from anchor tags', () => {
    const html = '<a href="https://spam.com">Click here</a>';
    expect(stripHtml(html)).toContain('https://spam.com');
  });

  it('extracts URL from inline style background', () => {
    const html = '<div style="background:url(https://tracker.spam.com/pixel)">content</div>';
    expect(stripHtml(html)).toContain('https://tracker.spam.com/pixel');
  });

  it('extracts URL from inline style with single quotes', () => {
    const html = `<div style="background-image: url('https://tracker.evil.ru/t')">hi</div>`;
    expect(stripHtml(html)).toContain('https://tracker.evil.ru/t');
  });

  it('preserves word boundaries at block-level closing tags', () => {
    // Without space injection: <p>free</p><p>money</p> → "freemoney" → \b fails
    const html = '<p>free</p><p>money</p>';
    const stripped = stripHtml(html);
    expect(/\bfree\b/.test(stripped)).toBe(true);
    expect(/\bmoney\b/.test(stripped)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Profanity hidden in HTML
// ═══════════════════════════════════════════════════════════════════════════════
describe('HTML email — profanity detection', () => {
  it('catches profanity in plain paragraph', () => {
    expect(containsProfanity(stripHtml('<p>What the fuck is this</p>'))).toBe(true);
  });

  it('catches profanity hidden inside bold tag', () => {
    expect(containsProfanity(stripHtml('<p>You are a <b>shit</b> developer</p>'))).toBe(true);
  });

  it('catches profanity split across span tags', () => {
    // Each letter in its own tag — breaks naive string matching
    expect(containsProfanity(stripHtml('<span>f</span><span>u</span><span>c</span><span>k</span>'))).toBe(true);
  });

  it('catches decimal entity encoded profanity', () => {
    expect(containsProfanity(stripHtml('<p>&#102;&#117;&#99;&#107; this</p>'))).toBe(true);
  });

  it('catches hex entity encoded profanity', () => {
    // &#x73;&#x68;&#x69;&#x74; = "shit"
    expect(containsProfanity(stripHtml('<p>&#x73;&#x68;&#x69;&#x74;</p>'))).toBe(true);
  });

  it('catches leet profanity in HTML', () => {
    expect(containsProfanity(stripHtml('<p>you are an @$$hole</p>'))).toBe(true);
  });

  it('does NOT flag clean transactional HTML', () => {
    const html = `<div><h1>Order Confirmed</h1><p>Your package arrives in <strong>3-5 days</strong>.</p></div>`;
    expect(containsProfanity(stripHtml(html))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Spam URLs hidden in HTML
// ═══════════════════════════════════════════════════════════════════════════════
describe('HTML email — spam URL detection', () => {
  it('catches spam keyword in paragraph', () => {
    expect(containsSpam(stripHtml('<p>Buy viagra online today!</p>'))).toBe(true);
  });

  it('catches spam URL when link text is innocent', () => {
    // "Unsubscribe" looks clean — href is the real threat
    expect(containsSpam(stripHtml('<a href="https://spam-pills.com">Unsubscribe</a>'))).toBe(true);
  });

  it('catches URL hidden in inline style background', () => {
    const html = '<div style="background:url(https://tracker.spam.com/pixel)">content</div>';
    expect(containsSpam(stripHtml(html))).toBe(true);
  });

  it('catches "free money" split across paragraph tags', () => {
    expect(containsSpam(stripHtml('<p>Win free</p><p>money today!</p>'))).toBe(true);
  });

  it('catches spam domain in anchor href', () => {
    expect(containsSpam(stripHtml('<a href="http://casino-free.ru">Click here</a>'))).toBe(true);
  });

  it('catches IP address in link', () => {
    expect(containsSpam(stripHtml('<a href="http://192.168.1.1/phish">Login</a>'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Real-world email spam triggers
// ═══════════════════════════════════════════════════════════════════════════════
describe('email spam triggers — content patterns', () => {

  describe('ALL CAPS abuse', () => {
    it('flags 3+ all-caps words', () => {
      expect(hasExcessiveCaps('BUY NOW FREE TRIAL GUARANTEED')).toBe(true);
    });

    it('flags all-caps subject', () => {
      expect(hasExcessiveCaps('ACT NOW EARN MONEY FAST')).toBe(true);
    });

    it('does NOT flag normal sentences with one caps word', () => {
      expect(hasExcessiveCaps('This is IMPORTANT please read')).toBe(false);
    });

    it('does NOT flag acronyms in normal context', () => {
      expect(hasExcessiveCaps('Contact our CEO at the USA office')).toBe(false);
    });
  });

  describe('excessive exclamation marks', () => {
    it('flags 3+ exclamations', () => {
      expect(hasExcessiveExclamations('Win big!!!')).toBe(true);
    });

    it('flags classic spam body', () => {
      expect(hasExcessiveExclamations('Free offer! Act now! Click here! Limited time!')).toBe(true);
    });

    it('does NOT flag 1-2 exclamations', () => {
      expect(hasExcessiveExclamations('Great news! Your order shipped.')).toBe(false);
      expect(hasExcessiveExclamations('Congratulations!!')).toBe(false);
    });
  });

  describe('link shorteners', () => {
    it('flags bit.ly', () => {
      expect(hasLinkShortener('Check this: https://bit.ly/3xFakeLink')).toBe(true);
    });

    it('flags tinyurl.com', () => {
      expect(hasLinkShortener('visit tinyurl.com/win-prize')).toBe(true);
    });

    it('flags t.co', () => {
      expect(hasLinkShortener('follow us at t.co/abc123')).toBe(true);
    });

    it('does NOT flag normal domains', () => {
      expect(hasLinkShortener('visit https://yourapp.com/reset-password')).toBe(false);
    });
  });

  describe('mismatched link text vs href (phishing)', () => {
    it('flags when visible text is a domain but href goes elsewhere', () => {
      const html = '<a href="https://phishing.ru/steal">paypal.com</a>';
      expect(hasMismatchedLinks(html)).toBe(true);
    });

    it('does NOT flag when visible text is not a domain', () => {
      const html = '<a href="https://yourapp.com/reset">Click here to reset your password</a>';
      expect(hasMismatchedLinks(html)).toBe(false);
    });
  });

  describe('spam trigger phrases', () => {
    const phraseValidator = createValidator()
      .field('Email')
      .min(1).max(50000)
      .noSpam()
      .custom(
        t => /\b(guarantee[d]?|earn\s+\$+|click\s+here|act\s+now|limited\s+time\s+offer|you\s+have\s+won|congratulations\s+you)(?!\w)/i.test(t),
        'spam',
        'contains common spam trigger phrases'
      );

    it('flags "guaranteed"', () => {
      expect(phraseValidator.validate('100% guaranteed results or your money back').isValid).toBe(false);
    });

    it('flags "earn $$$"', () => {
      expect(phraseValidator.validate('earn $$$ from home today').isValid).toBe(false);
    });

    it('flags "act now"', () => {
      expect(phraseValidator.validate('Act now to claim your prize').isValid).toBe(false);
    });

    it('flags "you have won"', () => {
      expect(phraseValidator.validate('Congratulations you have won our grand prize').isValid).toBe(false);
    });

    it('flags "limited time offer"', () => {
      expect(phraseValidator.validate('This is a limited time offer just for you').isValid).toBe(false);
    });

    it('does NOT flag normal transactional content', () => {
      expect(phraseValidator.validate('Your order has been confirmed and will ship in 2 business days').isValid).toBe(true);
      expect(phraseValidator.validate('Please reset your password using the link below').isValid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Gibberish / random string subject detection
// ═══════════════════════════════════════════════════════════════════════════════
describe('gibberish email subjects', () => {
  const subjectValidator = createValidator()
    .field('Subject')
    .min(2).max(150)
    .noProfanity()
    .noSpam()
    .noGibberish({ sensitivity: 'normal' })
    .noLowQuality();

  const gibberishCases = [
    'dfjsdfsldjf',   // the example from your question
    'asdfghjkl',
    'qwerty',
    'zxcvbnm',
    'hjklqwerty',
    'xkcdvbnmzx',
    'aaaaaaaaaa',    // repeating chars
  ];

  const lowEffortCases = [
    'testing',
    'test',
    'demo',
    'asdf',
  ];

  gibberishCases.forEach(subject => {
    it(`flags gibberish subject: "${subject}"`, () => {
      expect(subjectValidator.validate(subject).isValid).toBe(false);
    });
  });

  lowEffortCases.forEach(subject => {
    it(`flags low-effort subject: "${subject}"`, () => {
      expect(subjectValidator.validate(subject).isValid).toBe(false);
    });
  });

  const validSubjects = [
    'Your password reset link',
    'Order confirmation #12345',
    'Welcome to our platform',
    'Invoice from Acme Corp',
    'Meeting tomorrow at 3pm',
    'Hello Marslan',
  ];

  validSubjects.forEach(subject => {
    it(`passes valid subject: "${subject}"`, () => {
      expect(subjectValidator.validate(subject).isValid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. validateMailContent — full Nodemailer object
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateMailContent — full integration', () => {
  it('passes clean transactional email', () => {
    const result = validateMailContent({
      subject: 'Your order has been confirmed',
      text: 'Thank you for your purchase. Your order will arrive in 3 to 5 business days.',
      html: '<p>Thank you for your purchase. Your order will arrive in <strong>3-5 business days</strong>.</p>',
    });
    expect(result.isValid).toBe(true);
  });

  it('fails — spam in subject, returns field: "subject"', () => {
    const result = validateMailContent({
      subject: 'Buy viagra now!',
      text: 'Normal message.',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.field).toBe('subject');
      expect(result.reason).toBe('spam');
    }
  });

  it('fails — profanity in HTML body, returns field: "html"', () => {
    const result = validateMailContent({
      subject: 'Hello',
      html: '<p>You are a <strong>shit</strong> developer.</p>',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.field).toBe('html');
      expect(result.reason).toBe('profanity');
    }
  });

  it('fails — spam URL in href, returns field: "html"', () => {
    const result = validateMailContent({
      subject: 'Hello',
      html: '<a href="https://free-casino.ru">Click here</a>',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.field).toBe('html');
  });

  it('fails — spam URL in background style, returns field: "html"', () => {
    const result = validateMailContent({
      subject: 'Hello',
      html: '<div style="background:url(https://tracker.spam.com/pixel)">Hello</div>',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.field).toBe('html');
  });

  it('fails — decimal entity encoded profanity in HTML', () => {
    const result = validateMailContent({
      subject: 'Feedback',
      html: '<p>&#102;&#117;&#99;&#107; your product</p>',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.reason).toBe('profanity');
  });

  it('fails — spam in plain text body, returns field: "text"', () => {
    const result = validateMailContent({
      subject: 'Hello',
      text: 'Win free money at https://casino.ru now!',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.field).toBe('text');
      expect(result.reason).toBe('spam');
    }
  });

  it('returns typed field + reason + message for UI display', () => {
    const result = validateMailContent({ subject: 'buy viagra' });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.field).toBe('subject');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('accepts custom validator for stricter app-level rules', () => {
    const strictValidator = createValidator()
      .field('Email content')
      .min(1).max(50000)
      .noProfanity()
      .noSpam()
      .custom(t => /!!!/.test(t), 'spam', 'excessive exclamation marks not allowed');

    const result = validateMailContent(
      { subject: 'Act now!!!', text: 'Hurry up!!!' },
      strictValidator
    );
    expect(result.isValid).toBe(false);
  });
});