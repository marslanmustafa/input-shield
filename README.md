# @marslanmustafa/input-shield

[![npm version](https://img.shields.io/npm/v/@marslanmustafa/input-shield.svg)](https://www.npmjs.com/package/@marslanmustafa/input-shield)
[![test coverage](https://img.shields.io/codecov/c/github/marslanmustafa/input-shield)](https://codecov.io/gh/marslanmustafa/input-shield)
[![license](https://img.shields.io/npm/l/@marslanmustafa/input-shield)](LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)

> One install. No config. Clean inputs.  
> Profanity, spam, gibberish, and homoglyph detection in a single TypeScript-native zero-dependency package.

---

## Why input-shield?

Most profanity filters use a simple word list. They miss:

- **Leet-speak**: `Fr33 m0ney` → normalized → `free money` → caught
- **Homoglyph attacks**: Greek `о` instead of English `o` → normalized → caught
- **Unicode evasion**: `ｆｕｃｋ` (fullwidth) → normalized → caught
- **Split-tag HTML**: `<b>f</b>uck` → stripped → normalized → caught
- **Gibberish**: `asdfghjkl` passes every regex filter — not this one

input-shield runs a **full normalization pipeline** before any check, so evasion techniques don't work.

```
Raw Input
   ↓
Normalization  (leet-speak, homoglyphs, unicode, fullwidth)
   ↓
Skeleton       (removes repeated chars, punctuation tricks)
   ↓
Security Checks (profanity → spam → gibberish → structure)
   ↓
ValidationResult { isValid, reason, message }
```

---

## Installation

```bash
# npm
npm install @marslanmustafa/input-shield

# pnpm
pnpm add @marslanmustafa/input-shield

# yarn
yarn add @marslanmustafa/input-shield

# bun
bun add @marslanmustafa/input-shield
```

> **Node.js >= 18** required. Zero runtime dependencies.

---

## Quick Start

```ts
import { createValidator } from '@marslanmustafa/input-shield';

const validator = createValidator()
  .field('Username')
  .min(3)
  .max(30)
  .noProfanity()
  .noGibberish();

const result = validator.validate('asdfghjkl');

if (!result.isValid) {
  console.log(result.message); // "Username appears to be gibberish."
  console.log(result.reason);  // "GIBBERISH"
}
```

---

## Fluent API

Chain as many rules as you need. Every method returns `this` so chains are fully composable.

```ts
import { createValidator } from '@marslanmustafa/input-shield';

// Username
const username = createValidator()
  .field('Username')
  .min(3)
  .max(30)
  .noProfanity()
  .noGibberish({ sensitivity: 'strict' });

// Bio
const bio = createValidator()
  .field('Bio')
  .min(10)
  .max(300)
  .noProfanity()
  .noSpam()
  .noGibberish();

// Search query
const search = createValidator()
  .field('Search')
  .min(1)
  .max(100)
  .noSpam();

// Validate
const result = bio.validate('Buy cheap pills now!!! Click here!!!');
// { isValid: false, reason: 'SPAM', message: 'Bio appears to contain spam.' }
```

### Available chain methods

| Method | Description |
|---|---|
| `.field(name)` | Sets the field name used in error messages |
| `.min(n)` | Minimum character length |
| `.max(n)` | Maximum character length |
| `.noProfanity()` | Detects profanity including leet-speak and homoglyphs |
| `.noSpam()` | Detects spam patterns, excessive URLs, repeated phrases |
| `.noGibberish(options?)` | Detects keyboard mash and random character sequences |
| `.noExcessiveSymbols()` | Rejects inputs with too many special characters |
| `.validate(value)` | Runs all checks and returns `ValidationResult` |

---

## Presets

Ready-to-use validators for common fields. No configuration needed.

```ts
import {
  validateUsername,
  validateBio,
  validateShortText,
  validateLongText,
  validateSearchQuery,
} from '@marslanmustafa/input-shield';

validateUsername('h4ck3r_dude');
// { isValid: true }

validateUsername('ааааааааа'); // Cyrillic homoglyphs
// { isValid: false, reason: 'PROFANITY', message: '...' }

validateBio('Buy cheap Viagra now! Click here for free money!!!');
// { isValid: false, reason: 'SPAM', message: '...' }

validateShortText('asdfasdfasdf');
// { isValid: false, reason: 'GIBBERISH', message: '...' }

validateLongText('Hello, this is a proper comment about the topic.');
// { isValid: true }

validateSearchQuery('!!!!!!!!!!!!');
// { isValid: false, reason: 'EXCESSIVE_SYMBOLS', message: '...' }
```

| Preset | Min | Max | Checks |
|---|---|---|---|
| `validateUsername` | 3 | 30 | profanity, gibberish (strict) |
| `validateBio` | 10 | 300 | profanity, spam |
| `validateShortText` | 2 | 100 | profanity, spam, gibberish |
| `validateLongText` | 5 | 2000 | profanity, spam, gibberish |
| `validateSearchQuery` | 1 | 100 | spam, symbols |

---

## Zod Integration

Install Zod separately (`zod >= 3.0.0` is a peer dependency):

```bash
npm install zod
```

Import from the `/zod` subpath to keep Zod out of your main bundle if unused:

```ts
import { z } from 'zod';
import { shieldString, zodUsername, zodBio, zodShortText, zodLongText } from '@marslanmustafa/input-shield/zod';

// Custom validator with full fluent chain
const schema = z.object({
  username: shieldString(v => v.field('Username').min(3).max(20).noProfanity().noGibberish()),
  bio:      shieldString(v => v.field('Bio').min(10).max(300).noProfanity().noSpam()),
});

// Or use preset Zod helpers
const schema = z.object({
  username: zodUsername(),
  bio:      zodBio(),
  title:    zodShortText('Title'),
  body:     zodLongText('Body'),
});

// Works with React Hook Form, tRPC, Next.js API routes — anywhere Zod is used
const parsed = schema.safeParse({ username: 'cl3an_user', bio: 'Hello world!' });
```

---

## Email / Nodemailer Integration

Import from the `/email` subpath:

```ts
import { validateMailContent, stripHtml } from '@marslanmustafa/input-shield/email';
```

### Validate before sending

```ts
import nodemailer from 'nodemailer';
import { validateMailContent } from '@marslanmustafa/input-shield/email';

const mail = {
  subject: 'Your order is confirmed',
  html: '<p>Thanks for your purchase! <a href="https://yoursite.com">View order</a></p>',
};

const result = validateMailContent(mail);

if (!result.isValid) {
  // result.field  → 'subject' | 'text' | 'html'
  // result.reason → 'PROFANITY' | 'SPAM' | ...
  // result.message → human-readable string
  throw new Error(`Mail rejected on field "${result.field}": ${result.message}`);
}

await transporter.sendMail({ to: '...', ...mail });
```

### What it catches in HTML emails

```ts
import { stripHtml } from '@marslanmustafa/input-shield/email';

// Split-tag evasion
stripHtml('<b>f</b><b>uck</b>');          // → "f uck" → skeleton → "fuck"

// Decimal entity encoding
stripHtml('&#102;&#117;&#99;&#107;');      // → "fuck"

// Spam URLs in href
stripHtml('<a href="https://spam.com">click here</a>'); // → includes URL text

// CSS background trackers
stripHtml('<div style="background:url(https://tracker.spam.com/px)">hi</div>');
// → includes tracker URL for spam check
```

### Custom validator for email

```ts
import { createValidator } from '@marslanmustafa/input-shield';
import { validateMailContent } from '@marslanmustafa/input-shield/email';

const strictValidator = createValidator()
  .field('Email content')
  .min(1)
  .max(10000)
  .noProfanity()
  .noSpam();

const result = validateMailContent(
  { subject: 'Hello', html: '<p>Content here</p>' },
  strictValidator
);
```

---

## Core Primitives (Tree-Shakeable)

Use individual functions directly if you need fine-grained control:

```ts
import { toSkeleton, toStructural }              from '@marslanmustafa/input-shield';
import { containsProfanity }                     from '@marslanmustafa/input-shield';
import { containsSpam }                          from '@marslanmustafa/input-shield';
import { isGibberish, hasRepeatingChars }        from '@marslanmustafa/input-shield';
import { hasExcessiveSymbols, hasLowAlphabetRatio } from '@marslanmustafa/input-shield';

// Normalization
toSkeleton('Fr33 m0ney!!!');   // → "free money"
toStructural('ｆｕｃｋ');      // → "fuck"

// Individual checks
containsProfanity('h3ll yeah');  // → true
containsSpam('Buy now! Click here! Free!!!'); // → true
isGibberish('asdfghjkl');        // → true
hasRepeatingChars('heeeeello');  // → true
hasExcessiveSymbols('!!!###$$$'); // → true
```

---

## TypeScript Types

```ts
import type {
  ValidationResult,
  FailReason,
  GibberishSensitivity,
  ValidationOptions,
} from '@marslanmustafa/input-shield';

// ValidationResult
type ValidationResult =
  | { isValid: true }
  | { isValid: false; reason: FailReason; message: string };

// FailReason
type FailReason =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'PROFANITY'
  | 'SPAM'
  | 'GIBBERISH'
  | 'EXCESSIVE_SYMBOLS'
  | 'LOW_ALPHABET_RATIO'
  | 'REPEATED_CONTENT'
  | 'LOW_EFFORT';

// GibberishSensitivity
type GibberishSensitivity = 'strict' | 'normal' | 'loose';
```

---

## Real-World Examples

### Next.js API Route

```ts
import { validateUsername, validateBio } from '@marslanmustafa/input-shield';

export async function POST(req: Request) {
  const { username, bio } = await req.json();

  const usernameResult = validateUsername(username);
  if (!usernameResult.isValid) {
    return Response.json({ error: usernameResult.message }, { status: 400 });
  }

  const bioResult = validateBio(bio);
  if (!bioResult.isValid) {
    return Response.json({ error: bioResult.message }, { status: 400 });
  }

  // safe to write to DB
}
```

### tRPC Procedure

```ts
import { z } from 'zod';
import { zodUsername, zodBio } from '@marslanmustafa/input-shield/zod';

export const updateProfile = publicProcedure
  .input(z.object({
    username: zodUsername(),
    bio: zodBio(),
  }))
  .mutation(async ({ input }) => {
    // input is fully validated and typed
    await db.user.update({ data: input });
  });
```

### Express Middleware

```ts
import { createValidator } from '@marslanmustafa/input-shield';

const commentValidator = createValidator()
  .field('Comment')
  .min(5)
  .max(500)
  .noProfanity()
  .noSpam()
  .noGibberish();

app.post('/comments', (req, res) => {
  const result = commentValidator.validate(req.body.comment);
  if (!result.isValid) {
    return res.status(400).json({ error: result.message, reason: result.reason });
  }
  // save comment
});
```

---

## Contributing

Issues and PRs are welcome. Please open an issue first for major changes.

```bash
git clone https://github.com/marslanmustafa/input-shield
cd input-shield
npm install
npm run test:watch
```

---

## License

MIT © [Muhammad Arslan Mustafa](https://marslanmustafa.com)