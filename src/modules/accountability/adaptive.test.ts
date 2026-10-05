import { describe, it, expect } from 'vitest';
import { recommendStyle } from './adaptive';

describe('recommendStyle', () => {
  it('is not confident without enough data', () => {
    const r = recommendStyle([{ style: 'supportive', completed: 1, missed: 1 }], 'supportive');
    expect(r.recommendedStyle).toBeNull();
    expect(r.confident).toBe(false);
  });

  it('keeps current style when it is already best', () => {
    const r = recommendStyle(
      [
        { style: 'supportive', completed: 8, missed: 1 },
        { style: 'direct', completed: 2, missed: 6 },
      ],
      'supportive',
    );
    expect(r.recommendedStyle).toBe('supportive');
  });

  it('switches when another style is meaningfully better', () => {
    const r = recommendStyle(
      [
        { style: 'supportive', completed: 2, missed: 6 },
        { style: 'challenging', completed: 7, missed: 1 },
      ],
      'supportive',
    );
    expect(r.recommendedStyle).toBe('challenging');
    expect(r.confident).toBe(true);
  });

  it('does not thrash on a marginal difference', () => {
    const r = recommendStyle(
      [
        { style: 'supportive', completed: 5, missed: 3 },
        { style: 'direct', completed: 5, missed: 2 },
      ],
      'supportive',
    );
    expect(r.recommendedStyle).toBe('supportive');
  });
});
