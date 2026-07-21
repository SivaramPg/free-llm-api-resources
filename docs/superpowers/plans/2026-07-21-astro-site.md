# freellm.sivaram.dev Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Astro static site in `site/` presenting the README's provider data as a searchable, brand-colored UI, deployed to Cloudflare Workers at freellm.sivaram.dev.

**Architecture:** Build-time parser turns `README.md` into zod-validated `Provider[]` (4 layout kinds). One-shot scripts fetch favicons, extract brand colors into `brand.json`, and capture screenshots (agent-browser). Hub page + 26 static provider pages; vanilla-JS MiniSearch island; pure static output.

**Tech Stack:** Astro 6 (static), TypeScript strict, zod, cheerio 1.2, sharp 0.35, minisearch 7, vitest, @fontsource-variable/{mozilla-headline,dm-sans,geist-mono} 5.3, wrangler.

**Spec:** `docs/superpowers/specs/2026-07-21-astro-site-design.md`

## Global Constraints

- Canonical origin: `https://freellm.sivaram.dev` (astro.config `site`).
- Never modify `README.md`, `src/*.py`, or `src/README_template.md` — upstream-owned.
- Everything lives under `site/` except GitHub workflow + spec/plan docs.
- No pure `#000`/`#fff` anywhere: dark bg family `#141416`, light bg family `#faf8f5`.
- Fonts self-hosted via Fontsource variable packages only — no Google Fonts requests.
- No UI framework; interactivity is vanilla `<script>` modules.
- Parser failures must throw (fail the build) — never silently skip a provider.
- All commands run from `site/` unless stated otherwise.
- Footer attribution to `https://github.com/cheahjs/free-llm-api-resources` on every page.

---

### Task 1: Scaffold Astro project

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/.gitignore`, `site/vitest.config.ts`, `site/src/pages/index.astro` (placeholder)

**Interfaces:**
- Produces: working `npm run build`, `npm run test` harness for all later tasks.

- [ ] **Step 1: Scaffold + install**

```bash
cd /Users/sivaram/Personal_Projects/free-llm-api-resources
npm create astro@latest site -- --template minimal --no-install --no-git --typescript strict --yes
cd site
npm install
npm install zod cheerio minisearch @astrojs/sitemap @fontsource-variable/mozilla-headline @fontsource-variable/dm-sans @fontsource-variable/geist-mono
npm install -D vitest sharp tsx
```

- [ ] **Step 2: Configure**

`site/astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://freellm.sivaram.dev',
  integrations: [sitemap()],
});
```

`site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

Append to `site/.gitignore` (create if scaffold didn't): `node_modules`, `dist`, `.astro`.

Add to `site/package.json` scripts: `"test": "vitest run"`.

Replace `site/src/pages/index.astro` content with:
```astro
---
---
<html lang="en"><head><title>Free LLM API resources</title></head>
<body><h1>Free LLM API resources</h1></body></html>
```

- [ ] **Step 3: Verify build + empty test run**

Run: `npm run build` → Expected: `Complete!` with `dist/index.html` emitted.
Run: `npm run test` → Expected: "No test files found" exit 0 (or configure `passWithNoTests: true` if vitest exits 1: add `passWithNoTests: true` inside `test` config).

- [ ] **Step 4: Commit**

```bash
git add site && git commit -m "feat(site): scaffold Astro 6 project"
```

---

### Task 2: Schema + provider metadata

**Files:**
- Create: `site/src/data/schema.ts`, `site/src/data/provider-meta.ts`
- Test: `site/test/schema.test.ts`

**Interfaces:**
- Produces: `ProviderSchema`, types `Provider`, `Model`, `Limit`, `Caveat`, `LayoutKind`; `PROVIDER_META: Record<slug, { layout: LayoutKind; colorOverride?: string }>`; `slugify(name: string): string`.

- [ ] **Step 1: Write failing test**

`site/test/schema.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test — verify fail**

Run: `npm run test` → Expected: FAIL, cannot resolve `../src/data/schema`.

- [ ] **Step 3: Implement**

`site/src/data/schema.ts`:
```ts
import { z } from 'zod';

export const LimitSchema = z.object({
  value: z.number().nullable(), // null when unparseable (kept as raw)
  unit: z.string(),             // e.g. "tokens/minute"
  raw: z.string(),              // verbatim, e.g. "250,000 tokens/minute"
});

export const CaveatSchema = z.enum(['phone-verification', 'data-training', 'geo-restriction']);

export const ModelSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  limits: z.array(LimitSchema).optional(),
});

export const LayoutKindSchema = z.enum(['per-model-table', 'shared-quota', 'credits', 'minimal']);

export const ProviderSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  category: z.enum(['free', 'trial']),
  layout: LayoutKindSchema,
  caveats: z.array(CaveatSchema),
  notes: z.array(z.string()),
  limits: z.array(LimitSchema).optional(),
  limitsUrl: z.string().url().optional(),
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
```

`site/src/data/provider-meta.ts`:
```ts
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
```

- [ ] **Step 4: Run test — verify pass**

Run: `npm run test` → Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/data site/test && git commit -m "feat(site): provider schema and metadata"
```

---

### Task 3: README section splitter + limit string parser

**Files:**
- Create: `site/src/data/parse-helpers.ts`, `site/test/fixtures/README.fixture.md` (copy of current `README.md`)
- Test: `site/test/parse-helpers.test.ts`

**Interfaces:**
- Produces: `splitSections(markdown: string): RawSection[]` where `RawSection = { category: 'free'|'trial'; name: string; url: string; body: string }`; `parseLimitString(raw: string): Limit`; `parseLimitsBlock(text: string): { limits: Limit[]; limitsUrl?: string }`.

- [ ] **Step 1: Create fixture**

```bash
cp ../README.md test/fixtures/README.fixture.md
```

- [ ] **Step 2: Write failing test**

`site/test/parse-helpers.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test — verify fail**

Run: `npm run test` → Expected: FAIL, cannot resolve `../src/data/parse-helpers`.

- [ ] **Step 4: Implement**

`site/src/data/parse-helpers.ts`:
```ts
import type { Limit } from './schema';

export type RawSection = {
  category: 'free' | 'trial';
  name: string;
  url: string;
  body: string;
};

const FREE_HEADER = '## Free Providers';
const TRIAL_HEADER = '## Providers with trial credits';
const SECTION_RE = /^### \[(.+?)\]\((\S+?)\)\s*$/gm;

export function splitSections(markdown: string): RawSection[] {
  const freeStart = markdown.indexOf(FREE_HEADER);
  const trialStart = markdown.indexOf(TRIAL_HEADER);
  if (freeStart === -1 || trialStart === -1) {
    throw new Error('README drift: expected "## Free Providers" and "## Providers with trial credits" headers');
  }
  const sections: RawSection[] = [];
  const matches = [...markdown.matchAll(SECTION_RE)];
  if (matches.length === 0) throw new Error('README drift: no "### [Name](url)" sections found');
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : markdown.length;
    sections.push({
      category: m.index! > trialStart ? 'trial' : 'free',
      name: m[1],
      url: m[2],
      body: markdown.slice(start, end).trim(),
    });
  });
  return sections;
}

export function parseLimitString(raw: string): Limit {
  const trimmed = raw.trim();
  const m = trimmed.match(/^([\d,]+(?:\.\d+)?)\s+(.+)$/);
  if (m) {
    const value = Number(m[1].replaceAll(',', ''));
    if (Number.isFinite(value)) return { value, unit: m[2].trim(), raw: trimmed };
  }
  return { value: null, unit: '', raw: trimmed };
}

