# Outbound recharge analytics

Primary KPI: **sessions with at least one outbound_recharge_click / eligible landing sessions**, segmented by locale, provider, device, game and CTA position. Clicks are referral intent, not completed purchases or verified commission. Do not claim revenue or conversion lift without provider-side evidence.

## Event contract

`outbound_recharge_click` fires from the common delegated listener for hero, catalog, search results, recent selections, related products, detail hero and sticky CTAs. Mouse, keyboard activation and middle-click are supported. Native anchor navigation is never delayed or prevented.

| Parameter | Meaning |
|---|---|
| provider | `tiktok` or `lootbar` |
| game_name | Displayed localized product name |
| game_slug | Stable product slug, or `tiktok-coins` |
| locale | URL locale: ko, en, ja, zh-tw, es-419, es-es, pt-br, ru |
| device | Viewport bucket: mobile <=650, tablet <=1100, desktop >1100 |
| page | Local pathname; query strings are not copied |
| cta_position | hero, popular, catalog, search, recent, related, detail_hero, sticky |
| link_url | Exact provider destination including referral attribution |

`hub_view` is emitted on page initialization. GA4's page_view is enabled once per page after consent. GA4 supplies its own session/device metrics as well; the custom `device` dimension describes layout width, not hardware identity.

## Connect GA4

1. Put the real `G-...` measurement ID in `.env` as `GA4_MEASUREMENT_ID`, then rebuild and publish.
2. Register event-scoped custom dimensions for provider, game_slug, game_name, locale, device, page and cta_position.
3. Mark `outbound_recharge_click` as a key event. Use a session-based funnel/exploration for the rate; raw event counts over pageviews can exceed 100% and are not a session conversion rate.
4. Verify actual collection in GA4 DebugView/Realtime on the deployed domain, after accepting analytics. No ID was supplied in this task, so remote ingestion is not yet validated.

Without a GA ID, no Google script is loaded. `cc:analytics` CustomEvents always expose the current in-memory event for a future first-party adapter; they are not transmitted. With analytics consent but no ID, events are observable in `window.dataLayer`. With an ID and consent, the adapter forwards once through gtag with beacon transport. Do not also install a GTM trigger for the same events without deduplicating.

Declining analytics stops forwarding. The footer reopens analytics choices. Revocation updates Google consent to denied when loaded. Browser-local preferences use `cc-locale`, `cc-recent` (last five product slugs) and `cc-consent`. Corrupt or unavailable storage must not block navigation or search. Consent-based reporting covers consenting users, not every visitor; browser blocking and closing tabs can also affect collection.

## Local verification

`tests/browser.html` checks exact TikTok destination, game and CTA position attribution, locale/page/device parameters, consent gating, opt-out, search state and recent selections. It prevents navigation only inside the development harness. The production click handler never does.
