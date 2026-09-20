# Weekly snapshot Markets MVP

Review branch codex/markets-hub only. Production main, CNAME/DNS and Pages settings unchanged. Existing recharge hub preserved.

## Sources and schedule

Monday 09:00 KST / 00:00 UTC, once per week. GitHub may queue late. BTC, ETH and XAU use official https://api.gold-api.com/price/{symbol} with no account/key. USD/KRW uses https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=KRW (latest ECB reference, not executable live FX). Six BLS/Fed feed/calendar requests continue. Total normal budget: 10 requests/week; cached same-edition rerun: zero. Serial market requests spaced over one second. No secret or authenticated history endpoint needed.

Gold API commercial website display is permitted by https://gold-api.com/terms . No raw-data resale service is built. Official current-price docs https://gold-api.com/llms.txt state no numerical limit and require 30-second caching. Source links retained. ECB attribution and USD-base conversion disclosure retained. See keyless-market-data-review.md for alternatives and restrictions.

## Snapshot schema and meaning

Schema version 3. Each available item contains asset/slug, symbol, currency, unit, weekId, price, previousPrice, changePercent, collectedAt, observedAt, previousCollectedAt, source and status. No high, low, volume or historical OHLC fields.

First successful observation: previousPrice and changePercent are null solely because no comparison exists; eight locales show baseline collected and changes from next week. These nulls never overwrite an existing good price. Later change = (price / previousPrice - 1) * 100. Previous means the latest successful snapshot, not necessarily exactly seven days ago. Both actual collection dates are displayed. Failed weeks can lengthen the comparison interval. Same-edition corrections keep the original comparison baseline and do not compare against themselves.

Initial Preview collection was Sunday 2026-09-20, explicitly timestamped as a manual baseline. The following Monday comparison can be shorter than seven days; copy states actual collection-to-collection change. Prices are static once collected, never advertised as streaming. Provider observation time is separate from retrieval time; ECB's date-only reference is stored at 00:00 UTC as a date anchor, not an asserted publication time.

Archives use /LOCALE/markets/weeks/YYYY-MM-DD/ where the date is Monday of the collection edition. New first archive /ko/markets/weeks/2026-09-14/. The prior prelaunch OHLC prototype /weeks/2026-09-07/ redirects to Markets and is removed from sitemap; historical prototype JSON is not reused as a snapshot. Official news uses the last completed UTC week, with calendar dates independently disclosed.

## Failure handling

Validate positive finite prices, correct symbol/currency, observation timestamps (future rejected; crypto max age one day, gold/FX seven days). Invalid/failed input retains exact last normal values, original timestamps and comparison with stale status. Failed weeks never synthesize zero prices. Complete failure retains the prior published edition marked stale, logs an Actions warning and exits successfully so recharge build continues. A cached rerun does not silently re-fetch; --refresh is the explicit retry/correction control.

At least two fresh assets or one fresh asset with two verified releases are required for a new edition. No thin new archive on total failure. Indices remain pending and are displayed in a quiet lower section. Missing asset pages noindex; available asset pages, overview and snapshot archives have locale metadata/canonical/hreflang/OG and sitemap entries.

## Validation / launch

Actual keyless calls returned all four prices; no credentials or accounts were created. Unit tests cover first baseline, later changes, same-week refresh, stale retention, wrong-symbol rejection, timestamp/numeric rejection, metadata and GA4 consent/events. Browser tests cover 8 locales at 320/375/390/430px.

No manual API key setup remains. Launch still requires separate approval to merge main and enable MARKETS_AUTOMATION_ENABLED=true. The current review task publishes only the private Preview. GA4 G-1TS6F1NK5K and existing recharge events are preserved; administrator DebugView receipt unverified.