const LINK_RE = /^\[([\s\S]+)\]\((\S+?)\)$/;

export function parseLimitsBlock(text: string): { limits: Limit[]; limitsUrl?: string } {
  let inner = text.trim();
  let limitsUrl: string | undefined;
  const link = inner.match(LINK_RE);
  if (link) { inner = link[1]; limitsUrl = link[2]; }
  const parts = inner
    .split(/<br\s*\/?>|\n/)
    .flatMap(p => (p.includes(',') && !/\d,\d/.test(p) ? p.split(',') : splitRespectingThousands(p)))
    .map(p => p.trim())
    .filter(Boolean);
  return { limits: parts.map(parseLimitString), limitsUrl };
}

/** Split "30 requests/minute, 2,000 requests/day" on commas that are NOT thousands separators. */
function splitRespectingThousands(s: string): string[] {
  return s.split(/,(?!\d{3}\b)/);
}
```

Note: `parseLimitsBlock` splits on `<br>`, newlines, and non-thousands commas. Adjust the two comma branches until both tests pass — the thousands-separator regex `/,(?!\d{3}\b)/` is the load-bearing piece (`2,000` must not split; `minute, 2,000` must).

- [ ] **Step 5: Run test — verify pass**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/data/parse-helpers.ts site/test
git commit -m "feat(site): README section splitter and limit parsing"
```

---

### Task 4: Full provider parser (`parseReadme`)

**Files:**
- Create: `site/src/data/parse-readme.ts`
- Test: `site/test/parse-readme.test.ts`

**Interfaces:**
- Consumes: `splitSections`, `parseLimitsBlock`, `parseLimitString` (Task 3); `PROVIDER_META`, `ProviderSchema`, `slugify` (Task 2).
- Produces: `parseReadme(markdown: string): Provider[]` and `getProviders(): Provider[]` (reads `../README.md` relative to repo root, memoized). Astro pages call `getProviders()`.

- [ ] **Step 1: Write failing test**

`site/test/parse-readme.test.ts`:
```ts
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
  });

  it('unknown provider fails loudly', () => {
    const evil = md.replace('### [Groq](https://console.groq.com)', '### [Brand New AI](https://new.ai)');
    expect(() => parseReadme(evil)).toThrow(/brand-new-ai/);
  });
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `npm run test` → Expected: FAIL, cannot resolve `../src/data/parse-readme`.

- [ ] **Step 3: Implement**

`site/src/data/parse-readme.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { PROVIDER_META } from './provider-meta';
import { ProviderSchema, slugify } from './schema';
import type { Caveat, Model, Provider } from './schema';
import { splitSections, parseLimitsBlock, parseLimitString, type RawSection } from './parse-helpers';

const CAVEAT_PATTERNS: Array<[Caveat, RegExp]> = [
  ['phone-verification', /phone number verification/i],
  ['data-training', /data (is )?used for (training|improvement)|opting into data training|use data for improvement/i],
  ['geo-restriction', /outside of the uk\/ch\/eea\/eu/i],
];

function extractCaveats(body: string): Caveat[] {
  return CAVEAT_PATTERNS.filter(([, re]) => re.test(body)).map(([c]) => c);
}

/** "- [Name](url)" or "- Name" or "* Name" bullets → models */
function parseModelBullets(body: string): Model[] {
  const models: Model[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^[-*]\s+(?:\[(.+?)\]\((\S+?)\)|(.+))$/);
    if (!m) continue;
    if (m[1]) models.push({ name: m[1], url: m[2] });
    else if (m[3]) models.push({ name: m[3].trim() });
  }
  return models;
}

/** HTML <table> of Model Name | Model Limits → models with per-model limits */
function parseModelTable(body: string): Model[] {
  const $ = cheerio.load(body);
  const models: Model[] = [];
  $('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    const name = $(tds[0]).text().trim();
    const limitsHtml = $(tds[1]).html() ?? '';
    const limits = limitsHtml
      .split(/<br\s*\/?>/)
      .map(s => cheerio.load(`<x>${s}</x>`)('x').text().trim())
      .filter(Boolean)
      .map(parseLimitString);
    if (name) models.push({ name, limits: limits.length ? limits : undefined });
  });
  return models;
}

/** Prose lines that are not bullets/limits/tables/credits → notes */
function extractNotes(body: string): string[] {
  return body
    .replace(/<table>[\s\S]*?<\/table>/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !l.startsWith('- ') && !l.startsWith('<'))
    .filter(l => !/^\*\*(Limits|Credits|Models|Requirements)/.test(l))
    .filter(l => !/^\[.*\]\(.*\)$/.test(l)) // bare limit-links handled by limits block
    .map(l => l.replace(/^\*\s+/, ''));
}

