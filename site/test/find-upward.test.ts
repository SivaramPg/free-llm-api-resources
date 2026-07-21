import { describe, it, expect } from 'vitest';
import { findUpward } from '../src/data/find-upward';

describe('findUpward', () => {
  it('resolves a path that exists at the current cwd (vitest runs from site/)', () => {
    // package.json lives directly in cwd when vitest runs from site/.
    const found = findUpward('package.json');
    expect(found.endsWith('/package.json')).toBe(true);
    expect(found).toBe(`${process.cwd()}/package.json`);
  });

  it('walks upward past cwd to find a marker in an ancestor directory', () => {
    // README.md lives in the repo root, one level up from site/ (cwd).
    const found = findUpward('README.md');
    expect(found.endsWith('/README.md')).toBe(true);
    expect(found).not.toContain(`${process.cwd()}/README.md`);
  });

  it('throws a clear error listing tried dirs for a path that does not exist anywhere', () => {
    expect(() => findUpward('this-file-does-not-exist-anywhere.xyz')).toThrow(
      /findUpward: could not find "this-file-does-not-exist-anywhere\.xyz"/,
    );
  });
});
