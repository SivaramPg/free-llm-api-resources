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