function parseSection(section: RawSection): Provider {
  const slug = slugify(section.name);
  const meta = PROVIDER_META[slug];
  if (!meta) {
    throw new Error(
      `README drift: unknown provider "${section.name}" (slug: ${slug}). ` +
      `Add an entry to site/src/data/provider-meta.ts.`,
    );
  }
  const { body } = section;

  // **Limits:** or **Limits (per-model):** — value is remainder of line, or the
  // next non-empty line when the header stands alone.
  let limits, limitsUrl;
  const limitsMatch = body.match(/\*\*Limits[^:]*:\*\*\s*(\S[^\n]*)?/);
  if (limitsMatch) {
    let payload = limitsMatch[1]?.trim();
    if (!payload) {
      const after = body.slice(limitsMatch.index! + limitsMatch[0].length);
      payload = after.split('\n').map(l => l.trim()).find(l => l.length > 0);
    }
    if (payload) ({ limits, limitsUrl } = parseLimitsBlock(payload));
  }

  const creditsMatch = body.match(/\*\*Credits:\*\*\s*([^\n]+)/);

  // **Models:** [text](url) inline form (trial providers without bullet lists)
  const modelsInline = body.match(/\*\*Models:\*\*\s*\[(.+?)\]\((\S+?)\)/);
  const modelsPlain = body.match(/\*\*Models:\*\*\s*([^\n[]+)$/m);

  let models: Model[];
  if (meta.layout === 'per-model-table') models = parseModelTable(body);
  else models = parseModelBullets(body);
  if (models.length === 0 && modelsInline) models = [{ name: modelsInline[1], url: modelsInline[2] }];
  if (models.length === 0 && modelsPlain) models = [{ name: modelsPlain[1].trim() }];

  return ProviderSchema.parse({
    slug,
    name: section.name,
    url: section.url,
    category: section.category,
    layout: meta.layout,
    caveats: extractCaveats(body),
    notes: extractNotes(body),
    limits: limits?.length ? limits : undefined,
    limitsUrl,
    credits: creditsMatch?.[1].trim(),
    models,
  });
}

export function parseReadme(markdown: string): Provider[] {
  return splitSections(markdown).map(parseSection);
}

let cache: Provider[] | undefined;
export function getProviders(): Provider[] {
  if (!cache) {
    const readmePath = fileURLToPath(new URL('../../../README.md', import.meta.url));
    cache = parseReadme(readFileSync(readmePath, 'utf-8'));
  }
  return cache;
}
```

- [ ] **Step 4: Run test — iterate until pass**

Run: `npm run test` → Expected: PASS. Real README quirks will surface here (e.g. Cloudflare's stray `</tbody></table>` line, Groq/Cerebras tables, NVIDIA NIM's inline limits). Fix in the parser, not the fixture. The fixture is the current README verbatim — parser must handle it as-is.

- [ ] **Step 5: Commit**

```bash
git add site/src/data/parse-readme.ts site/test/parse-readme.test.ts
git commit -m "feat(site): full README provider parser with loud drift failures"
```

---

### Task 5: Favicon fetcher script

**Files:**
- Create: `site/scripts/fetch-favicons.ts`
- Output (committed): `site/public/favicons/<slug>.(png|ico|svg|jpg|webp)`

**Interfaces:**
- Consumes: `getProviders()` (Task 4).
- Produces: one favicon file per provider slug in `site/public/favicons/`; later tasks locate it by trying extensions in order `svg,png,webp,jpg,ico` via helper `faviconPath(slug)` (defined in Task 7).

- [ ] **Step 1: Write script**

`site/scripts/fetch-favicons.ts`:
```ts
/** One-shot: fetch the largest available favicon per provider.
 *  Run: npx tsx scripts/fetch-favicons.ts [slug ...]   (no args = all) */
import { writeFileSync, mkdirSync } from 'node:fs';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { getProviders } from '../src/data/parse-readme';

const OUT = new URL('../public/favicons/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' };

type Candidate = { url: string; declaredSize: number };

async function collectCandidates(pageUrl: string): Promise<Candidate[]> {
  const res = await fetch(pageUrl, { headers: UA, redirect: 'follow' });
  const html = await res.text();
  const $ = cheerio.load(html);
  const base = res.url; // post-redirect
  const out: Candidate[] = [];
  $('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const sizes = $(el).attr('sizes') ?? '';
    const declared = Number(sizes.split('x')[0]) || ($(el).attr('rel')?.includes('apple') ? 180 : 32);
    out.push({ url: new URL(href, base).href, declaredSize: href.endsWith('.svg') ? 1024 : declared });
  });
  // web manifest icons
  const manifestHref = $('link[rel="manifest"]').attr('href');
  if (manifestHref) {
    try {
      const mres = await fetch(new URL(manifestHref, base).href, { headers: UA });
      const manifest = await mres.json();
      for (const icon of manifest.icons ?? []) {
        const declared = Number(String(icon.sizes ?? '0').split('x')[0]) || 192;
        out.push({ url: new URL(icon.src, base).href, declaredSize: declared });
      }
    } catch { /* manifest optional */ }
  }
  out.push({ url: new URL('/favicon.ico', base).href, declaredSize: 16 });
  return out;
}

async function measure(buf: Buffer, url: string): Promise<number> {
  if (url.endsWith('.svg')) return 1024;
  try { const m = await sharp(buf).metadata(); return Math.min(m.width ?? 0, m.height ?? 0); }
  catch { return 0; }
}

function extFor(url: string, contentType: string): string {
  if (url.endsWith('.svg') || contentType.includes('svg')) return 'svg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg')) return 'jpg';
  if (url.endsWith('.ico') || contentType.includes('icon')) return 'ico';
  return 'png';
}

async function fetchBest(slug: string, pageUrl: string): Promise<void> {
  let best: { buf: Buffer; size: number; ext: string } | null = null;
  let candidates: Candidate[] = [];
  try { candidates = await collectCandidates(pageUrl); }
  catch (e) { console.warn(`${slug}: page fetch failed (${e}), falling back`); }
  candidates.sort((a, b) => b.declaredSize - a.declaredSize);
  for (const c of candidates.slice(0, 6)) {
    try {
      const r = await fetch(c.url, { headers: UA });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const size = await measure(buf, c.url);
      const ext = extFor(c.url, r.headers.get('content-type') ?? '');
      if (!best || size > best.size) best = { buf, size, ext };
      if (best.size >= 180) break; // good enough
    } catch { /* try next candidate */ }
  }
  if (!best || best.size < 16) {
    // Fallback: Google favicon service at 256px
    const domain = new URL(pageUrl).hostname;
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
    if (r.ok) best = { buf: Buffer.from(await r.arrayBuffer()), size: 256, ext: 'png' };
  }
  if (!best) { console.error(`${slug}: NO FAVICON FOUND`); return; }
  writeFileSync(new URL(`${slug}.${best.ext}`, OUT), best.buf);
  console.log(`${slug}: saved ${best.ext} (${best.size}px)`);
}

const only = process.argv.slice(2);
for (const p of getProviders()) {
  if (only.length && !only.includes(p.slug)) continue;
  await fetchBest(p.slug, p.url);
}
```

- [ ] **Step 2: Run and verify**

Run: `npx tsx scripts/fetch-favicons.ts`
Expected: one `saved` line per provider; check `ls public/favicons | wc -l` ≥ 26. For any `NO FAVICON FOUND`, re-run that slug; if a site blocks bots, manually download its favicon into `public/favicons/<slug>.png` and note it in the commit message.

- [ ] **Step 3: Visual sanity check**

Open a few in preview (`qlmanage -p public/favicons/groq.png` or Read tool) — confirm they're real logos, not placeholder/CDN error images.

- [ ] **Step 4: Commit**

```bash
git add site/scripts/fetch-favicons.ts site/public/favicons
git commit -m "feat(site): favicon fetcher + fetched provider favicons"
```

---

### Task 6: Brand color extraction → `brand.json`

**Files:**
- Create: `site/scripts/extract-colors.ts`, `site/src/data/color-utils.ts`
- Output (committed): `site/src/data/brand.json`
- Test: `site/test/color-utils.test.ts`

**Interfaces:**
- Consumes: favicons (Task 5), `PROVIDER_META.colorOverride` (Task 2).
- Produces: `brand.json` mapping slug → `{ base: string; light: BrandTheme; dark: BrandTheme }` with `BrandTheme = { wash: string; border: string; text: string }` (all hex). Pure helpers in `color-utils.ts`: `contrastRatio(hexA, hexB): number`, `mixOver(fgHex, bgHex, alpha): string`, `adjustForContrast(hex, bgHex, min: number): string`.

- [ ] **Step 1: Write failing test for color-utils**

`site/test/color-utils.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test — verify fail**

Run: `npm run test` → Expected: FAIL, cannot resolve `../src/data/color-utils`.

- [ ] **Step 3: Implement color-utils**

`site/src/data/color-utils.ts`:
```ts
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Composite fg at `alpha` over opaque bg. */
export function mixOver(fg: string, bg: string, alpha: number): string {
  const f = hexToRgb(fg), g = hexToRgb(bg);
  return rgbToHex([0, 1, 2].map(i => f[i] * alpha + g[i] * (1 - alpha)) as [number, number, number]);
}

/** Nudge hex toward black/white (whichever helps) until contrast vs bg >= min. */
export function adjustForContrast(hex: string, bg: string, min: number): string {
  if (contrastRatio(hex, bg) >= min) return hex;
  const towards = luminance(bg) > 0.5 ? '#141416' : '#faf8f5'; // darken on light bg, lighten on dark
  for (let a = 0.05; a <= 1.001; a += 0.05) {
    const candidate = mixOver(towards, hex, a);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return towards;
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Write extraction script**

`site/scripts/extract-colors.ts`:
```ts
/** One-shot: extract brand base color per favicon, derive theme tokens.
 *  Run: npx tsx scripts/extract-colors.ts */
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getProviders } from '../src/data/parse-readme';
import { PROVIDER_META } from '../src/data/provider-meta';
import { rgbToHex, mixOver, adjustForContrast, contrastRatio } from '../src/data/color-utils';

