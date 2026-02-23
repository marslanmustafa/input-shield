import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  shieldString,
  zodUsername,
  zodBio,
  zodShortText,
  zodLongText,
} from '../src/zod.js';

describe('zod integration', () => {
  describe('shieldString', () => {
    const schema = z.object({
      custom: shieldString(v => v.field('Custom').min(5).noProfanity()),
    });

    it('passes valid input', () => {
      const result = schema.safeParse({ custom: 'hello world' });
      expect(result.success).toBe(true);
    });

    it('fails on constraint', () => {
      const result = schema.safeParse({ custom: 'hi' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Custom must be at least');
        expect((result.error.issues[0] as any).params?.reason).toBe('too_short');
      }
    });

    it('fails on profanity', () => {
      const result = schema.safeParse({ custom: 'fucking hell' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Custom contains inappropriate');
        expect((result.error.issues[0] as any).params?.reason).toBe('profanity');
      }
    });
  });

  describe('presets', () => {
    it('zodUsername passes', () => {
      expect(zodUsername().safeParse('valid_user').success).toBe(true);
    });

    it('zodUsername fails', () => {
      const result = zodUsername().safeParse('ab');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Username');
      }
    });

    it('zodBio passes', () => {
      expect(zodBio().safeParse('I am a developer from Earth.').success).toBe(true);
    });

    it('zodBio fails', () => {
      expect(zodBio().safeParse('sh!t').success).toBe(false);
    });

    it('zodShortText passes', () => {
      expect(zodShortText().safeParse('Acme Corp').success).toBe(true);
    });

    it('zodShortText fails', () => {
      expect(zodShortText('Text').safeParse('a').success).toBe(false);
    });

    it('zodLongText passes', () => {
      expect(zodLongText().safeParse('This is a longer text that should pass the validation.').success).toBe(true);
    });

    it('zodLongText fails', () => {
      expect(zodLongText('Article').safeParse('asdf').success).toBe(false);
    });
  });
});
