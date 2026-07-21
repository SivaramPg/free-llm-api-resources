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
  // Clamp pure-black/white text tokens: a brand icon whose base color is
  // already pure #000000/#ffffff passes adjustForContrast unchanged (it
  // already clears the AA threshold), but the project forbids pure #000/#fff
  // tokens outright. Substitute the design system's near-black/near-white
  // instead — both still clear 4.5:1 against either bg, proven below by the
  // hard assertion running *after* this clamp.
  if (tokens.light.text === '#000000') tokens.light.text = '#141416';
  if (tokens.light.text === '#ffffff') tokens.light.text = '#faf8f5';
  if (tokens.dark.text === '#000000') tokens.dark.text = '#141416';
  if (tokens.dark.text === '#ffffff') tokens.dark.text = '#faf8f5';
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
