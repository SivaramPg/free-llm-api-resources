import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseReadme } from '../src/data/parse-readme';

const md = readFileSync(new URL('./fixtures/README.fixture.md', import.meta.url), 'utf-8');
const providers = parseReadme(md);
const bySlug = Object.fromEntries(providers.map(p => [p.slug, p]));

describe('parseReadme', () => {
  it('parses all 26 providers, zod-valid', () => {
    expect(providers).toHaveLength(26);
  });

  it('per-model-table: groq models have own limits', () => {
    const groq = bySlug['groq'];
    expect(groq.layout).toBe('per-model-table');
    const llama = groq.models.find(m => m.name === 'Llama 3.1 8B')!;
    expect(llama.limits).toContainEqual({ value: 14400, unit: 'requests/day', raw: '14,400 requests/day' });
  });

  it('shared-quota: openrouter has provider limits + linked models', () => {
    const or = bySlug['openrouter'];
    expect(or.limits!.length).toBeGreaterThanOrEqual(2);
    expect(or.limitsUrl).toContain('openrouter.ai');
    expect(or.models.length).toBeGreaterThan(10);
    expect(or.models[0].url).toMatch(/^https:\/\/openrouter\.ai\//);
  });

  it('credits: fireworks has credit amount', () => {
    expect(bySlug['fireworks'].credits).toBe('$1');
    expect(bySlug['sambanova-cloud'].models.map(m => m.name)).toContain('deepseek-v3.1');
  });

  it('minimal: opencode-zen keeps plain model list', () => {
    expect(bySlug['opencode-zen'].models.map(m => m.name)).toContain('Big Pickle Stealth');
  });

  it('caveats extracted', () => {
    expect(bySlug['mistral-la-plateforme'].caveats).toContain('phone-verification');
    expect(bySlug['mistral-la-plateforme'].caveats).toContain('data-training');
    expect(bySlug['google-ai-studio'].caveats).toContain('data-training');
    expect(bySlug['google-ai-studio'].caveats).not.toContain('geo-restriction');
  });

  it('unknown provider fails loudly', () => {
    const evil = md.replace('### [Groq](https://console.groq.com)', '### [Brand New AI](https://new.ai)');
    expect(() => parseReadme(evil)).toThrow(/brand-new-ai/);
  });
});
