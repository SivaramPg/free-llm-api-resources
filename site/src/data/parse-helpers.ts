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
    .flatMap(p => splitRespectingThousands(p))
    .map(p => p.trim())
    .filter(Boolean);
  return { limits: parts.map(parseLimitString), limitsUrl };
}

/** Split "30 requests/minute, 2,000 requests/day" on commas that are NOT thousands separators. */
function splitRespectingThousands(s: string): string[] {
  return s.split(/,(?!\d{3}\b)/);
}
