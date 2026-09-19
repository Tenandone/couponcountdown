# Existing GA4 and recharge event contract

The existing Measurement ID is **G-1TS6F1NK5K**, restored from the live site's HTML and the original GitHub main branch. It is the build default in data/site-config.json; GA4_MEASUREMENT_ID is an optional environment override. Account 387649802 and Property 528476729 are user-provided metadata only and are never passed to gtag. No property was created.

## Events

| Event | Trigger |
|---|---|
| tiktok_cta_click | TikTok outbound activation |
| lootbar_click | LootBar outbound activation |
| game_card_click | Card recharge or internal detail link; interaction distinguishes these |
| game_search | Settled nonempty search after 350 ms, a suggestion, or the assistant search tool |
| language_change | Language selector activation; includes target_locale |
| sticky_cta_click | Sticky outbound CTA activation |
| outbound_recharge_click | Exactly one canonical event per outbound activation |
| hub_view | Page initialization |

All six requested events include game, locale, page, cta_position and destination. Search game is a slug only for a single matching product, otherwise an empty string. Language changes include the detail-page slug when available. Outbound events also include provider, game_name, game_slug, link_url and device (viewport bucket). Page excludes query strings. Search sends result_count, query_length and category, never arbitrary typed search text. Identical settled searches are deduplicated until cleared or changed.

## Reporting and consent

Primary KPI: sessions with at least one outbound_recharge_click divided by eligible landing sessions, segmented by locale, provider, device, game and CTA position. Do not sum diagnostic event names as additional conversions. Clicks indicate recharge intent, not completed purchases or commission.

GA initializes once after explicit analytics consent. gtag receives the existing measurement ID and beacon event transport. Declining or revoking consent stops forwarding, and revocation updates Google's consent state. In-memory cc:analytics events remain observable without network transmission. Native anchor navigation is not delayed. Mouse, keyboard activation and middle click are supported; right click does not record a conversion. No GTM duplicate trigger is installed.

Inside the existing GA property, configure event-scoped dimensions for game, locale, page, cta_position, destination and provider if desired; mark only the canonical outbound_recharge_click as the primary key event. These GA admin settings have not been modified.

## Verification and limits

npm test includes isolated DOM event tests without an external resource loader. The /__qa/ browser harness uses a development-only script-loader interceptor (?qa=1) to inspect gtag commands without sending test events into the live property. Neither harness nor interceptor is included in dist.

The automatic tests and actual browser checks validate restored config, all six events, payloads, consent, duplicate prevention, search, redirects and locale preservation. GA admin redirected to a signed-out Google account selector, so Property 528476729's stream-to-ID mapping and DebugView/Realtime receipt could not be independently inspected. The recovered ID is conclusively the one on the existing production site. Remote ingestion is not claimed as tested. No production publication was performed.
