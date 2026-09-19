# Production launch — 2026-09-19

The existing GitHub Pages configuration remains legacy publishing from main at /. CNAME remains couponcountdown.com; no DNS or Pages configuration change is required. The generated site is copied to the repository root by npm run prepare:pages, with .nojekyll. Future source updates must run npm run build, npm run lint, npm test and npm run prepare:pages before committing. Source/build directories are disallowed in robots.txt; public locale canonicals remain https://couponcountdown.com.

Branding: original legacy favicon.ico and img/couponcountdown-logo.png from old main are replaced/removed in the redesigned tree. New coin/lightning artwork is owned by this site, does not copy TikTok/LootBar marks, and is provided as versioned SVG, 16/32 PNG, multi-resolution ICO, 180px Apple touch icon, 192/512px manifest icons, and a 1200x630 OG image. Header/footer share the same symbol. Standard root icon paths remain for older clients; head references use v3 paths or queries to avoid stale cached icons. Historical capture files and Git history are evidence, not active site branding.

Legacy paths /wos, /kingshot, /lastwar, /tilessurvive and their slash/index.html/pages/*.html variants are preserved. GitHub Pages cannot apply arbitrary HTTP 301 rules without changing hosting: slashless directories get its native slash redirect, then generated meta-refresh/location.replace pages send visitors to the correct game page with a destination canonical. These are client redirects, not HTTP 301 migration rules. _redirects is retained for other compatible hosts but is not interpreted by Pages.

Maintenance remains active for Kingshot and Whiteout Survival across eight locales. Referral URLs remain stored, search/details remain available, CTAs are disabled, recommendations omit both games, and only those two move to the catalog end.

Prelaunch checks: build, ESLint, 15 automated tests, 11 browser integration checks; 320/375/390/430px viewport inspections. Exact TikTok URL checked across 16 static CTA instances. Local links/assets checked across 2,167 unique destinations. GA4 uses G-1TS6F1NK5K with the six requested events and parameters; test traffic is intercepted. GA Admin/DebugView actual receipt remains unverified when signed out.

Full LootBar HTTP and browser destination records are in data/launch-link-verification.json after final verification. This verifies accessible product destinations and attribution, not successful payment/fulfillment. The maintenance policy is intentionally not lifted by an HTTP 200 response.