const FAV_DIR = fileURLToPath(new URL('../public/favicons/', import.meta.url));
const LIGHT_BG = '#faf8f5', DARK_BG = '#141416';

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  return [0, s, max]; // hue unused
}

async function extractBase(file: string): Promise<string> {
  const { data, info } = await sharp(file, { pages: 1 })
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number; val: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const [, s, v] = rgbToHsv(r, g, b);
    if (v > 0.95 && s < 0.08) continue; // near-white background
    const key = `${r >> 4},${g >> 4},${b >> 4}`; // 4-bit buckets
    const e = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, sat: 0, val: 0 };
    e.count++; e.r += r; e.g += g; e.b += b; e.sat += s; e.val += v;
    buckets.set(key, e);
  }
  if (buckets.size === 0) return '#7a7a85'; // fully white/transparent icon → neutral
  // Saturation-weighted: vibrant hues beat populous grays; grayscale logos
  // (Vercel) still win via the +0.15 population floor when nothing is saturated.
  let best = null as null | { score: number; hex: string };
  for (const e of buckets.values()) {
    const sat = e.sat / e.count, val = e.val / e.count;
    const midBoost = 1 - Math.abs(val - 0.55); // prefer mid-brightness
    const score = e.count * (0.15 + sat * sat * 2) * (0.5 + midBoost);
    const hex = rgbToHex([e.r / e.count, e.g / e.count, e.b / e.count]);
    if (!best || score > best.score) best = { score, hex };
  }
  return best!.hex;
}

const files = readdirSync(FAV_DIR);
const out: Record<string, unknown> = {};
for (const p of getProviders()) {
  const file = files.find(f => f.startsWith(`${p.slug}.`));
  const override = PROVIDER_META[p.slug]?.colorOverride;
  const base = override ?? (file ? await extractBase(FAV_DIR + file) : '#7a7a85');
  const tokens = {
    base,
    light: {
      wash: mixOver(base, LIGHT_BG, 0.08),
      border: mixOver(base, LIGHT_BG, 0.3),
      text: adjustForContrast(base, LIGHT_BG, 4.5),
    },
    dark: {
      wash: mixOver(base, DARK_BG, 0.12),
      border: mixOver(base, DARK_BG, 0.35),
      text: adjustForContrast(base, DARK_BG, 4.5),
    },
  };
  // Hard assertion — script fails if any text token misses AA
  for (const [bg, t] of [[LIGHT_BG, tokens.light], [DARK_BG, tokens.dark]] as const) {
    const c = contrastRatio(t.text, bg);
    if (c < 4.5) throw new Error(`${p.slug}: text contrast ${c.toFixed(2)} < 4.5 on ${bg}`);
  }
  out[p.slug] = tokens;
  console.log(`${p.slug}: ${base}${override ? ' (override)' : ''}`);
}
writeFileSync(fileURLToPath(new URL('../src/data/brand.json', import.meta.url)), JSON.stringify(out, null, 2));
console.log(`\nWrote brand.json for ${Object.keys(out).length} providers`);
```

- [ ] **Step 6: Run, eyeball, override misfires**

Run: `npx tsx scripts/extract-colors.ts` → Expected: 26 lines + `Wrote brand.json`.
Review the printed hexes against known brands (Cloudflare ≈ orange `#f6821f`-ish, Groq orange, Cohere coral, NVIDIA green, Mistral orange, Hugging Face yellow). For each obvious misfire, add `colorOverride: '#hex'` to that slug in `provider-meta.ts` and re-run. SVG favicons: sharp rasterizes SVGs natively; if one fails, add an override rather than fighting it.

- [ ] **Step 7: Commit**

```bash
git add site/scripts/extract-colors.ts site/src/data/color-utils.ts site/src/data/brand.json site/src/data/provider-meta.ts site/test/color-utils.test.ts
git commit -m "feat(site): brand color extraction with WCAG-checked theme tokens"
```

---

### Task 7: Theme tokens, base layout, fonts, theme toggle

**Files:**
- Create: `site/src/styles/tokens.css`, `site/src/styles/global.css`, `site/src/layouts/Base.astro`, `site/src/data/assets.ts`
- Modify: `site/src/pages/index.astro` (use Base layout)

**Interfaces:**
- Produces: `Base.astro` props `{ title: string; description: string; ogImage?: string; jsonLd?: object }`; CSS custom props `--bg --bg-elev --text --text-muted --border --accent`; fonts wired; `data-theme` toggle. `assets.ts` exports `faviconPath(slug): string | null` and `screenshotPath(slug, theme): string | null` (checks `public/` at build time via `fs.existsSync`).

- [ ] **Step 1: Write styles**

`site/src/styles/tokens.css`:
```css
:root {
  --bg: #faf8f5;
  --bg-elev: #f2efe9;
  --text: #26242f;
  --text-muted: #6b6876;
  --border: #e3dfd7;
  --accent: #6d5ef0;
  --shadow: 0 2px 12px rgb(38 36 47 / 0.06);
}
[data-theme='dark'] {
  --bg: #141416;
  --bg-elev: #1c1c1f;
  --text: #e8e6e3;
  --text-muted: #9d9aa4;
  --border: #2a2a2e;
  --accent: #8f83f7;
  --shadow: 0 2px 12px rgb(0 0 0 / 0.35);
}
```

`site/src/styles/global.css`:
```css
* { box-sizing: border-box; margin: 0; }
html { color-scheme: light; }
html[data-theme='dark'] { color-scheme: dark; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans Variable', system-ui, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: 'Mozilla Headline Variable', 'DM Sans Variable', sans-serif; line-height: 1.15; }
code, .mono { font-family: 'Geist Mono Variable', ui-monospace, monospace; font-size: 0.9em; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.container { max-width: 72rem; margin-inline: auto; padding-inline: 1.25rem; }
```

- [ ] **Step 2: Write assets helper**

`site/src/data/assets.ts`:
```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

export function faviconPath(slug: string): string | null {
  for (const ext of ['svg', 'png', 'webp', 'jpg', 'ico']) {
    if (existsSync(`${PUBLIC}favicons/${slug}.${ext}`)) return `/favicons/${slug}.${ext}`;
  }
  return null;
}

export function screenshotPath(slug: string, theme: 'light' | 'dark'): string | null {
  const p = `screenshots/${slug}-${theme}.webp`;
  if (existsSync(PUBLIC + p)) return `/${p}`;
  const other = `screenshots/${slug}-${theme === 'light' ? 'dark' : 'light'}.webp`;
  return existsSync(PUBLIC + other) ? `/${other}` : null;
}
```

- [ ] **Step 3: Write Base layout**

