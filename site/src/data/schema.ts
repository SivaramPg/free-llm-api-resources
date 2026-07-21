import { z } from 'zod';

export const LimitSchema = z.object({
  value: z.number().nullable(), // null when unparseable (kept as raw)
  unit: z.string(),             // e.g. "tokens/minute"
  raw: z.string(),              // verbatim, e.g. "250,000 tokens/minute"
});

export const CaveatSchema = z.enum(['phone-verification', 'data-training', 'geo-restriction']);

export const ModelSchema = z.object({
  name: z.string().min(1),
  url: z.url().optional(),
  limits: z.array(LimitSchema).optional(),
});

export const LayoutKindSchema = z.enum(['per-model-table', 'shared-quota', 'credits', 'minimal']);

export const ProviderSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  category: z.enum(['free', 'trial']),
  layout: LayoutKindSchema,
  caveats: z.array(CaveatSchema),
  notes: z.array(z.string()),
  limits: z.array(LimitSchema).optional(),
  limitsUrl: z.url().optional(),
  credits: z.string().optional(),
  models: z.array(ModelSchema),
});

export type Limit = z.infer<typeof LimitSchema>;
export type Caveat = z.infer<typeof CaveatSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type LayoutKind = z.infer<typeof LayoutKindSchema>;
export type Provider = z.infer<typeof ProviderSchema>;

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
