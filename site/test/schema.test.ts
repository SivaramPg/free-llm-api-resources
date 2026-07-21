import { describe, it, expect } from 'vitest';
import { ProviderSchema, slugify } from '../src/data/schema';
import { PROVIDER_META } from '../src/data/provider-meta';

describe('slugify', () => {
  it('handles punctuation', () => {
    expect(slugify('Mistral (La Plateforme)')).toBe('mistral-la-plateforme');
    expect(slugify('Inference.net')).toBe('inference-net');
    expect(slugify('Alibaba Cloud (International) Model Studio')).toBe('alibaba-cloud-international-model-studio');
  });
});

describe('PROVIDER_META', () => {
  it('has all 26 providers', () => {
    expect(Object.keys(PROVIDER_META)).toHaveLength(26);
  });
  it('every entry has a valid layout', () => {
    for (const meta of Object.values(PROVIDER_META)) {
      expect(['per-model-table', 'shared-quota', 'credits', 'minimal']).toContain(meta.layout);
    }
  });
});

describe('ProviderSchema', () => {
  it('accepts a minimal valid provider', () => {
    expect(() => ProviderSchema.parse({
      slug: 'groq', name: 'Groq', url: 'https://console.groq.com',
      category: 'free', layout: 'per-model-table',
      caveats: [], notes: [], models: [],
    })).not.toThrow();
  });
  it('rejects unknown layout', () => {
    expect(() => ProviderSchema.parse({
      slug: 'x', name: 'X', url: 'https://x.com', category: 'free',
      layout: 'fancy', caveats: [], notes: [], models: [],
    })).toThrow();
  });
});
