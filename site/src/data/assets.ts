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
