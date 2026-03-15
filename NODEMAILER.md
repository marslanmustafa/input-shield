## Nodemailer Integration

`input-shield` works as the validation layer **before** content reaches Nodemailer.

> **Why this matters:** Nodemailer has zero content validation — it will send spam,
> profanity, or malicious URLs without throwing any error. Validation is 100% your
> responsibility before calling `sendMail()`.

### Install

```bash
npm install @marslanmustafa/input-shield nodemailer
npm install --save-dev @types/nodemailer
```

---

### Basic contact form

```typescript
import nodemailer from 'nodemailer';
import { createValidator } from '@marslanmustafa/input-shield';

// ─── Transporter setup ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Validators ───────────────────────────────────────────────────────────────
const nameValidator = createValidator()
  .field('Name')
  .min(2).max(60)
  .noProfanity()
  .noGibberish({ sensitivity: 'normal' })
  .noLowQuality();

const subjectValidator = createValidator()
  .field('Subject')
  .min(5).max(150)
  .noProfanity()
  .noSpam();

const messageValidator = createValidator()
  .field('Message')
  .min(10).max(2000)
  .noProfanity()
  .noSpam();   // blocks: URLs, "free money", "buy now", "viagra", etc.

// ─── Send function ────────────────────────────────────────────────────────────
interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactFormData): Promise<void> {
  // Validate every field BEFORE touching Nodemailer.
  // If any check fails, throw immediately — sendMail() is never called.
  const checks = [
    nameValidator.validate(data.name),
    subjectValidator.validate(data.subject),
    messageValidator.validate(data.message),
  ];

  for (const result of checks) {
    if (!result.isValid) {
      // result.reason → 'profanity' | 'spam' | 'gibberish' | ...
      // result.message → "Message: appears to contain spam."
      throw new Error(result.message);
    }
  }

  // ✅ All fields are clean — safe to send
  await transporter.sendMail({
    from: `"${data.name}" <${process.env.SMTP_USER}>`,
    replyTo: data.email,
    to: process.env.CONTACT_EMAIL,
    subject: data.subject,
    text: data.message,
  });
}
```

---

### Express route example

```typescript
import express from 'express';
import { sendContactEmail } from './mailer';

const router = express.Router();

router.post('/contact', async (req, res) => {
  try {
    await sendContactEmail(req.body);
    res.json({ success: true, message: 'Message sent.' });
  } catch (err) {
    // Validation errors and mail errors both surface here
    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to send message.',
    });
  }
});

export default router;
```

---

### How it works

`validateMailContent` uses a default validator configured with `noProfanity()` and `noSpam({ strictness: 'normal' })`. While the global default for `.noSpam()` is `low` (keywords only), email validation defaults to `normal` to protect against malicious URLs.

---

### What gets blocked before it reaches Nodemailer

| Input | Reason blocked |
|---|---|
| `"Buy vi4gra now!"` | `spam` — leet-evaded keyword |
| `"Check https://spam.com"` | `spam` — URL detected |
| `"Win fr33 m0n3y!"` | `spam` — leet-evaded phrase |
| `"sh!t service"` | `profanity` — leet-evaded |
| `"аsshole"` (Cyrillic а) | `profanity` — homoglyph bypass caught |
| `"asdfghjkl"` | `gibberish` — keyboard mash |
| `"test"` | `low_effort` — placeholder value |

---

### Without input-shield — what Nodemailer does

```typescript
// ❌ Nodemailer sends this with NO error — zero content validation
await transporter.sendMail({
  to: 'you@example.com',
  subject: 'Buy vi4gra now!!!',
  text: 'Win fr33 m0n3y at https://spam.com click here now',
});
// → Delivered. No exception. No warning.
```

`input-shield` is the layer that stops this **before** `sendMail()` is ever called.