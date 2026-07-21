import type { LayoutKind } from './schema';

export type ProviderMeta = { layout: LayoutKind; colorOverride?: string };

/** Keyed by slugify(provider name from README). A new upstream provider
 *  requires adding one entry here — the parser fails loudly otherwise. */
export const PROVIDER_META: Record<string, ProviderMeta> = {
  // Free
  'openrouter': { layout: 'shared-quota' },
  'google-ai-studio': { layout: 'per-model-table' },
  'nvidia-nim': { layout: 'minimal' },
  // colorOverride: extraction's 4-bit-bucket vote picked the icon's red
  // stripe (#e20500, higher pixel count) over its orange stripe; Mistral's
  // brand color is orange (#fa520f sampled from the icon's own gradient).
  'mistral-la-plateforme': { layout: 'minimal', colorOverride: '#fa520f' },
  'mistral-codestral': { layout: 'minimal', colorOverride: '#fa520f' },
  'huggingface-inference-providers': { layout: 'minimal' },
  'vercel-ai-gateway': { layout: 'minimal' },
  'opencode-zen': { layout: 'minimal' },
  'cerebras': { layout: 'per-model-table' },
  'groq': { layout: 'per-model-table' },
  // colorOverride: icon has 3 blobs (dark green, coral, purple); the dark
  // green blob wins on area, but Cohere's brand color is the coral
  // (#ff7759, sampled directly from the icon's coral blob).
  'cohere': { layout: 'shared-quota', colorOverride: '#ff7759' },
  'github-models': { layout: 'shared-quota' },
  // colorOverride: extraction landed on a red-shifted orange (#ff5c08);
  // replaced with Cloudflare's canonical brand orange.
  'cloudflare-workers-ai': { layout: 'shared-quota', colorOverride: '#f6821f' },
  // Trial credits
  // colorOverride: icon's near-white background (#f2f2f2, light gray, not
  // pure white) slipped past the near-white filter and out-scored the
  // logo's true violet (#590cff, sampled as the icon's max-saturation pixel).
  'fireworks': { layout: 'credits', colorOverride: '#590cff' },
  // colorOverride: sharp/libvips cannot decode .ico (raw BMP DIB inside),
  // sourced from baseten.co's own CSS palette (#19e76e brand green).
  'baseten': { layout: 'credits', colorOverride: '#19e76e' },
  // colorOverride: icon is a lime mark on a dark-navy tile; the tile
  // (#052b42) is much larger by area so it wins the vote even though it's
  // just the background. Overridden to the lime accent (#e0ff4f, sampled
  // from the icon and confirmed present in nebius.com's own CSS palette).
  'nebius': { layout: 'credits', colorOverride: '#e0ff4f' },
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
