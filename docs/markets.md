# Markets preview — 20 September 2026

Review branch: `codex/markets-hub`. Production `main`, Pages source `main /`, CNAME and DNS are unchanged. The hourly production workflow is gated off. This preview is a static snapshot, not a continuously updating deployment.

## What works now

- 64 static Markets pages: one overview and seven asset pages in each of `ko`, `en`, `ja`, `zh-tw`, `es-419`, `es-es`, `pt-br`, `ru`.
- Live fetch prototype: BTC, ETH, gold current quotes; USD/KRW daily reference rate and previous-reference/7-day changes.
- S&P 500, Nasdaq **Composite**, KOSPI pages exist but prices are unavailable pending licensed provider access and verified mappings. No ETF proxies, guessed symbols or scraped exchange quotes.
- Current-price-only BTC/ETH/gold responses contain no day change, high, low or volume. These show `—`, not zero. Optional free Gold API credentials unlock rolling 24-hour and 7-day OHLC requests. No volume is invented.
- Unavailable asset pages are `noindex,follow` and excluded from sitemap until valid data exists. All 64 routes remain usable. Current sitemap: 1,961 URLs; total canonical HTML pages: 1,985.

## Source research and rights

Checked official sources on 2026-09-20. No paid subscription or new account was created.

| Source | Use and cost | Limits / licensing |
| --- | --- | --- |
| [Gold API docs](https://gold-api.com/docs), [endpoint reference](https://gold-api.com/llms.txt) | BTC, ETH, XAU in USD. Current quotes are free, no key. Optional history/OHLC uses `GOLD_API_KEY`. | [Free: 10 history/OHLC calls/hour; Premium $10/month](https://gold-api.com/pricing). Current quotes have no stated numeric cap; avoid abusive bursts. Three quotes/hour + six history requests/hour fit the free plan. Docs request caching responses for 30 seconds. [Terms](https://gold-api.com/terms) explicitly permit commercial web use; no specific maximum retention is stated. |
| [Frankfurter](https://frankfurter.dev/) → ECB-only provider | USD/KRW daily reference cross-rate, free, no key. One 18-day query/hour. | No monthly/daily quota; abuse throttling. Commercial API use and caching supported. [ECB reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) permits commercial/noncommercial reuse of its published statistics with attribution. This is not a bank dealing rate. |
| [Twelve Data](https://twelvedata.com/docs) | Optional index adapter: `/quote` plus `/time_series`, 2 calls/index/hour. **Not connected or billed.** | [Individual Basic](https://twelvedata.com/pricing): 8 credits/minute, 800/day, unsuitable for this site's commercial display. [Commercial policy](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) requires appropriate business rights and further approval for international data. [March pricing notice](https://twelvedata.com/news/march-2026-updates) lists Venture $499/month; index rights can add costs. Confirm all three indices, external display, cache lifetime, public Git retention and redistribution permission before enabling. Coverage for the specific licensed account has **not** been verified. |

Rejected for now: CoinLore's API is publicly callable, but its [general terms](https://www.coinlore.com/terms-of-use) require written consent for commercial reuse. CoinGecko's commercial plans require a paid commercial license and its [API terms](https://www.coingecko.com/en/api_terms) set cache refresh conditions; no account is configured. Unofficial Yahoo endpoints and unlicensed index scraping were not used.

Gold API is an aggregator, not a direct exchange feed. Provider responses were validated against symbol, currency, numeric fields and timestamps; this does not establish tick-level exchange accuracy. Prices are hourly snapshots and can be delayed.

## Data contract and failure behavior

`src/markets/data.mjs` defines exactly seven identities and a provider-neutral contract. `data/markets/latest.json` stores normalized observations, never provider credentials or raw error bodies. `source`, `updatedAt` (observation), `lastSuccessAt` (retrieval), `dateOnly`, `changeBasis`, `weekComparisonAt` avoid conflating daily data with live quotes. Index units are points; gold is USD/troy ounce; FX is KRW per USD.

`scripts/fetch-markets.mjs` handles failures per asset with a 20-second request timeout. Reject zero/null/NaN prices, wrong identity/currency, future timestamps, invalid ranges, older observations, or loss of previously present metrics. Keep the whole last-good snapshot (including its timestamps) rather than mix old changes with a new price. First-run failures remain unavailable. Log a sanitized warning and continue the site build. Write JSON atomically.

An explicit fetch failure marks the snapshot stale immediately. Freshness also checks quote age (crypto 3h; index/gold 96h to tolerate closed sessions; daily FX 120h) and retrieval age (3h). The browser rechecks every minute and on tab visibility without any API call. An expired snapshot never silently becomes a fresh quote. These are freshness budgets, not a full exchange holiday calendar.

No causal market commentary is generated from prices. `data/markets/context.json` can hold 2–4 brief reviewed facts per asset/locale with an official source, publication timestamp and ≤48h expiry. Unknown/unreviewed sources and untranslated facts are omitted; the page says verified context is pending. No news ingestion or AI cause generator is enabled in this MVP. This deliberate limitation avoids speculative explanations.

## Scheduled workflow (not activated)

`.github/workflows/update-markets.yml`: minute 23 of each hour → checkout current main → npm ci → fetch/normalize → lint → build → tests → prepare existing root output → regular non-force commit/push → explicitly request the existing Pages build and verify its commit. GitHub-token pushes alone do not reliably trigger another Pages workflow; the [documented Pages build API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build) handles that step. Configuration is read and checked, never changed.

Two gates: branch must be main **and** repository variable `MARKETS_AUTOMATION_ENABLED=true`. Neither is activated for this preview. A concurrent main update causes a safe non-fast-forward failure; the next run starts with fresh main. No automatic merge or force push. Pages API/deployment and authenticated provider requests have not been exercised against production for this change.

About 24 runs/day. [Standard GitHub-hosted runners are free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions); private repositories consume the owner's allowance. Scheduled runs can be delayed, so the UI never promises exact real-time quotes. Check Actions notifications and stale timestamps. Generated files remain in the existing repository, consistent with its current deployment; longer-term retention should be revisited before enabling a commercially licensed index feed.

## SEO, UI and analytics

- Natural titles/descriptions in eight locales, one H1, canonical/OG production URLs, reciprocal hreflang and WebPage/Breadcrumb structured data. Sitemap includes data-backed pages; no fake price schema. Existing robots/redirects remain.
- Lightweight independent Markets stylesheet; no chart library, extra browser API fetch or backend. No new dependency. Existing recharge CSS is unchanged.
- One low-key cross-navigation block to games and TikTok below the market information. Recharge footer gains a small Markets link; hero/search/sticky unchanged.
- Existing GA ID `G-1TS6F1NK5K` and consent adapter retained. New events: `market_page_view`, `market_asset_click`, `markets_to_games_click`, `markets_to_tiktok_click`; dimensions `asset`, `locale`, `page`, `source_section` plus existing device dimension. On first consent, market page view is forwarded once. One canonical `outbound_recharge_click` per outbound action; other events are diagnostics, not extra conversions.
- In GA4, define event-scoped custom dimensions asset/locale/page/source_section as needed. Funnel: session default channel group Organic Search → market_page_view → market_asset_click → markets_to_games_click or markets_to_tiktok_click → outbound_recharge_click. Do not add internal UTM tags that would overwrite acquisition attribution. Browser tests intercept Google requests; live DebugView receipt remains **unverified**.

## Before production review

1. Review the private preview at `/ko/markets/` and each asset slug: `bitcoin`, `ethereum`, `sp500`, `nasdaq`, `kospi`, `usd-krw`, `gold`. The same routes work under all eight locale prefixes.
2. Optional: create a free Gold API key and put it only in GitHub Actions secret `GOLD_API_KEY` (or ignored local `.env` for testing). This enables missing crypto/gold metrics without a paid tier. Do not place it in the chat, JSON, browser or repository.
3. Resolve index access: confirm coverage and display/cache/public-repository rights with the provider, then add `MARKET_API_KEY` as a secret. Populate `data/markets/providers.json` with per-slug exact `symbol`, `name`, `exchange`, `timezone` copied from the licensed provider's directory. Set `MARKET_INDEX_DISPLAY_APPROVED=true` only after the above rights are confirmed. Test actual responses before calling this seven-asset live coverage.
4. Review metrics units, timestamp freshness and empty context states. Confirm whether this four-live/three-pending preview is suitable for the initial launch or wait for indices.
5. Only after explicit production approval, merge the reviewed branch and set `MARKETS_AUTOMATION_ENABLED=true`. Verify the first scheduled/dispatch run, resulting Pages SHA and public routes. Existing production settings and DNS need no change.
6. Validate GA DebugView using an authorized Analytics session; it was not available during implementation.

## Validation

Build and lint pass. Unit/integration tests cover source normalization, invalid/partial-data fallback, publication gates, 64 localized pages, SEO, link resolution, analytics, original 238 products and maintenance ordering. Browser harness covers the original recharge flows, Markets funnel/deduplication, all seven routes, and all eight locales at 320/375/390/430px. Exact test counts and preview commit are reported with delivery.
