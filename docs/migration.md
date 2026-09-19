# Existing-site audit and migration

The workspace initially contained only `.git`: no commits, remote, application source, build configuration, analytics setup or hosting credentials. There was no reusable local code to preserve at that time. A subsequent prelaunch audit found and connected the existing Tenandone/couponcountdown GitHub repository and restored its GA4 ID, CNAME, Naver verification and coupon datasets; see prelaunch-audit.md.

The public homepage and XML sitemap were read on 2026-09-19. The sitemap listed five URLs, with `en` and `x-default` for the existing English pages. Original captures are `data/legacy-home.html` and `data/legacy-sitemap.xml`. This is an inventory of observed URLs, not a Search Console traffic/backlink audit; no traffic value is claimed.

| Observed URL | New destination |
|---|---|
| `/` | Lightweight language entry; saved preference, then browser language, then English |
| `/wos/` | `/en/games/whiteout-survival/` |
| `/kingshot/` | `/en/games/kingshot/` |
| `/lastwar/` | `/en/games/last-war-survival/` |
| `/tilessurvive/` | `/en/games/tiles-survive/` |

Both slash and non-slash legacy game paths have 301 mappings. Existing coupon pages become top-up pages for the same game; this preserves game intent but intentionally removes countdown functionality. For hosts that ignore `_redirects`, apply `data/redirects.json` in the host's native redirect configuration before launch. Do not use a blanket SPA fallback: unknown routes must return HTTP 404. All requested locale and game routes are physical HTML directories.

## Production-domain switch

The Sites project is a private, reviewable publication. It does not automatically replace the live `couponcountdown.com` domain. Deploy `dist/` to the domain's actual hosting project, or configure a supported custom-domain mapping with the owner. Domain credentials and the previous hosting configuration were not present in the repository. Verify server-side 301 behavior, caching, sitemap and canonical URLs on that final host. Submit the new sitemap and monitor old URLs in Search Console when access is available.

The default canonical origin is the requested production domain. To reuse the project on another canonical origin, set `SITE_ORIGIN` and rebuild. No fake absolute origins or guessed DNS changes are applied.
