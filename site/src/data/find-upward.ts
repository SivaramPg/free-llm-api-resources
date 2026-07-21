import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Walks upward from `process.cwd()` through parent directories until
 *  `<dir>/relPath` exists, returning that absolute path.
 *
 *  This exists because path resolution relative to `import.meta.url` is
 *  unreliable for these callers: `astro build` inlines modules into bundled
 *  `dist/.prerender` chunks, moving their on-disk location, and `tsx`
 *  scripts need the same resolution logic without any Vite involved at all
 *  (so Vite-only tricks like `?raw` imports or `import.meta.glob` are out).
 *  `process.cwd()` is stable across both: it's wherever the command was
 *  invoked from (repo root or `site/`), and walking upward from there finds
 *  the target regardless of which one that is. */
export function findUpward(relPath: string): string {
  const start = resolve(process.cwd());
  const tried: string[] = [];
  let dir = start;
  for (;;) {
    tried.push(dir);
    const candidate = join(dir, relPath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `findUpward: could not find "${relPath}" searching upward from "${start}". Tried: ${tried.join(', ')}`,
      );
    }
    dir = parent;
  }
}
