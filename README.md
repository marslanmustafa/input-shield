# @marslanmustafa/input-shield

[![npm version](https://img.shields.io/npm/v/@marslanmustafa/input-shield.svg)](https://www.npmjs.com/package/@marslanmustafa/input-shield)
[![test coverage](https://img.shields.io/codecov/c/github/marslanmustafa/input-shield)](https://codecov.io/gh/marslanmustafa/input-shield)
[![license](https://img.shields.io/npm/l/@marslanmustafa/input-shield)](LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)

> **One install. No config. Clean inputs.**
>
> Profanity · Spam · Gibberish · Leet-speak · Homoglyphs — all in one zero-dependency TypeScript package.

---

## Why @marslanmustafa/input-shield?

| Problem | Old way (3+ packages) | @marslanmustafa/input-shield |
|---|---|---|
| Block profanity | `npm i obscenity` | ✅ built in |
| Catch `f.u.c.k` / `f@ck` / `ｆｕｃｋ` | Manual regex + leet map | ✅ 3-stage normalization |
| Catch Cyrillic `аss` (homoglyph bypass) | Nobody does this | ✅ NFKC + homoglyph map |
| Block spam URLs | `npm i validator` | ✅ built in |
| Detect keyboard mash | Hand-rolled heuristics | ✅ `loose/normal/strict` scale |
| Zod integration | 20 lines of glue code | ✅ `import from '@marslanmustafa/input-shield/zod'` |
| TypeScript types | Often partial | ✅ first-class, discriminated union |
| Tree-shakeable | Rarely | ✅ every function importable alone |

---

## Install

```bash
npm install @marslanmustafa/@marslanmustafa/input-shield
pnpm add @marslanmustafa/@marslanmustafa/input-shield
yarn add @marslanmustafa/@marslanmustafa/input-shield
```

---

## Quick start

```typescript
import { createValidator } from '@marslanmustafa/input-shield';

const usernameValidator = createValidator()
  .field('Username')
  .min(3).max(30)
  .noProfanity()
  .noGibberish({ sensitivity: 'strict' })
  .noSpam();

const result = usernameValidator.validate(userInput);

if (!result.isValid) {
  console.log(result.reason);   // 'profanity' | 'gibberish' | 'spam' | ...
  console.log(result.message);  // "Username: contains inappropriate language."
}
```

---

## Presets (zero-config)

```typescript
import {
  validateUsername,
  validateBio,
  validateShortText,
  validateLongText,
  validateSearchQuery,
} from '@marslanmustafa/input-shield';

validateUsername('alice_dev');     // { isValid: true }
validateUsername('f4ck3r');        // { isValid: false, reason: 'profanity', message: '...' }
validateBio('Software engineer from Lahore'); // { isValid: true }
validateShortText('test');         // { isValid: false, reason: 'low_effort', message: '...' }
```

---

## Integrations

- 📧 [Nodemailer — validate email content before sending](./NODEMAILER.md)
## Fluent builder API

```typescript
import { createValidator } from '@marslanmustafa/input-shield';

createValidator()
  .field('Product Name')    // shown in error messages
  .min(2).max(60)           // length bounds
  .noProfanity()            // catches leet, homoglyphs, dots (f.u.c.k), fullwidth (ｆｕｃｋ)
  .noSpam()                 // keywords + URLs (on raw text — not destroyed by normalization)
  .noGibberish({            // sensitivity: 'loose' | 'normal' | 'strict'
    sensitivity: 'normal',  // default — good for most fields
  })
  .noLowQuality()           // exact matches (test, asdf), excessive symbols, low letter ratio
  .noRepeatedWords()        // catches "cat cat cat" (ignores stop words)
  .allow('nginx', 'kubectl') // allowlist bypasses ALL checks (brand names, tech terms)
  .custom(                  // custom rule — return true to BLOCK
    t => t.startsWith('@'),
    'custom',
    'names cannot start with @'
  )
  .validate(text);          // → ValidationResult
```

---

## Zod integration

```bash
# zod is a peer dependency — install it separately
npm install zod @marslanmustafa/input-shield
```

```typescript
import { z } from 'zod';
import { shieldString, zodUsername, zodBio } from '@marslanmustafa/input-shield/zod';

// Preset schemas
const schema = z.object({
  username: zodUsername(),
  bio: zodBio(),
});

// Custom configured schema
const customSchema = z.object({
  productName: shieldString(v =>
    v.field('Product Name').min(2).max(60).noProfanity().noSpam()
  ),
});

// Usage with react-hook-form + zod resolver — zero extra code
```

---

## How the normalization pipeline works

This is the core innovation. Input is processed through 3 stages before any check runs:

```
Input: "P.0.r.n" or "ｆｕｃｋ" or "аss" (Cyrillic а) or "f@ck"
       │
       ▼ Stage 1: Unicode NFKC
         Collapses fullwidth, math-bold, ligatures, zero-width chars
         "ｆｕｃｋ" → "fuck"  |  "𝐅𝐔𝐂𝐊" → "FUCK"
       │
       ▼ Stage 2: Separator stripping
         Removes dots/dashes between single chars
         "P.0.r.n" → "P0rn"  |  "f-u-c-k" → "fuck"
       │
       ▼ Stage 3: Homoglyph map (Cyrillic/Greek/Armenian → Latin)
         "аss" (Cyrillic а U+0430) → "ass"
         "ρorn" (Greek ρ) → "porn"
       │
       ▼ Stage 4: Leet-speak substitution
         "0" → "o", "@" → "a", "$" → "s", "!" → "i" …
         "f@ck" → "fack"  |  "@ss" → "ass"
       │
       ▼ Skeleton: "fuck" / "ass" / "porn"
         Pattern matching runs here ───────────────► BLOCKED
         Error messages reference ORIGINAL input ──► "f@ck"
```

---

## API Reference

### `createValidator(): InputShieldValidator`
Returns a new fluent builder instance.

### Builder methods

| Method | Description |
|---|---|
| `.field(name)` | Set field label for error messages |
| `.min(n)` | Minimum length. Default: 2 |
| `.max(n)` | Maximum length. Default: 500 |
| `.allow(...words)` | Allowlist — bypasses all checks |
| `.noProfanity()` | Block profanity (all evasions caught) |
| `.noSpam()` | Block spam keywords and URLs |
| `.noGibberish(opts?)` | Block keyboard mash. `opts.sensitivity`: `'loose'` / `'normal'` / `'strict'` |
| `.noLowQuality()` | Block exact low-effort matches, excessive symbols, low letter ratio |
| `.noRepeatedWords()` | Block inputs with many repeated content words |
| `.custom(fn, reason, msg)` | Custom rule. `fn(text) => true` to BLOCK |
| `.validate(text)` | Run all checks. Returns `ValidationResult` |
| `.validateOrThrow(text)` | Throws on invalid input. Useful in Zod `.superRefine()` |

### `ValidationResult` (discriminated union)

```typescript
type ValidationResult =
  | { isValid: true }
  | { isValid: false; reason: FailReason; message: string };

type FailReason =
  | 'empty' | 'too_short' | 'too_long'
  | 'profanity' | 'spam'
  | 'gibberish' | 'low_effort' | 'repeating_chars' | 'excessive_symbols'
  | 'homoglyph_attack' | 'custom';
```

### Sensitivity scale

| Sensitivity | Consonant run | Vowel ratio check | Best for |
|---|---|---|---|
| `'loose'` | 7+ in a row | ≥ 12 chars, < 5% vowels | Bio, non-English names |
| `'normal'` | 6+ in a row | ≥ 8 chars, < 10% vowels | Most fields |
| `'strict'` | 5+ in a row | ≥ 6 chars, < 15% vowels | Usernames, display names |

---

## Tree-shaking

Every module is independently importable:

```typescript
import { toSkeleton } from '@marslanmustafa/input-shield';           // normalization only
import { containsProfanity } from '@marslanmustafa/input-shield';     // profanity only
import { isGibberish } from '@marslanmustafa/input-shield';           // gibberish only
```

---

## Bundle size

| Import | Size (minzipped) |
|---|---|
| `createValidator` (full builder) | ~4 KB |
| `containsProfanity` only | ~1.5 KB |
| `@marslanmustafa/input-shield/zod` | +1 KB (zod external) |

---

## License

MIT © [Muhammad Arslan](https://marslanmustafa.com)