`site/src/layouts/Base.astro`:
```astro
---
import '@fontsource-variable/mozilla-headline';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/geist-mono';
import '../styles/tokens.css';
import '../styles/global.css';

interface Props { title: string; description: string; ogImage?: string; jsonLd?: object }
const { title, description, ogImage, jsonLd } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
---
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:type" content="website" />
  {ogImage && <meta property="og:image" content={new URL(ogImage, Astro.site)} />}
  <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
  <link rel="sitemap" href="/sitemap-index.xml" />
  {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
  <script is:inline>
    const t = localStorage.getItem('theme')
      ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = t;
  </script>
</head>
<body>
  <header class="container site-header">
    <a href="/" class="brand">Free LLM API resources</a>
    <nav>
      <a href="https://github.com/cheahjs/free-llm-api-resources">GitHub</a>
      <button id="theme-toggle" aria-label="Toggle theme">◐</button>
    </nav>
  </header>
  <main class="container"><slot /></main>
  <footer class="container site-footer">
    <p>
      Data from <a href="https://github.com/cheahjs/free-llm-api-resources">cheahjs/free-llm-api-resources</a>.
      Site by <a href="https://sivaram.dev">sivaram.dev</a>.
      Please don't abuse these services, else we might lose them.
    </p>
  </footer>
  <script>
    document.getElementById('theme-toggle')!.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  </script>
  <style>
    .site-header { display: flex; justify-content: space-between; align-items: center; padding-block: 1rem; }
    .site-header .brand { color: var(--text); font-family: 'Mozilla Headline Variable', sans-serif; font-weight: 650; }
    .site-header nav { display: flex; gap: 1rem; align-items: center; }
    #theme-toggle { background: none; border: 1px solid var(--border); border-radius: 999px; color: var(--text); cursor: pointer; padding: 0.2rem 0.6rem; font-size: 1rem; }
    .site-footer { padding-block: 2.5rem; color: var(--text-muted); font-size: 0.875rem; border-top: 1px solid var(--border); margin-top: 3rem; }
  </style>
</body>
</html>
```

Update `site/src/pages/index.astro` to use it:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Free LLM API resources" description="Every service offering free LLM API access or trial credits — limits, models, and caveats, always current.">
  <h1>Free LLM API resources</h1>
</Base>
```

- [ ] **Step 4: Verify**

Run: `npm run build` → Expected: success. `grep -o 'data-theme' dist/index.html` finds the inline script; `ls dist/_astro | grep -i woff2` shows font files.

- [ ] **Step 5: Commit**

```bash
git add site/src && git commit -m "feat(site): theme tokens, fonts, base layout with dark/light toggle"
```

---

### Task 8: Provider card components + hub page

**Files:**
- Create: `site/src/components/ProviderCard.astro`, `site/src/components/CaveatBadge.astro`, `site/src/components/LimitPill.astro`
- Modify: `site/src/pages/index.astro`

**Interfaces:**
- Consumes: `getProviders()`, `brand.json`, `faviconPath`, `screenshotPath`.
- Produces: hub page listing all providers in two groups. `ProviderCard` props: `{ provider: Provider }`. `CaveatBadge` props: `{ caveat: Caveat }`. `LimitPill` props: `{ limit: Limit }`. Card sets inline CSS vars `--brand-wash-light/dark`, `--brand-border-light/dark`, `--brand-text-light/dark` consumed via `[data-theme]` selectors.

- [ ] **Step 1: Write components**

`site/src/components/CaveatBadge.astro`:
```astro
---
import type { Caveat } from '../data/schema';
interface Props { caveat: Caveat }
const LABELS: Record<Caveat, string> = {
  'phone-verification': '📱 Phone verification',
  'data-training': '🎓 Data used for training',
  'geo-restriction': '🌍 Geo restrictions',
};
const { caveat } = Astro.props;
---
<span class="caveat">{LABELS[caveat]}</span>
<style>
  .caveat { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--bg-elev); border: 1px solid var(--border); color: var(--text-muted); white-space: nowrap; }
</style>
```

`site/src/components/LimitPill.astro`:
```astro
---
import type { Limit } from '../data/schema';
interface Props { limit: Limit }
const { limit } = Astro.props;
---
<span class="limit mono">{limit.raw}</span>
<style>
  .limit { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 6px; background: var(--bg-elev); border: 1px solid var(--border); }
</style>
```

`site/src/components/ProviderCard.astro`:
```astro
---
import type { Provider } from '../data/schema';
import brand from '../data/brand.json';
import { faviconPath, screenshotPath } from '../data/assets';
import CaveatBadge from './CaveatBadge.astro';

interface Props { provider: Provider }
const { provider: p } = Astro.props;
const b = (brand as Record<string, any>)[p.slug];
const favicon = faviconPath(p.slug);
const shotLight = screenshotPath(p.slug, 'light');
const shotDark = screenshotPath(p.slug, 'dark');
const headline = p.credits ? `${p.credits} credits`
  : p.limits?.[0]?.raw ?? p.models.find(m => m.limits?.length)?.limits?.[0]?.raw ?? null;
const style = `--bwl:${b.light.wash};--bbl:${b.light.border};--btl:${b.light.text};--bwd:${b.dark.wash};--bbd:${b.dark.border};--btd:${b.dark.text};`;
---
<a class="card" href={`/providers/${p.slug}/`} style={style}>
  {(shotLight || shotDark) && (
    <span class="preview" aria-hidden="true">
      {shotLight && <img class="shot-light" src={shotLight} alt="" loading="lazy" width="640" height="400" />}
      {shotDark && <img class="shot-dark" src={shotDark} alt="" loading="lazy" width="640" height="400" />}
    </span>
  )}
  <span class="head">
    {favicon && <img class="icon" src={favicon} alt="" width="28" height="28" loading="lazy" />}
    <span class="name">{p.name}</span>
  </span>
  <span class="meta">
    {p.models.length > 1 && <span class="count mono">{p.models.length} models</span>}
    {headline && <span class="headline mono">{headline}</span>}
  </span>
  {p.caveats.length > 0 && (
    <span class="caveats">{p.caveats.map(c => <CaveatBadge caveat={c} />)}</span>
  )}
