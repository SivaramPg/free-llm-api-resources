import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findUpward } from './find-upward';

// Located via the repo root (the dir containing `site/package.json`) rather
// than process.cwd() directly or import.meta.url: cwd varies (repo root vs
// `site/`, depending on how the caller was invoked) and Astro/Vite inlines
// this module into a bundled chunk during `astro build`, which moves its
// on-disk location and breaks import.meta.url-relative resolution.
const repoRoot = dirname(dirname(findUpward(join('site', 'package.json'))));
const PUBLIC = join(repoRoot, 'site', 'public') + '/';

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
