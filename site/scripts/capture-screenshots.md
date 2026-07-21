# Screenshot capture runbook

Goal: one homepage screenshot per provider, captured in both light and dark
`prefers-color-scheme`, converted to webp, and dropped in
`site/public/screenshots/<slug>-{light,dark}.webp`.

## 1. Get the provider list

From `site/`:

```bash
npx tsx -e "import('./src/data/parse-readme.ts').then(m => console.log(m.getProviders().map(p => p.slug + ' ' + p.url).join('\n')))"
```

This prints `<slug> <url>` for all providers (26 as of writing).

## 2. Capture each homepage with the agent-browser skill

For each provider:

1. Set viewport to **1440x900**.
2. Emulate `prefers-color-scheme: light`.
3. Navigate to the provider URL.
4. Wait for the page to finish loading (network idle) plus ~2s settle time
   for hero animations/lazy content.
5. If there's an obvious, single-button cookie/consent banner ("Accept",
   "Accept all", "I agree", etc.), click it before shooting. Don't fight
   multi-step consent flows — just shoot around them.
6. Take a **viewport** screenshot (not full-page) and save as PNG, e.g.
   `/tmp/<slug>-light.png`.
7. Repeat steps 2-6 with `prefers-color-scheme: dark`, saving
   `/tmp/<slug>-dark.png`.
8. If the light and dark captures are visually identical (site ignores the
   media query), keep just one PNG and reuse it for both output filenames in
   step 3.
9. If a site hard-blocks automation (bot wall, CAPTCHA, blank/error page that
   won't resolve after a retry), stop trying, skip it, and note it in the
   skip list. Skipped providers fall back to their brand-color gradient
   placeholder automatically — no broken images.

## 3. Convert to webp

Convert every PNG capture to webp, quality 80, targeting <=200KB:

```bash
npx tsx scripts/convert-screenshot.ts /tmp/<slug>-light.png public/screenshots/<slug>-light.webp
npx tsx scripts/convert-screenshot.ts /tmp/<slug>-dark.png public/screenshots/<slug>-dark.webp
```

(A small sharp-based helper script does the conversion; if a webp comes out
over ~200KB, drop quality to 70 or resize to 1280px wide before re-encoding.)

## 4. Verify

- `ls public/screenshots | wc -l` should be roughly 40-52 (some providers
  share a single capture across both theme filenames; some are skipped
  entirely).
- Open each final webp and confirm it shows a real homepage — not a cookie
  wall, error page, or blank white screen. Re-shoot or move to the skip list
  otherwise.
- `npm run build && npm run preview` — hub hover previews should show
  screenshots, provider hero sections should show screenshots, and skipped
  providers should show the gradient placeholder with no broken `<img>` tags.

## 5. Commit

```bash
git add site/scripts/capture-screenshots.md site/public/screenshots
git commit -m "feat(site): provider homepage screenshots (light+dark)"
```
