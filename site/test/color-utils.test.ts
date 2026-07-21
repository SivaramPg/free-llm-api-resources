import { describe, it, expect } from 'vitest';
import { contrastRatio, mixOver, adjustForContrast } from '../src/data/color-utils';

describe('color-utils', () => {
  it('contrastRatio: black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
  it('mixOver composites alpha', () => {
    expect(mixOver('#ff0000', '#ffffff', 0.5)).toBe('#ff8080');
  });
  it('adjustForContrast reaches 4.5 on light bg', () => {
    const adjusted = adjustForContrast('#f6821f', '#faf8f5', 4.5); // cloudflare orange
    expect(contrastRatio(adjusted, '#faf8f5')).toBeGreaterThanOrEqual(4.5);
  });
  it('adjustForContrast reaches 4.5 on dark bg', () => {
    const adjusted = adjustForContrast('#1a1a2e', '#141416', 4.5);
    expect(contrastRatio(adjusted, '#141416')).toBeGreaterThanOrEqual(4.5);
  });
});
