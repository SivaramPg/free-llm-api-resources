import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { PROVIDER_META } from './provider-meta';
import { ProviderSchema, slugify } from './schema';
import type { Caveat, Limit, Model, Provider } from './schema';
import { splitSections, parseLimitsBlock, parseLimitString, type RawSection } from './parse-helpers';

const CAVEAT_PATTERNS: Array<[Caveat, RegExp]> = [
  ['phone-verification', /phone number verification/i],
  ['data-training', /data (is )?used for (training|improvement)|opting into data training|use data for improvement/i],
  ['geo-restriction', /outside of the uk\/ch\/eea\/eu/i],
];

function extractCaveats(body: string): Caveat[] {
  return CAVEAT_PATTERNS.filter(([, re]) => re.test(body)).map(([c]) => c);
}

/** "- [Name](url)" or "- Name" bullets → models.
 *  Only hyphen bullets: this README also uses "* " bullets for prose
 *  caveats/notes (e.g. Mistral's data-training/phone-verification asides),
 *  which must NOT be mistaken for model entries. */
function parseModelBullets(body: string): Model[] {
  const models: Model[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^-\s+(?:\[(.+?)\]\((\S+?)\)|(.+))$/);
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

/** Prose lines that are not model bullets/limits/tables/credits/headers → notes.
 *  Real README quirks handled here:
 *  - Cloudflare Workers AI's section body runs on into a stray leftover
 *    "</tbody></table>" close tag (no matching open tag, so the <table>...
 *    </table> strip below can't catch it) — filtered by the "<" prefix check.
 *  - The same section also runs into the next "## Providers with trial
 *    credits" H2 before the next "### [Name](url)" section header — filtered
 *    by the "#" prefix check below.
 *  - "* " bullets (Mistral providers) are prose caveats, not models; they
 *    fall through here and keep their text as a note. */
function extractNotes(body: string): string[] {
  return body
    .replace(/<table>[\s\S]*?<\/table>/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !l.startsWith('- ') && !l.startsWith('<') && !l.startsWith('#'))
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
  let limits: Limit[] | undefined;
  let limitsUrl: string | undefined;
  const limitsMatch = body.match(/\*\*Limits[^:]*:\*\*\s*(\S[^\n]*)?/);
  if (limitsMatch) {
    let payload: string | undefined = limitsMatch[1]?.trim();
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