</a>
<style>
  .card {
    position: relative; display: flex; flex-direction: column; gap: 0.55rem;
    padding: 1rem 1.1rem; border-radius: 14px; overflow: hidden;
    background: var(--bwl); border: 1px solid var(--bbl);
    color: var(--text); text-decoration: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  :global([data-theme='dark']) .card { background: var(--bwd); border-color: var(--bbd); }
  .card:hover { transform: translateY(-3px); box-shadow: var(--shadow); text-decoration: none; }
  .head { display: flex; align-items: center; gap: 0.6rem; }
  .icon { border-radius: 6px; }
  .name { font-family: 'Mozilla Headline Variable', sans-serif; font-weight: 600; font-size: 1.05rem; color: var(--btl); }
  :global([data-theme='dark']) .name { color: var(--btd); }
  .meta { display: flex; gap: 0.5rem; flex-wrap: wrap; color: var(--text-muted); font-size: 0.78rem; }
  .caveats { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .preview { position: absolute; inset: 0; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
  .preview img { width: 100%; height: 100%; object-fit: cover; object-position: top; position: absolute; inset: 0; }
  .card:hover .preview { opacity: 0.14; }
  .shot-dark { display: none; }
  :global([data-theme='dark']) .shot-light { display: none; }
  :global([data-theme='dark']) .shot-dark { display: block; }
</style>
```

- [ ] **Step 2: Write hub page**

`site/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import ProviderCard from '../components/ProviderCard.astro';
import { getProviders } from '../data/parse-readme';

const providers = getProviders();
const free = providers.filter(p => p.category === 'free');
const trial = providers.filter(p => p.category === 'trial');
const modelCount = providers.reduce((n, p) => n + p.models.length, 0);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Free LLM API providers',
  itemListElement: providers.map((p, i) => ({
    '@type': 'ListItem', position: i + 1, name: p.name,
    url: new URL(`/providers/${p.slug}/`, Astro.site).href,
  })),
};
---
<Base
  title="Free LLM API resources — every free tier and trial credit, compared"
  description={`${providers.length} services offering free LLM API access: rate limits, ${modelCount}+ models, verification requirements and caveats. Updated automatically.`}
  jsonLd={jsonLd}
>
  <section class="hero">
    <h1>Free LLM APIs, all in one place</h1>
    <p>{providers.length} providers · {modelCount}+ models · limits and caveats, updated automatically.</p>
    <p class="warn">⚠️ Please don't abuse these services, else we might lose them. Illegitimate services (e.g. reverse-engineered chatbots) are excluded.</p>
    <div id="search-root"></div>
  </section>

  <h2 id="free">Free providers</h2>
  <div class="grid">{free.map(p => <ProviderCard provider={p} />)}</div>

  <h2 id="trial">Providers with trial credits</h2>
  <div class="grid">{trial.map(p => <ProviderCard provider={p} />)}</div>
</Base>
<style>
  .hero { padding-block: 2.5rem 1.5rem; }
  .hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin-bottom: 0.5rem; }
  .hero p { color: var(--text-muted); }
  .warn { font-size: 0.85rem; margin-top: 0.5rem; }
  h2 { margin: 2.5rem 0 1rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.9rem; }
</style>
```

- [ ] **Step 3: Verify build + visual check**

Run: `npm run build` → success, then `npm run preview` and screenshot `http://localhost:4321/` in both themes (agent-browser or webapp-testing skill). Confirm: brand washes differ per card, no pure black/white backgrounds, fonts loaded (headings ≠ body face).

- [ ] **Step 4: Commit**

```bash
git add site/src && git commit -m "feat(site): brand-colored provider cards and hub page"
```

---

### Task 9: Provider detail pages (bespoke layouts)

**Files:**
- Create: `site/src/pages/providers/[slug].astro`, `site/src/components/ScreenshotHero.astro`, `site/src/components/ModelTable.astro`, `site/src/components/ModelList.astro`

**Interfaces:**
- Consumes: everything above.
- Produces: `/providers/<slug>/` for all 26. `ScreenshotHero` props `{ provider: Provider }`; `ModelTable` props `{ models: Model[] }` (per-model-table); `ModelList` props `{ models: Model[] }` (linked/plain grid).

- [ ] **Step 1: Write components**

`site/src/components/ScreenshotHero.astro`:
```astro
---
import type { Provider } from '../data/schema';
import brand from '../data/brand.json';
import { faviconPath, screenshotPath } from '../data/assets';
interface Props { provider: Provider }
const { provider: p } = Astro.props;
const b = (brand as Record<string, any>)[p.slug];
const favicon = faviconPath(p.slug);
const shotLight = screenshotPath(p.slug, 'light');
const shotDark = screenshotPath(p.slug, 'dark');
const style = `--brand:${b.base};--btl:${b.light.text};--btd:${b.dark.text};`;
---
<div class="hero" style={style}>
  {shotLight && <img class="shot shot-light" src={shotLight} alt={`${p.name} homepage`} width="1440" height="900" />}
  {shotDark && <img class="shot shot-dark" src={shotDark} alt={`${p.name} homepage`} width="1440" height="900" />}
  {!shotLight && !shotDark && <div class="shot placeholder" />}
  <div class="overlay">
    {favicon && <img class="icon" src={favicon} alt="" width="44" height="44" />}
    <h1>{p.name}</h1>
    <a class="cta" href={p.url} rel="noopener">Get API key ↗</a>
  </div>
</div>
<style>
  .hero { position: relative; border-radius: 16px; overflow: hidden; margin-block: 1rem; border: 1px solid var(--border); }
  .shot { width: 100%; height: clamp(180px, 32vw, 320px); object-fit: cover; object-position: top; display: block; }
  .placeholder { background: linear-gradient(135deg, var(--brand), var(--bg-elev)); }
  .shot-dark { display: none; }
  :global([data-theme='dark']) .shot-light { display: none; }
  :global([data-theme='dark']) .shot-dark { display: block; }
  .overlay {
    position: absolute; inset: auto 0 0 0; display: flex; align-items: center; gap: 0.8rem;
    padding: 1rem 1.25rem;
    background: linear-gradient(transparent, color-mix(in srgb, var(--bg) 88%, var(--brand)));
  }
  .overlay h1 { font-size: clamp(1.4rem, 3.5vw, 2.2rem); flex: 1; color: var(--btl); }
  :global([data-theme='dark']) .overlay h1 { color: var(--btd); }
  .icon { border-radius: 9px; }
  .cta { background: var(--brand); color: #faf8f5; padding: 0.45rem 1rem; border-radius: 9px; font-weight: 600; white-space: nowrap; }
  .cta:hover { text-decoration: none; filter: brightness(1.1); }
</style>
```

`site/src/components/ModelTable.astro`:
```astro
---
import type { Model } from '../data/schema';
import LimitPill from './LimitPill.astro';
interface Props { models: Model[] }
const { models } = Astro.props;
---
<div class="wrap">
  <table>
    <thead><tr><th>Model</th><th>Limits</th></tr></thead>
    <tbody>
      {models.map(m => (
        <tr>
          <td class="mono">{m.url ? <a href={m.url} rel="noopener">{m.name}</a> : m.name}</td>
          <td class="limits">{(m.limits ?? []).map(l => <LimitPill limit={l} />)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
<style>
  .wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--border); font-family: 'Mozilla Headline Variable', sans-serif; }
  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  .limits { display: flex; gap: 0.3rem; flex-wrap: wrap; }
</style>
```

`site/src/components/ModelList.astro`:
```astro
---
import type { Model } from '../data/schema';
interface Props { models: Model[] }
const { models } = Astro.props;
---
<ul class="models">
  {models.map(m => (
    <li class="mono">{m.url ? <a href={m.url} rel="noopener">{m.name}</a> : m.name}</li>
  ))}
</ul>
<style>
  .models { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 0.4rem; font-size: 0.88rem; }
  .models li { padding: 0.45rem 0.7rem; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 8px; overflow-wrap: anywhere; }
</style>
```

- [ ] **Step 2: Write the page**

`site/src/pages/providers/[slug].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import ScreenshotHero from '../../components/ScreenshotHero.astro';
import ModelTable from '../../components/ModelTable.astro';
import ModelList from '../../components/ModelList.astro';
import CaveatBadge from '../../components/CaveatBadge.astro';
import LimitPill from '../../components/LimitPill.astro';
import { getProviders } from '../../data/parse-readme';
import { screenshotPath } from '../../data/assets';

export function getStaticPaths() {
  return getProviders().map(p => ({ params: { slug: p.slug }, props: { provider: p } }));
}
const { provider: p } = Astro.props;
const all = getProviders();
const idx = all.findIndex(x => x.slug === p.slug);
const prev = all[(idx - 1 + all.length) % all.length];
const next = all[(idx + 1) % all.length];

const title = p.category === 'trial'
  ? `${p.name} trial credits: ${p.credits ?? 'free credits'}, models & how to start`
  : `${p.name} free tier: models, rate limits & how to get an API key`;
const description = [
  `${p.name} offers ${p.category === 'trial' ? `${p.credits ?? 'trial'} in credits` : 'a free tier'}`,
  p.models.length > 1 ? `${p.models.length} models` : null,
  p.limits?.[0]?.raw ?? null,
].filter(Boolean).join(' · ');

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: title,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Providers', item: new URL('/', Astro.site).href },
      { '@type': 'ListItem', position: 2, name: p.name, item: new URL(`/providers/${p.slug}/`, Astro.site).href },
    ],
  },
  mainEntity: {
    '@type': 'ItemList',
    name: `${p.name} free models`,
    itemListElement: p.models.slice(0, 50).map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name })),
  },
};
---
<Base title={title} description={description} ogImage={screenshotPath(p.slug, 'light') ?? undefined} jsonLd={jsonLd}>
  <ScreenshotHero provider={p} />

  {p.caveats.length > 0 && (
    <div class="caveats">{p.caveats.map(c => <CaveatBadge caveat={c} />)}</div>
  )}

  {p.notes.length > 0 && (
    <section class="notes">{p.notes.map(n => <p>{n}</p>)}</section>
  )}

  {p.credits && (
    <section class="credits-banner">
      <span class="amount">{p.credits}</span> in trial credits
    </section>
  )}

  {p.limits && p.limits.length > 0 && (
    <section>
      <h2>Limits{p.layout === 'shared-quota' && p.models.length > 1 ? ' (shared across models)' : ''}</h2>
      <div class="limit-row">{p.limits.map(l => <LimitPill limit={l} />)}</div>
      {p.limitsUrl && <p class="src"><a href={p.limitsUrl} rel="noopener">Official limits documentation ↗</a></p>}
    </section>
  )}

  {p.models.length > 0 && (
    <section>
      <h2>Models</h2>
      {p.layout === 'per-model-table' ? <ModelTable models={p.models} /> : <ModelList models={p.models} />}
    </section>
  )}

  <nav class="pn">
    <a href={`/providers/${prev.slug}/`}>← {prev.name}</a>
    <a href="/">All providers</a>
    <a href={`/providers/${next.slug}/`}>{next.name} →</a>
  </nav>
</Base>
<style>
  section { margin-block: 1.5rem; }
  h2 { margin-bottom: 0.75rem; }
  .caveats, .limit-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .notes p { color: var(--text-muted); margin-block: 0.35rem; }
  .credits-banner { font-size: 1.1rem; }
  .credits-banner .amount { font-family: 'Mozilla Headline Variable', sans-serif; font-size: 2rem; font-weight: 700; }
  .src { font-size: 0.85rem; margin-top: 0.5rem; }
  .pn { display: flex; justify-content: space-between; gap: 1rem; margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--border); font-size: 0.9rem; flex-wrap: wrap; }
</style>
```

- [ ] **Step 3: Verify**

Run: `npm run build` → Expected: 27+ pages emitted (`ls dist/providers | wc -l` = 26). Preview `/providers/groq/` (table layout), `/providers/openrouter/` (shared quota), `/providers/fireworks/` (credits), `/providers/nvidia-nim/` (minimal) in both themes.

- [ ] **Step 4: Commit**

```bash
git add site/src && git commit -m "feat(site): provider detail pages with bespoke layouts"
```

---

### Task 10: Cross-provider model search

**Files:**
- Create: `site/src/pages/search-index.json.ts`, `site/src/components/Search.astro`
- Modify: `site/src/pages/index.astro` (replace `<div id="search-root">` with `<Search />`)

**Interfaces:**
- Consumes: `getProviders()`.
- Produces: `/search-index.json` (serialized MiniSearch index); search UI on hub. MiniSearch options MUST be identical in endpoint and client: `{ fields: ['model', 'provider'], storeFields: ['model', 'provider', 'slug', 'category', 'phone', 'limits'] }`.

- [ ] **Step 1: Write the index endpoint**

`site/src/pages/search-index.json.ts`:
```ts
import type { APIRoute } from 'astro';
import MiniSearch from 'minisearch';
import { getProviders } from '../data/parse-readme';

export const MINISEARCH_OPTIONS = {
  fields: ['model', 'provider'],
  storeFields: ['model', 'provider', 'slug', 'category', 'phone', 'limits'],
};

export const GET: APIRoute = () => {
  const docs = getProviders().flatMap(p =>
    p.models.map((m, i) => ({
      id: `${p.slug}:${i}`,
      model: m.name,
      provider: p.name,
      slug: p.slug,
      category: p.category,
      phone: p.caveats.includes('phone-verification'),
      limits: (m.limits ?? p.limits ?? []).slice(0, 3).map(l => l.raw).join(' · '),
    })),
  );
  const mini = new MiniSearch(MINISEARCH_OPTIONS);
  mini.addAll(docs);
  return new Response(JSON.stringify(mini.toJSON()), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Write the search island**

`site/src/components/Search.astro`:
```astro
<div class="search">
  <input id="model-search" type="search" placeholder="Search any model — e.g. llama 3.3, gemma, whisper…" autocomplete="off" />
  <label class="filter"><input type="checkbox" id="no-phone" /> No phone verification</label>
  <div id="search-results" hidden></div>
</div>
<script>
  import MiniSearch from 'minisearch';

  const OPTIONS = {
    fields: ['model', 'provider'],
    storeFields: ['model', 'provider', 'slug', 'category', 'phone', 'limits'],
  };
  let mini: MiniSearch | null = null;
  const input = document.getElementById('model-search') as HTMLInputElement;
  const noPhone = document.getElementById('no-phone') as HTMLInputElement;
  const results = document.getElementById('search-results')!;

  async function ensureIndex() {
    if (mini) return;
    const res = await fetch('/search-index.json');
    mini = MiniSearch.loadJSON(await res.text(), OPTIONS);
  }

  function esc(s: string) {
    return s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  }

  function render() {
    const q = input.value.trim();
    if (!mini || q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
    let hits = mini.search(q, { prefix: true, fuzzy: 0.2 });
    if (noPhone.checked) hits = hits.filter(h => !h.phone);
    results.hidden = false;
    results.innerHTML = hits.slice(0, 30).map(h => `
      <a class="hit" href="/providers/${esc(h.slug)}/">
        <span class="hit-model mono">${esc(h.model)}</span>
        <span class="hit-provider">${esc(h.provider)}${h.category === 'trial' ? ' · trial credits' : ''}</span>
        ${h.limits ? `<span class="hit-limits mono">${esc(h.limits)}</span>` : ''}
      </a>`).join('') || '<p class="none">No models match.</p>';
  }

  input.addEventListener('focus', ensureIndex, { once: true });
  input.addEventListener('input', async () => { await ensureIndex(); render(); });
  noPhone.addEventListener('change', render);
</script>
<style>
  .search { margin-top: 1.25rem; max-width: 40rem; }
  #model-search {
    width: 100%; padding: 0.7rem 1rem; font: inherit; color: var(--text);
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px;
  }
  #model-search:focus { outline: 2px solid var(--accent); }
  .filter { display: inline-flex; gap: 0.4rem; align-items: center; font-size: 0.82rem; color: var(--text-muted); margin-top: 0.5rem; }
  #search-results { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; max-height: 24rem; overflow-y: auto; }
  #search-results :global(.hit) {
    display: grid; grid-template-columns: 1fr auto; gap: 0.15rem 0.75rem;
    padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 10px;
    background: var(--bg-elev); color: var(--text);
  }
  #search-results :global(.hit:hover) { border-color: var(--accent); text-decoration: none; }
  #search-results :global(.hit-model) { font-size: 0.88rem; }
  #search-results :global(.hit-provider) { color: var(--text-muted); font-size: 0.8rem; }
  #search-results :global(.hit-limits) { grid-column: 1 / -1; color: var(--text-muted); font-size: 0.72rem; }
  #search-results :global(.none) { color: var(--text-muted); }
