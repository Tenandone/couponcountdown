# Keyless market-data review — 2026-09-20

Scope: free commercial referral website, public weekly summaries, GitHub Actions, BTC/ETH/gold. Public reachability is not a redistribution licence. No accounts, contracts or subscriptions were created.

## Candidate comparison

| Provider / assets | Key | Commercial website and redistribution | Rate limit | Attribution | Weekly data | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Gold API current prices / BTC, ETH, XAU | None | Terms §9 expressly permit commercial web/apps and third-party websites. Displayed summaries in scope; unrestricted raw-data resale not granted. | Docs say no numerical current-price cap; cache 30 seconds, avoid bursts. | No mandatory clause found; source links retained. | Only prospective weekly snapshot-to-snapshot changes after two scheduled observations; not historical OHLC or high/low. | Simplest keyless option if snapshot semantics are accepted. |
| Gold API OHLC / same three | Free key | Same website permission | 10 history/OHLC requests/hour | Source links | Exact historical week OHLC | Existing fallback, not yet authenticated |
| Coinbase Exchange / BTC, ETH | Public endpoints: none | Market Data Terms restrict external display/redistribution and derived works without written consent. | 10 requests/sec/IP, burst 15 | Attribution alone does not grant permission | Daily candles could be aggregated | Reject for this site's use |
| Kraken / BTC, ETH | Public endpoints: none | Global terms restrict making content available to third parties except expressly allowed; commercial permission not established. | Public requests <=1/sec remain within limits | Permission must be resolved first | OHLC supported | Reject without separate permission |
| Coin Metrics Community / BTC, ETH | None | CC BY-NC 4.0, noncommercial | 10 requests/6 sec/IP | CC attribution; NC still applies | Reference series, availability limits | Reject for commercial referral site |
| CoinPaprika Free / BTC, ETH | None | API terms reserve commercial use for paid plans; redistribution Enterprise only | 20,000 calls/month | Attribution cannot cure Free licence restriction | Daily history available, entitlement-dependent | Reject |
| CoinLore / BTC, ETH | None | API marketing mentions businesses, but general terms prohibit copying, redistribution or commercial content use without express written consent. No explicit API exception verified. | Recommends ~1 request/sec, no strict stated cap | Permission unclear; source credit insufficient | Public OHLCV documentation lists 365 days | Reject pending written clarification |
| Bitstamp / BTC, ETH | Public endpoints: none | Commercial data licence agreement must be signed; no verified automatic free commercial grant | 400/sec and 10,000/10 min default | Agreement-dependent | OHLC available | Reject: separate agreement |
| Narodowy Bank Polski / gold | None | Official API publishes calculated gold reference prices, but no gold-specific commercial redistribution grant was verified. Public-service status alone is insufficient evidence. | Up to 93 days/request; no numeric request-frequency quota found | Unverified for proposed gold reuse | Daily PLN/gram reference series; not USD spot OHLC | Hold, do not substitute or scrape |
| Global Metals Intelligence / gold | No developer key system | Official documentation says general third-party commercial redistribution is not offered | No relevant permitted commercial quota verified | Does not resolve redistribution restriction | Some historical records expose licence fields | Reject for production use |

## Primary sources

- Gold API endpoints: https://gold-api.com/llms.txt ; terms: https://gold-api.com/terms
- Coinbase market-data licence: https://www.coinbase.com/legal/market_data ; rate limits: https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits
- Kraken global terms: https://www.kraken.com/legal/global-terms ; public API: https://docs.kraken.com/exchange/guides/overview ; limits: https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-
- Coin Metrics official archive licence: https://github.com/coinmetrics/data ; community access: https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data
- CoinPaprika API terms: https://coinpaprika.com/api-terms-of-use/ ; pricing: https://coinpaprika.com/api/pricing/ ; redistribution: https://coinpaprika.com/api/faq/
- CoinLore API: https://www.coinlore.com/cryptocurrency-data-api ; terms: https://www.coinlore.com/terms-of-use
- Bitstamp official API and commercial licence requirement: https://www.bitstamp.net/api/
- NBP official API: https://api.nbp.pl/en.html (main NBP site returned 403 during this research; no access controls bypassed)
- Global Metals Intelligence: https://globalmetalsintelligence.com/developers/docs

## Actual keyless probe

Three serial, unauthenticated official Gold API /price requests returned HTTP 200 for BTC, ETH and XAU, USD values and provider timestamps. Probe timestamp: 2026-09-20T11:14:19Z. Response evidence is in ignored artifacts/keyless-probe.json, not presented as historical weekly data. This verifies access from the local Node environment, not from GitHub-hosted runners. No unlicensed candidate data was published.

## Choice and tradeoff

No reviewed source meets all requirements for immediate historical BTC/ETH/gold weekly OHLC without either a key or additional commercial rights. This is a finding about the reviewed candidates, not proof that no such provider exists.

A viable keyless design is Gold API's public current endpoint, called once per asset on Monday, persisting timestamped observations and comparing consecutive scheduled weeks. It requires one full interval after the first scheduled baseline. It cannot backfill previous weeks, produce true weekly highs/lows, call today's quote last week's close, or calculate seven-day change from irregular/missing observations. This changes the meaning from OHLC to weekly sampling; user preference is pending before implementing that change. Until then retain the existing historical adapter and Preview unchanged.
