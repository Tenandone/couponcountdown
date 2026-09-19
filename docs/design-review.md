# Recharge hub UI review — 2026-09-19

Scope: UI, copy and progressive catalog presentation. Existing data, referral destinations, routes, metadata, consent and GA4 adapter remain in place. GitHub main and couponcountdown.com production are not changed.

## Structure and copy

Home: compact TikTok hero → game search and suggestions → popular games → recent selections (when available) → brief Ten-link explanation → all products → collapsed FAQs. All products starts with 12 and reveals 24 more per press. Search immediately covers every one of the 238 products and aliases, regardless of the visible browsing limit. Without JavaScript the complete static catalog remains accessible. Search hides intervening popular/benefit sections to bring results closer.

Removed: introductory slogan, duplicate main heading, giant tilted 25% lettering, dark promotional panel, benefit pills, checkmark trust strip, repeated LootBar masthead, card frames, excess rounded corners, drop shadows and transitions. One green action color; neutral backgrounds and small image radii. The honest catalog label says 238 products, since the inventory includes keys and gift cards.

Before: slogan plus large discount typography and web-recharge badge competed above search.
After: TikTok Coins, a conditional savings line, a direct recharge button and a short price qualification. Eight locale-specific copy sets use short natural CTA labels (including distinct Latin American and Spain Spanish).

The Ten explanation appears between featured/recent products and the full catalog, and directly after the product introduction on detail pages. It states conditional coupon/community eligibility and the need to reuse the same link. No guaranteed reward, fabricated community endorsement or platform ranking is claimed.

## Conversion review

1. Purpose at first glance: TikTok title/button and game search are explicit, without an introductory paragraph. This is a design assessment, not a measured three-second user study.
2. TikTok first: it is the first content block and only filled primary action above search.
3. Fast game lookup: immediate partial/alias search is preserved across all 238 products; no extra page or category selection is required. A five-second finding time is not claimed as empirically measured.
4. Link reason: explanation body fits three lines at 320px in all eight locales (including the space used by the browser scrollbar).
5. Reading load: short hero, one-line detail intro and collapsed FAQs; privacy and essential purchase qualifications remain.
6. Generic landing-page decoration: oversized discount number, slogans, badges, shadowed cards and decorative effects removed.
7. Mobile action: search fits in the first viewport; popular games use compact image rows; sticky CTA is shown only after the corresponding primary button leaves view.
8. CTA competition: game actions are quiet text links; one filled hero action; no duplicate sticky button while the hero CTA is visible.
9. Provider emphasis: LootBar appears where destination/payment context is useful, without promotional platform claims.
10. Ten attribution: a concise, conditional benefit explanation sits within the game journey and on each detail page.

## Verification

- Build: 1,921 pages; 238 products; all 8 locales.
- Automated tests: 11 passing, including full pagination reachability, search beyond the initial twelve, direct links, aliases, GA4 ID/events/consent, canonical/hreflang and structured data.
- Actual browser harness: 11 passing (search, filters/show-more, recent, six analytics events, consent, languages, detail routes and redirects).
- Visual inspection: desktop homepage, 390px mobile homepage/detail, and 320px overflow/copy-length checks for all eight locales. No horizontal overflow at 320px; Ten explanation body is three lines.
- Existing Measurement ID G-1TS6F1NK5K and event parameters are unchanged. QA intercepts Google script loading; no synthetic tests are sent into the live property.
- This revision is a design hypothesis for higher outbound click rate, not a claim of measured conversion lift.
