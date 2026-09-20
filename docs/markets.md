# Weekly Markets Preview — 20 September 2026

Review branch: codex/markets-hub. Production main, Pages main-root deployment, CNAME and DNS are unchanged. Production publishing stays disabled until review and MARKETS_AUTOMATION_ENABLED=true.

## Scope and cadence

Monday 00:00 UTC / 09:00 Korea, once a week. Collect the completed Monday–Sunday UTC week. Seven assets, eight locales, concise overview and asset pages, permanent /LOCALE/markets/weeks/YYYY-MM-DD/ archives. No streaming, charts, forecasts, trading, long generated analysis or browser provider requests. Existing 238-product recharge hub and maintenance rules remain intact.

Each connected asset shows start/end, return, high/low, source and collection date. FX uses the first/last daily reference observations inside the week, and daily reference extrema rather than intraday trading extremes. Exact observation dates and USD conversion are disclosed. BTC/ETH/gold use exact completed-week OHLC, never current quotes repurposed as historical data.

Official releases are shared macro context, not alleged causes of each asset's movement. At most five verified releases; fewer are shown when fewer are available. Original titles are expandable. Next-week BLS and FOMC calendars are source-linked; US release times preserve America/New_York and FOMC times are not guessed. Coverage is explicitly incomplete.

## Current edition and gaps

7–13 September 2026 is the last completed UTC week at collection on Sunday 20 September. The next Monday collection will cover 14–20 September.

- USD/KRW connected: five observations, 1,347.93 to 1,342.79 (−0.38%), high 1,347.93 and low 1,336.20.
- BTC/ETH/gold adapters implemented, pending free GOLD_API_KEY in GitHub Secrets. Live authenticated OHLC is untested without the key. No account, subscription or paid contract created.
- S&P 500, Nasdaq Composite, KOSPI pending verified free commercial display/redistribution rights. No ETF substitutes or unofficial quote scraping.
- Two verified releases (CPI/PPI) and two next-week events (import/export prices, FOMC). This is not three to five asset-specific reasons per asset. Crypto/Korean asset-specific news and earnings calendars are not connected.
- Missing asset pages: noindex,follow, excluded from sitemap. Current sitemap 1,945 URLs; 1,993 canonical HTML pages including eight archive pages.

## Sources and permissions

Official sources reviewed 2026-09-20. Rights below concern displayed website content, not unlimited raw-data resale.

| Provider | Free/commercial reuse | Budget and attribution |
| --- | --- | --- |
| [Gold API docs](https://gold-api.com/llms.txt), [terms](https://gold-api.com/terms) | Free history key tier; commercial web/apps and third-party websites permitted. BTC/ETH/XAU OHLC pending key. | Free 10 history/OHLC requests/hour; 3/week planned. No mandatory attribution found in reviewed terms; source links included. |
| [Frankfurter](https://frankfurter.dev/) / [ECB reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) | Free, no key; commercial statistics reuse allowed with attribution and conversion disclosure. | No daily/monthly cap, abuse throttling; 1/week. ECB attribution required. |
| [BLS](https://www.bls.gov/feed/), [reuse policy](https://www.bls.gov/bls/linksite.htm) | Official public-domain text, excluding designated images/logos. Only text/calendar facts used. | No numeric feed quota stated; 4/week. Original source links retained. |
| [Federal Reserve](https://www.federalreserve.gov/feeds/feeds.htm), [disclaimer](https://www.federalreserve.gov/disclaimer.htm) | Public-domain official material except identified third-party content. Only official titles/calendar facts used. | No numeric feed quota stated; 2/week. Original source links retained. |

Total with free OHLC key: 10 requests/week; currently 7. Normal same-week reruns are cached and use zero provider calls. An explicit --refresh correction or workflow refresh input consumes another collection. No rapid automatic retries.

[FRED sharing guidance](https://fredhelp.stlouisfed.org/fred/graphs/share-my-fred-graph/cite/) requires original-provider permission for commercial sharing of copyrighted [SP500](https://fred.stlouisfed.org/series/SP500) and [NASDAQCOM](https://fred.stlouisfed.org/series/NASDAQCOM). [FSC/KRX metadata](https://www.data.go.kr/catalog/15094807/openapi.json) and [dataset](https://www.data.go.kr/data/15094807/openapi.do) list noncommercial/no-modification and third-party restrictions. Weekly frequency does not waive these restrictions. No paid fallback.

## Pipeline and recovery

npm run markets:fetch → validate → atomic weekly JSON/index → lint/build/tests → prepare existing Pages output → normal Git push → request and verify existing Pages build.

- src/markets/weekly.mjs: UTC boundaries, exact OHLC windows, price/range/return validation, provider adapters and same-week and explicitly dated stale recovery.
- src/markets/weekly-sources.mjs: official feeds/calendars, date filtering, source-host allowlist and deduplication.
- weekly-copy.mjs and render.mjs: eight locales, overview/detail/archive, canonical/hreflang/Article metadata.
- Old hourly adapters, snapshots and browser freshness timer removed. No hourly workflow remains.
- Partial failure retains the last verified value, including a previous week, marked stale with its original week and verification timestamp. Never relabel old numbers as current-week observations. If no usable prices or releases exist, retain the previous published edition. Save source status in JSON and preserve archive URLs.
- Main and explicit automation variable are both required for production writes. Concurrent pushes fail safely; no force push or DNS/Pages source change.

## Validation and activation

Tests cover UTC/year boundaries, OHLC windows, FX dates, same-week fallback, index/no-key blocking, feed/date safety, calendar parsing, locale/archive metadata and consent-aware analytics without duplicate outbound conversions. Browser coverage includes 320/375/390/430px and recharge interactions.

Before production: review Preview, add the free Gold API key if desired, verify its live OHLC response, then separately authorize review-branch merge and automation activation. This task does not enable production publication. Index rights and asset-specific editorial coverage remain gaps. GA DebugView actual receipt has not been checked in an authenticated administrator session.

## Final MVP review

Connected rows appear first in BTC, ETH, USD/KRW, gold priority order. Unconnected priority assets are a compact note, and the three indices are a subdued section below official releases/calendar. No price is shown for indices. Calendar is omitted when no event is verified.

Publish/archive eligibility requires at least two current-week price series, or one current-week series plus two verified releases. Thin or fully failed collections retain the last published edition. Existing /weeks/YYYY-MM-DD/ URLs remain unchanged rather than introducing duplicate archive routes. Missing/corrupt edition files fall back to the latest readable eligible edition at build time.

Cron is 0 0 * * 1 (Monday 09:00 KST); GitHub may queue scheduled jobs after the requested time. No exact-time delivery guarantee.

Repository Actions Secrets and local environment were checked: GOLD_API_KEY is absent. Registration must be completed by the owner on the free plan, then the key saved directly to GitHub Secrets. Never put it in chat, source, build assets or logs. Production automation remains disabled.
