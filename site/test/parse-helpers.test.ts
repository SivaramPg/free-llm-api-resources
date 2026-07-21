import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { splitSections, parseLimitString, parseLimitsBlock } from '../src/data/parse-helpers';

const md = readFileSync(new URL('./fixtures/README.fixture.md', import.meta.url), 'utf-8');

describe('splitSections', () => {
  const sections = splitSections(md);
  it('finds 26 sections', () => expect(sections).toHaveLength(26));
  it('categorizes free vs trial', () => {
    expect(sections.filter(s => s.category === 'free')).toHaveLength(13);
    expect(sections.filter(s => s.category === 'trial')).toHaveLength(13);
  });
  it('extracts name and url', () => {
    const or = sections.find(s => s.name === 'OpenRouter')!;
    expect(or.url).toBe('https://openrouter.ai');
    expect(or.body).toContain('Models share a common quota.');
  });
});

describe('parseLimitString', () => {
  it('parses value + unit', () => {
    expect(parseLimitString('250,000 tokens/minute')).toEqual(
      { value: 250000, unit: 'tokens/minute', raw: '250,000 tokens/minute' });
  });
  it('keeps unparseable strings with null value', () => {
    expect(parseLimitString('Up to 1000 requests/day with $10 lifetime topup').value).toBeNull();
  });
});

describe('parseLimitsBlock', () => {
  it('parses linked multi-line limits', () => {
    const r = parseLimitsBlock('[20 requests/minute<br>50 requests/day](https://openrouter.ai/docs/api/reference/limits)');
    expect(r.limitsUrl).toBe('https://openrouter.ai/docs/api/reference/limits');
    expect(r.limits).toHaveLength(2);
    expect(r.limits[0]).toEqual({ value: 20, unit: 'requests/minute', raw: '20 requests/minute' });
  });
  it('parses inline comma-separated limits', () => {
    const r = parseLimitsBlock('30 requests/minute, 2,000 requests/day');
    expect(r.limits.map(l => l.value)).toEqual([30, 2000]);
  });
});
