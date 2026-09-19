# Implementation and validation

## Architecture decisions

Static generation was chosen because the conversion journey needs immediate links and search, not accounts, a database or a client-rendered application. All copy, cards, game detail content, internal links and SEO markup arrive in HTML. A small deferred module progressively adds search and preferences. Outbound links, language changes, FAQ disclosures and detail navigation remain usable without JavaScript.

The new visual system is charcoal, mint and white, with a dominant TikTok recharge panel, a single game search surface, real game artwork and direct recharge CTAs. Mobile keeps a fixed recharge action. There are no coupon timers, pop-up signups, invented reviews, or distracting animation.

The primary top-up section contained **192 products** on 2026-09-19. The provider also includes live/social/subscription app products in this category; it is not literally 192 distinct games. The same expanded page showed **11 game keys and 35 gift cards**. All 238 observed products are represented and filterable. The “View all game keys (272)” destination leaves the Ten storefront and is not the requested inventory; unobserved items from that wider marketplace were not fabricated.

## Link evidence

All 238 URLs were extracted from anchors in the rendered, fully expanded Korean Ten store. All returned HTTP 200. Every URL was separately opened in the browser and a visible product H1 was recorded. Some storefront paths redirect client-side to the exact product with `utm_source=Affiliate&utm_medium=Affiliate&utm_campaign=ten`. Every final URL retained either the Ten shop path or the Ten campaign. The source-observed shop URL is preserved in every CTA.

Five gift-card page loads initially timed out and passed on one subsequent retry; the verification report records the retry. No purchases were made. Availability of every SKU, payment methods, regional eligibility, and actual commission attribution are not guaranteed by a link check. Official English display names were collected separately because English product slugs differ; English display names do not imply unverified English outbound URLs.

## SEO and localization

Eight URL locales: ko, en, ja, zh-tw, es-419, es-es, pt-br, ru. There are 1,904 product detail pages, eight homepages, eight privacy pages and a root entry: **1,921 sitemap URLs**. Every localized page has a unique canonical and reciprocal hreflang entries. Every detail page exposes WebPage/Breadcrumb structured data and visible FAQ-aligned FAQPage data. No fabricated Product price or review schema is emitted.

Language-specific metadata, CTA labels and regional account FAQs are authored in the locale dictionaries. A game-and-locale content map permits complete editorial overrides for title, description, H1, CTA and FAQs without changing shared templates. Regional Spanish can diverge independently. Japanese and Traditional Chinese names are supplied for common titles; remaining products use official English names with the source Korean names and URL slug available as search aliases.

## Performance

No runtime framework, third-party font or icon package. Source artwork is downloaded locally and converted to 160/320px WebP. The first optimization reduced the 320px catalog artwork from 17,598,266 to 2,771,666 bytes (84%). Images below the fold lazy-load and reserve dimensions. Detail hero artwork is prioritized. Content-visibility defers the long catalog's rendering. CSS/JS filenames use content hashes with immutable cache headers; product images use short revalidation-friendly caching.

Production Core Web Vitals and Lighthouse scores have not been measured. Static output size and local browser checks are evidence of implementation behavior, not a guarantee of field performance or conversion uplift.

## Checks completed

- Six automated suites cover all 238 products and all 1,920 localized HTML pages, canonical/hreflang, parseable JSON-LD, internal assets, legacy mappings and sitemap coverage.
- Ten browser integration checks cover partial/alias search, empty/reset states, category counts, TikTok and game event attribution, consent/opt-out, recent selections, root language routing, deep language switching, redirects and 404 behavior.
- Browser layout checks at 320px for all eight locales: no horizontal overflow; primary TikTok CTA above the fold and mobile sticky action visible. Additional visual checks at 390px and 1440px.
- WebMCP `search_recharge_catalog` registered, returned the correct Wuthering Waves result for `명조`, updated the visible search results, and rejected non-string input without corruption.
- Actual GA4 remote collection is pending a real measurement ID. Existing-domain launch remains a separate hosting step.