</style>
```

In `site/src/pages/index.astro`: add `import Search from '../components/Search.astro';` and replace `<div id="search-root"></div>` with `<Search />`.

- [ ] **Step 3: Verify**

Run: `npm run build` → `dist/search-index.json` exists and `node -e "const j=require('./dist/search-index.json'); console.log(Object.keys(j))"` shows MiniSearch internals. Preview: type "llama 3.3" → hits from Groq, OpenRouter, GitHub Models, Cloudflare, SambaNova, Scaleway; toggle "No phone verification" → Mistral-related hits drop.

- [ ] **Step 4: Commit**

```bash
git add site/src && git commit -m "feat(site): cross-provider model search with MiniSearch"
```

---

### Task 11: Homepage screenshots (agent-browser)

**Files:**
- Create: `site/scripts/capture-screenshots.md` (runbook)
- Output (committed): `site/public/screenshots/<slug>-{light,dark}.webp`

**Interfaces:**
- Consumes: provider URLs from `getProviders()`.
- Produces: screenshots consumed by `screenshotPath()` (already fallback-safe — missing files render gradient placeholders).

- [ ] **Step 1: Write runbook**

`site/scripts/capture-screenshots.md`:
```markdown
# Screenshot capture runbook

For each provider in `npx tsx -e "import('../src/data/parse-readme.js')"` (or just
read slugs+URLs from `getProviders()`), capture the homepage with the
**agent-browser skill** at 1440×900:

