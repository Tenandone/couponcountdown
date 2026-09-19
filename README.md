# Coupon Countdown · Recharge Hub

Conversion-first TikTok + LootBar Ten referral hub. Eight independently rendered locales, 238 source-observed products, no client framework or runtime dependency. The previous UI and countdown architecture are not reused.

## Run

Requires Node 22+ (validated with Node 24). `npm ci`, `npm run build`, then `npm run dev`. Open http://127.0.0.1:4173/ko/. Production output is `dist/`.

Copy `.env.example` to `.env` to set `SITE_ORIGIN` and the optional real `GA4_MEASUREMENT_ID`. Build again after changing either. The default canonical domain is `https://couponcountdown.com`. A private Sites publication is separate from switching this existing domain's hosting or DNS.

## Structure

- `src/locales.mjs`: eight locale dictionaries, regional copy, metadata and FAQ templates.
- `src/render.mjs`: static page rendering. No client translation or hydration.
- `data/catalog.json`: source names, slugs, categories, source images, local WebP images, exact observed Ten URLs, HTTP and rendered-page verification.
- `data/game-content.json`: localized names, aliases and per-game editorial overrides. Every locale can override `title`, `description`, `h1`, `cta`, and `faq` (question/answer pairs). Translation does not change the provider URL.
- `data/lootbar-catalog.raw.json`, `data/lootbar-english.raw.json`: complete expanded storefront snapshots, collected September 19, 2026.
- `data/rendered-verification.json`: browser-opened product titles and actual final URLs for all 238 links.
- `data/redirects.json`: existing URL migration rules. Build produces Cloudflare-compatible `_redirects`; the development server also applies them.
- `public/site.js`: immediate partial/alias search, categories, recent selections, locale preference, outbound tracking, optional consent-based GA4 adapter, and a progressively enhanced WebMCP catalog search.
- `scripts/build.mjs`: generates 1,921 indexable pages, canonical/hreflang, sitemap, robots and cache headers.
- `public/games`: local 160/320px WebP product images from the source storefront. No hotlink dependency.

## Checks

`npm test` validates the complete catalog, every generated locale page, internal links, metadata, schema, sitemap, redirects and editorial overrides. After `npm run dev`, open `/__qa/` and run the browser integration checks. This harness is development-only and is not copied into `dist`.

See `docs/implementation.md` for evidence and limitations, `docs/analytics.md` for reporting setup, and `docs/migration.md` for deployment and legacy URL handling.

## Catalog maintenance

The site uses a dated snapshot, not live prices. Re-expand the Ten storefront to its end, save the observed links and images, and review additions/removals before updating `data/catalog.json`. Never construct URLs by slug convention: English and Korean slugs differ. Verify each direct link in a browser, including referral-preserving redirects. Keep unavailable products out of new builds until verified. `scripts/collect.mjs` checks HTTP accessibility and downloads source images; it does not prove rendered availability. `scripts/enrich.mjs` attaches a matching browser verification report. `npm run optimize:images` creates WebP variants. Preserve editorial overrides when refreshing data.

Discounts are deliberately not scraped into permanent badges. The TikTok maximum benefit has a regional/account/promotion qualification. No ratings, security certifications, sales counts or countdown urgency are invented.
