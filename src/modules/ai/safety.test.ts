import { describe, it, expect } from 'vitest';
import { checkSafety, validateJson } from './safety';

describe('checkSafety', () => {
  it('passes a normal supportive message', () => {
    expect(checkSafety('Nice work today — keep the streak going.').ok).toBe(true);
  });
  it('flags medical diagnosis language', () => {
    expect(checkSafety('It sounds like you have depression.').flags).toContain('medical_claim');
  });
  it('flags shaming language', () => {
    expect(checkSafety("You're lazy and you always fail.").flags).toContain('shaming');
  });
  it('flags unsafe advice', () => {
    expect(checkSafety('Just starve yourself for a week.').flags).toContain('unsafe_advice');
  });
});

describe('validateJson', () => {
  it('accepts valid json', () => {
    expect(validateJson('{"a":1}')).toMatchObject({ ok: true });
  });
  it('rejects invalid json', () => {
    expect(validateJson('not json').ok).toBe(false);
  });
});
