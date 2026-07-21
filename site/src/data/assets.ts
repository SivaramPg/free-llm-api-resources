import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolved relative to process.cwd() (the `site/` directory, per project convention)
// rather than import.meta.url: Astro/Vite inlines this module into a bundled chunk
// during `astro build`, which moves its on-disk location and breaks import.meta.url-
// relative resolution.
const PUBLIC = resolve(process.cwd(), 'public') + '/';

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
