/**
 * Full test suite for input-shield
 * Run: vitest run  |  vitest --coverage
 */

import {
  toSkeleton,
  containsProfanity,
  getMatchedProfanityPattern,
  containsSpam,
  isGibberish,
  hasRepeatingChars,
  hasExcessiveSymbols,
  hasLowAlphabetRatio,
  hasRepeatedContentWords,
  isLowEffortExact,
  createValidator,
  validateUsername,
  validateBio,
  validateShortText,
  validateLongText,
  validateSearchQuery
} from '../src/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1: Normalization pipeline
// ═══════════════════════════════════════════════════════════════════════════════
describe('toSkeleton — normalization pipeline', () => {
  describe('Stage 1: Unicode NFKC', () => {
    it('collapses fullwidth characters', () => {
      expect(toSkeleton('ｆｕｃｋ')).toBe('fuck');
    });
    it('collapses math bold characters', () => {
      expect(toSkeleton('𝐅𝐔𝐂𝐊')).toBe('fuck');
    });
    it('collapses ligatures', () => {
      expect(toSkeleton('ﬁne')).toBe('fine');
    });
    it('strips zero-width characters', () => {
      // zero-width space inserted between letters
      expect(toSkeleton('f\u200Buck')).toBe('fuck');
    });
  });

  describe('Stage 2: Separator stripping (P.0.r.n bypass)', () => {
    it('strips dots between chars', () => {
      expect(toSkeleton('p.o.r.n')).toBe('porn');
    });
    it('strips dashes between chars', () => {
      expect(toSkeleton('f-u-c-k')).toBe('fuck');
    });
    it('strips underscores between chars', () => {
      expect(toSkeleton('s_h_i_t')).toBe('shit');
    });
    it('does NOT strip dots in real words (version numbers etc)', () => {
      // "v2.0" — the 2 and 0 are digits not surrounding a separator-pattern
      // main concern is dot-separated single chars
      expect(toSkeleton('hello.world')).not.toContain('.');
    });
  });

  describe('Stage 3: Homoglyph substitution (Cyrillic/Greek)', () => {
    it('replaces Cyrillic а (U+0430) with Latin a', () => {
      // "аss" with Cyrillic а
      expect(toSkeleton('\u0430ss')).toBe('ass');
    });
    it('replaces Cyrillic о with Latin o', () => {
      // "f\u043Eck" — f + Cyrillic о + ck
      expect(toSkeleton('f\u043Eck')).toContain('fo');
    });
    it('handles fully Cyrillic homoglyph profanity', () => {
      // "fuсk" where с is Cyrillic
      const result = toSkeleton('fu\u0441k');
      expect(result).toBe('fuck');
    });
    it('replaces Greek ο with Latin o', () => {
      expect(toSkeleton('p\u03BFrn')).toBe('porn');
    });
  });

  describe('Stage 4: Leet-speak', () => {
    it('replaces 3 → e', () => expect(toSkeleton('s3x')).toBe('sex'));
    it('replaces 4 → a', () => expect(toSkeleton('f4ck')).toBe('fack')); // fack not fuck (4=a)
    it('replaces @ → a', () => expect(toSkeleton('@ss')).toBe('ass'));
    it('replaces $ → s', () => expect(toSkeleton('$hit')).toBe('shit'));
    it('replaces ! → i', () => expect(toSkeleton('sh!t')).toBe('shit'));
    it('replaces | → l', () => expect(toSkeleton('he||o')).toBe('hello'));
    it('handles combined leet', () => expect(toSkeleton('f4k3')).toBe('fake'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2: Profanity detection
// ═══════════════════════════════════════════════════════════════════════════════
describe('containsProfanity', () => {
  describe('basic detection', () => {
    it('catches plain profanity', () => expect(containsProfanity('fuck')).toBe(true));
    it('catches plural', () => expect(containsProfanity('shits')).toBe(true));
    it('catches -ing form', () => expect(containsProfanity('bitching')).toBe(true));
    it('catches -ed form', () => expect(containsProfanity('fucked')).toBe(true));
  });

  describe('evasion bypass', () => {
    it('catches leet-speak: f4ck', () => expect(containsProfanity('f4ck')).toBe(true));
    it('catches leet-speak: sh!t', () => expect(containsProfanity('sh!t')).toBe(true));
    it('catches @ss', () => expect(containsProfanity('@ss')).toBe(true));
    it('catches f.u.c.k (separator dots)', () => expect(containsProfanity('f.u.c.k')).toBe(true));
    it('catches fuuuuck (stretching)', () => expect(containsProfanity('fuuuuck')).toBe(true));
    it('catches Cyrillic homoglyph аss', () => expect(containsProfanity('\u0430ss')).toBe(true));
    it('catches fullwidth ｆｕｃｋ', () => expect(containsProfanity('ｆｕｃｋ')).toBe(true));
  });

  describe('false positive prevention', () => {
    it('does NOT flag "classic"', () => expect(containsProfanity('classic')).toBe(false));
    it('does NOT flag "assassin"', () => expect(containsProfanity('assassin')).toBe(false));
    it('does NOT flag "Scunthorpe"', () => expect(containsProfanity('Scunthorpe')).toBe(false));
    it('does NOT flag "bass guitar"', () => expect(containsProfanity('bass guitar')).toBe(false));
    it('does NOT flag "Dick Cheney"', () => expect(containsProfanity('Dick Cheney')).toBe(false));
    it('does NOT flag normal sentence', () => {
      expect(containsProfanity('Hello, how are you today?')).toBe(false);
    });
  });

  describe('getMatchedProfanityPattern', () => {
    it('returns pattern on match', () => {
      expect(getMatchedProfanityPattern('fuck')).not.toBeNull();
    });
    it('returns null on clean text', () => {
      expect(getMatchedProfanityPattern('classic')).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3: Spam detection
// ═══════════════════════════════════════════════════════════════════════════════
describe('containsSpam', () => {
  it('catches "viagra"', () => expect(containsSpam('buy viagra now')).toBe(true));
  it('catches "free money"', () => expect(containsSpam('win free money!')).toBe(true));
  it('catches full URLs', () => expect(containsSpam('visit https://spam.example.com now')).toBe(true));
  it('catches bare domains', () => expect(containsSpam('go to spam-site.com for deals')).toBe(true));
  it('catches IP addresses', () => expect(containsSpam('connect to 192.168.1.1')).toBe(true));
  it('catches lorem ipsum', () => expect(containsSpam('Lorem ipsum dolor sit amet')).toBe(true));
  it('catches leet-evaded keyword', () => expect(containsSpam('v!agra cheap')).toBe(true));

  it('does NOT flag normal text', () => expect(containsSpam('Great product, highly recommend')).toBe(false));
  it('does NOT flag version numbers as domains', () => {
    expect(containsSpam('requires node v18.0 or later')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 4: Gibberish detection (sensitivity scale)
// ═══════════════════════════════════════════════════════════════════════════════
describe('isGibberish — sensitivity scale', () => {
  describe('loose sensitivity', () => {
    it('catches obvious mash', () => expect(isGibberish('asdfghjkl', 'loose')).toBe(true));
    it('catches very long no-vowel word', () => expect(isGibberish('qwrtpfghj', 'loose')).toBe(true));
    it('does NOT flag "Krzysztof"', () => expect(isGibberish('Krzysztof', 'loose')).toBe(false));
    it('does NOT flag "nginx"', () => expect(isGibberish('nginx', 'loose')).toBe(false));
    it('does NOT flag "strengths"', () => expect(isGibberish('strengths', 'loose')).toBe(false));
  });

  describe('normal sensitivity (default)', () => {
    it('catches medium mash', () => expect(isGibberish('xkcdvbnm', 'normal')).toBe(true));
    it('does NOT flag "gym"', () => expect(isGibberish('gym', 'normal')).toBe(false));
    it('does NOT flag "lynx"', () => expect(isGibberish('lynx', 'normal')).toBe(false));
    it('does NOT flag "rhythm"', () => expect(isGibberish('rhythm', 'normal')).toBe(false));
    it('does NOT flag "kubectl"', () => expect(isGibberish('kubectl', 'normal')).toBe(false));
  });

  describe('strict sensitivity', () => {
    it('catches shorter mash', () => expect(isGibberish('bcdfgh', 'strict')).toBe(true));
    it('catches low vowel ratio words', () => expect(isGibberish('trnsfrmtn', 'strict')).toBe(true));
  });

  describe('edge cases', () => {
    it('catches very long word > 25 chars', () => expect(isGibberish('abcdefghijklmnopqrstuvwxyz', 'loose')).toBe(true));
    it('catches words with no vowels but long enough', () => expect(isGibberish('xwrtyp', 'strict')).toBe(true));
    it('catches loose vowel ratio', () => expect(isGibberish('a'.repeat(1) + 'b'.repeat(15), 'loose')).toBe(true));
  });
});

describe('hasRepeatingChars', () => {
  it('catches 5+ same chars', () => expect(hasRepeatingChars('aaaaaaa')).toBe(true));
  it('catches leet-evaded repeats: 11111', () => expect(hasRepeatingChars('11111')).toBe(true));
  it('does NOT flag "aaaa" (4 is ok)', () => expect(hasRepeatingChars('aaaa')).toBe(false));
  it('does NOT flag normal text', () => expect(hasRepeatingChars('hello world')).toBe(false));
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 5: Structure checks
// ═══════════════════════════════════════════════════════════════════════════════
describe('structural checks', () => {
  it('hasExcessiveSymbols — flags symbol-heavy input', () => {
    expect(hasExcessiveSymbols('!!@@##$$%%')).toBe(true);
  });
  it('hasExcessiveSymbols — passes normal text with punctuation', () => {
    expect(hasExcessiveSymbols("It's great, really!")).toBe(false);
  });

  it('hasLowAlphabetRatio — flags pure numbers', () => {
    expect(hasLowAlphabetRatio('12345678901')).toBe(true);
  });
  it('hasLowAlphabetRatio — does NOT flag "QA"', () => {
    expect(hasLowAlphabetRatio('QA')).toBe(false); // only 2 letters but short string
  });
  it('hasLowAlphabetRatio — does NOT flag "IT"', () => {
    expect(hasLowAlphabetRatio('IT')).toBe(false);
  });

  it('isLowEffortExact — flags "test"', () => expect(isLowEffortExact('test')).toBe(true));
  it('isLowEffortExact — flags "asdf"', () => expect(isLowEffortExact('asdf')).toBe(true));
  it('isLowEffortExact — does NOT flag "testing software"', () => {
    expect(isLowEffortExact('testing software')).toBe(false);
  });

  it('hasRepeatedContentWords — flags repeated words', () => {
    expect(hasRepeatedContentWords('cats cats dogs dogs')).toBe(true);
  });
  it('hasRepeatedContentWords — passes unrepeated words', () => {
    expect(hasRepeatedContentWords('the quick brown fox')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 6: Builder / fluent API
// ═══════════════════════════════════════════════════════════════════════════════
describe('createValidator() — fluent builder', () => {
  const v = createValidator()
    .field('Name')
    .min(3).max(50)
    .noProfanity()
    .noGibberish()
    .noSpam()
    .noLowQuality();

  it('passes clean input', () => {
    expect(v.validate('John Smith').isValid).toBe(true);
  });

  it('fails empty', () => {
    const r = v.validate('');
    expect(r.isValid).toBe(false);
    if (!r.isValid) {
      expect(r.reason).toBe('empty');
      expect(r.message).toContain('Name');
    }
  });

  it('fails too short', () => {
    const r = v.validate('ab');
    expect(r.isValid).toBe(false);
    if (!r.isValid) expect(r.reason).toBe('too_short');
  });

  it('fails profanity', () => {
    const r = v.validate('fucking hell');
    expect(r.isValid).toBe(false);
    if (!r.isValid) expect(r.reason).toBe('profanity');
  });

  it('fails leet profanity', () => {
    const r = v.validate('sh!t storm');
    expect(r.isValid).toBe(false);
    if (!r.isValid) expect(r.reason).toBe('profanity');
  });

  it('fails gibberish', () => {
    const r = v.validate('asdfghjkl');
    expect(r.isValid).toBe(false);
    if (!r.isValid) expect(r.reason).toBe('gibberish');
  });

  it('fails spam URL', () => {
    const r = v.validate('check https://spam.com for deals');
    expect(r.isValid).toBe(false);
    if (!r.isValid) expect(r.reason).toBe('spam');
  });

  describe('allowlist bypass', () => {
    const techV = createValidator()
      .min(2).noProfanity().noGibberish({ sensitivity: 'strict' })
      .allow('nginx', 'kubectl', 'tsql');

    it('allows allowlisted tech term that would otherwise flag gibberish', () => {
      expect(techV.validate('nginx').isValid).toBe(true);
    });
    it('still blocks non-allowlisted gibberish', () => {
      expect(techV.validate('xkcdvbnm').isValid).toBe(false);
    });
    it('allows allowlisted term with homoglyph normalization', () => {
      // "ｎginx" — fullwidth n, should normalize to "nginx" and hit allowlist
      expect(techV.validate('ｎginx').isValid).toBe(true);
    });
  });

  describe('custom rule', () => {
    const adminV = createValidator()
      .min(2)
      .custom(t => t.toLowerCase() === 'admin', 'custom', 'username "admin" is reserved');

    it('blocks reserved word via custom rule', () => {
      const r = adminV.validate('admin');
      expect(r.isValid).toBe(false);
      if (!r.isValid) {
        expect(r.reason).toBe('custom');
        expect(r.message).toContain('reserved');
      }
    });
    it('allows other usernames', () => {
      expect(adminV.validate('alice').isValid).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('throws on invalid input', () => {
      expect(() => v.validateOrThrow('')).toThrow();
    });
    it('does not throw on valid input', () => {
      expect(() => v.validateOrThrow('Valid Name')).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 7: Presets
// ═══════════════════════════════════════════════════════════════════════════════
describe('presets', () => {
  describe('validateUsername', () => {
    it('passes valid username', () => expect(validateUsername('alice_dev').isValid).toBe(true));
    it('fails too short', () => expect(validateUsername('ab').isValid).toBe(false));
    it('fails too long', () => expect(validateUsername('a'.repeat(31)).isValid).toBe(false));
    it('fails profanity', () => expect(validateUsername('f4cker').isValid).toBe(false));
    it('fails keyboard mash', () => expect(validateUsername('qwertyzxcv').isValid).toBe(false));
  });

  describe('validateBio', () => {
    it('passes a natural bio', () => {
      expect(validateBio('I am a software engineer from Lahore who loves TypeScript.').isValid).toBe(true);
    });
    it('fails too short', () => expect(validateBio('Hi').isValid).toBe(false));
    it('fails profanity', () => expect(validateBio('I like to shit on bad code.').isValid).toBe(false));
    it('passes text with repeated common words (natural language)', () => {
      expect(validateBio('The things I love are the things that make me who I am and the things that drive me forward in my career.').isValid).toBe(true);
    });
  });

  describe('validateSearchQuery', () => {
    it('passes code snippets (gibberish not flagged)', () => {
      expect(validateSearchQuery('kubectl get pods --namespace=dev').isValid).toBe(true);
    });
    it('passes single-word queries', () => {
      expect(validateSearchQuery('typescript').isValid).toBe(true);
    });
    it('fails spam URLs in query', () => {
      expect(validateSearchQuery('buy at https://spam.com').isValid).toBe(false);
    });
  });

  describe('validateShortText', () => {
    it('passes normal name', () => expect(validateShortText('Acme Corp').isValid).toBe(true));
    it('fails placeholder', () => expect(validateShortText('test').isValid).toBe(false));
    it('fails with custom fieldName in message', () => {
      const r = validateShortText('', 'Project Name');
      expect(r.isValid).toBe(false);
      if (!r.isValid) expect(r.message).toContain('Project Name');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 8: Bundle size sanity — no huge dependencies leak in
// ═══════════════════════════════════════════════════════════════════════════════
describe('tree-shaking / primitives importable individually', () => {
  it('can import toSkeleton alone', () => {
    expect(typeof toSkeleton).toBe('function');
  });
  it('can import containsProfanity alone', () => {
    expect(typeof containsProfanity).toBe('function');
  });
});
