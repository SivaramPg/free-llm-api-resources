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
