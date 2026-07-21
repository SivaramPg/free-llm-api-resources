import type { LayoutKind } from './schema';

export type ProviderMeta = { layout: LayoutKind; colorOverride?: string };

/** Keyed by slugify(provider name from README). A new upstream provider
 *  requires adding one entry here — the parser fails loudly otherwise. */
export const PROVIDER_META: Record<string, ProviderMeta> = {
  // Free
  'openrouter': { layout: 'shared-quota' },
  'google-ai-studio': { layout: 'per-model-table' },
  'nvidia-nim': { layout: 'minimal' },
  'mistral-la-plateforme': { layout: 'minimal' },
  'mistral-codestral': { layout: 'minimal' },
  'huggingface-inference-providers': { layout: 'minimal' },
  'vercel-ai-gateway': { layout: 'minimal' },
  'opencode-zen': { layout: 'minimal' },
  'cerebras': { layout: 'per-model-table' },
  'groq': { layout: 'per-model-table' },
  'cohere': { layout: 'shared-quota' },
  'github-models': { layout: 'shared-quota' },
  'cloudflare-workers-ai': { layout: 'shared-quota' },
  // Trial credits
  'fireworks': { layout: 'credits' },
  'baseten': { layout: 'credits' },
  'nebius': { layout: 'credits' },
  'novita': { layout: 'credits' },
  'ai21': { layout: 'credits' },
  'upstage': { layout: 'credits' },
  'nlp-cloud': { layout: 'credits' },
  'alibaba-cloud-international-model-studio': { layout: 'credits' },
  'modal': { layout: 'credits' },
  'inference-net': { layout: 'credits' },
  'hyperbolic': { layout: 'credits' },
  'sambanova-cloud': { layout: 'credits' },
  'scaleway-generative-apis': { layout: 'credits' },
};