1. Set viewport 1440×900, emulate `prefers-color-scheme: light` → navigate to
   provider URL → wait for network idle + 2s (hero animations) → dismiss obvious
   cookie banners if a simple accept button exists → screenshot (viewport, not
   full-page) → save PNG.
2. Repeat with `prefers-color-scheme: dark`. If the page looks identical, keep
   only one capture and copy it to both filenames.
3. Convert: `npx sharp-cli -i shot.png -o public/screenshots/<slug>-<theme>.webp
   --format webp --quality 80` (or a one-liner sharp script).
4. Skip-list sites behind hard bot walls; their pages fall back to brand
   gradients automatically.
```

- [ ] **Step 2: Execute runbook**

Use the agent-browser skill per the runbook for all 26 providers. Track a checklist of slug → light/dark/skipped. Convert all captures to webp ≤ 200KB each.

- [ ] **Step 3: Verify**

`ls public/screenshots | wc -l` — expect ~40–52 files (some single-theme). `npm run build && npm run preview` — hub hover previews appear; provider heroes show screenshots; skipped providers show gradient placeholder (no broken images).

- [ ] **Step 4: Commit**

```bash
git add site/scripts/capture-screenshots.md site/public/screenshots
git commit -m "feat(site): provider homepage screenshots (light+dark)"
```

---

### Task 12: robots.txt + Cloudflare deploy

**Files:**
- Create: `site/public/robots.txt`, `site/wrangler.jsonc`, `.github/workflows/deploy-site.yml` (repo root)

**Interfaces:**
- Consumes: built `dist/`.
- Produces: live site on `*.workers.dev`, then custom domain `freellm.sivaram.dev`; auto-deploy on push to main.

- [ ] **Step 1: robots + wrangler config**

`site/public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://freellm.sivaram.dev/sitemap-index.xml
```

`site/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "freellm",
  "compatibility_date": "2026-07-21",
  "assets": { "directory": "./dist" }
}
```

Run: `npm install -D wrangler`

- [ ] **Step 2: First manual deploy**

Run: `npm run build && npx wrangler deploy` (login prompt on first run).
Expected: deployed URL `https://freellm.<account>.workers.dev` — open it, sanity-check hub + one provider page.

- [ ] **Step 3: GitHub Actions workflow**

`.github/workflows/deploy-site.yml` (repo root — the one file outside `site/`):
```yaml
name: Deploy site
on:
  push:
    branches: [main]
    paths: ['README.md', 'site/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: site/package-lock.json }
      - run: npm ci
        working-directory: site
      - run: npm run test
        working-directory: site
      - run: npm run build
        working-directory: site
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: site
          command: deploy
```

USER ACTION required (surface these, don't attempt): create a Cloudflare API token (Workers Scripts:Edit) and add as repo secret `CLOUDFLARE_API_TOKEN`; in the Cloudflare dashboard add custom domain `freellm.sivaram.dev` to the `freellm` worker.

- [ ] **Step 4: Verify CI**

Push to main (or `gh workflow run "Deploy site"`), then `gh run watch` → Expected: green. Site reachable at workers.dev URL (custom domain once user wires DNS).

- [ ] **Step 5: Commit**

```bash
git add site/public/robots.txt site/wrangler.jsonc site/package.json site/package-lock.json .github/workflows/deploy-site.yml
git commit -m "feat(site): Cloudflare Workers deploy + CI workflow"
```

---

### Task 13: Site favicon + OG image (last, per spec)

**Files:**
- Create: `site/public/favicon.svg`, `site/public/og-default.png`
- Modify: `site/src/layouts/Base.astro` (favicon link, `theme-color`, default og:image)

**Interfaces:**
- Consumes: settled visual identity (accent `#6d5ef0` family, Mozilla Headline).

- [ ] **Step 1: Favicon**

`site/public/favicon.svg` — simple mark: rounded square in accent, "F" glyph:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#6d5ef0"/>
  <text x="32" y="44" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="#faf8f5" text-anchor="middle">F</text>
</svg>
```
(Iterate on the glyph/colors to taste once rendered — this is the starting point, judged visually in Step 3.)

- [ ] **Step 2: OG image**

Write a tiny sharp script inline (scratch, not committed) that renders `og-default.png` 1200×630: dark bg `#141416`, site title in Mozilla Headline (render via SVG text → sharp), grid of 6–8 provider favicons. Alternative accepted: screenshot the built hub page at 1200×630 via agent-browser and use that. Save to `site/public/og-default.png` (< 300KB).

In `Base.astro` `<head>` add:
```astro
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="theme-color" content="#141416" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#faf8f5" media="(prefers-color-scheme: light)" />
```
and change the og:image line to fall back: `{<meta property="og:image" content={new URL(ogImage ?? '/og-default.png', Astro.site)} />}` (always emitted now; keep twitter:card `summary_large_image` unconditionally).

- [ ] **Step 3: Verify + commit**

Run: `npm run build && npm run preview` — favicon visible in tab, `curl -s localhost:4321 | grep og-default` finds the tag. Screenshot-check the OG image renders (Read the PNG).

```bash
git add site/public/favicon.svg site/public/og-default.png site/src/layouts/Base.astro
git commit -m "feat(site): site favicon, theme-color, default OG image"
```

---

## Post-launch (out of build scope, tracked here)

- PR to upstream cheahjs/free-llm-api-resources proposing a "Browse this list as a website" link.
- Submit sitemap in Google Search Console (USER ACTION — needs their Google account).
