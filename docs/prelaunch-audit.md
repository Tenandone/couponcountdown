# Prelaunch connection and GA4 audit — 2026-09-19

## Repository and production

- Existing GitHub: https://github.com/Tenandone/couponcountdown
- Production branch: main, commit d4e6c9f977cd9f1e9f87ce79ed5cf17ba295a845.
- Authenticated GitHub Pages API: legacy build, source main at /, CNAME couponcountdown.com.
- Existing successful deployment: https://github.com/Tenandone/couponcountdown/actions/runs/26936047411 (pages build and deployment).
- Production HTTP response uses GitHub.com; live homepage matches the legacy HTML and GA ID.
- Initial redesign workspace had no Git remote. Commit 3dfa6b6c2e66b414467bde2ac2acd66b3ba3ae26 had been pushed to a separate Sites repository, not to this GitHub repository.
- Added origin pointing to the existing GitHub repository. Review branch: codex/recharge-ga4-review. A merge commit joins the independent redesign history and existing main history, preserving the redesign tree and selected legacy assets. No force push or history rewriting.
- The legacy CNAME, Naver verification file and four coupon datasets are retained. Original source remains accessible in Git history. Build now copies CNAME and the verification file into dist.
- Only the review branch is pushed. main, Pages configuration, DNS and the operating domain are unchanged. The workflow on this branch validates only; it has no deployment step or write permissions. The existing Pages root-based publishing setup needs a separately reviewed deployment plan for the generated dist output before any future merge/launch.

## Search scope and findings

Searched the working repository, captured legacy HTML, fetched origin/main tree and Git history for G-, GA_MEASUREMENT_ID, NEXT_PUBLIC_GA, NEXT_PUBLIC_GA_ID, GOOGLE_ANALYTICS, gtag, GoogleAnalytics, analytics and GTM-. Checked tracked and local environment files, relevant process environment names, deployment manifests and repository workflows.

Authenticated GitHub settings review: repository Actions variables 0, repository secret names 0; github-pages environment variables 0 and secret names 0. No legacy Vercel/Netlify/Cloudflare configuration or tracked .env file was found. Secret values were not read or logged. GA was hardcoded HTML, not an environment setting.

**G-1TS6F1NK5K** appears in the live homepage, data/legacy-home.html, origin/main:index.html and the legacy wos, kingshot, lastwar and tilessurvive index pages. Commit 5893d28ac1002fc6616165927099ec34491177e8 (Add GA4 to all pages, March 15 2026) records the original installation.

The redesign root commit emitted an empty data-ga and had no default measurement ID. This was a restoration omission during reconstruction, not a deletion committed to original main. The saved legacy HTML already contained the correct ID; the earlier claim that the ID was unavailable was incorrect. The ID is now restored as the build default, with all six requested event names added. User-supplied numeric account/property IDs are never used as measurement IDs. No new property was created.

## Validation

- Static generation: 1,921 pages, 238 products, 8 locales.
- npm test: 10 tests passed, including GA configuration, consent, event payloads, debounce, duplicate prevention, internal-card versus outbound distinction and middle-click behavior.
- Actual browser /__qa/: 11 checks passed, including all six requested events and five common parameters.
- Development test telemetry is intercepted and not sent into production GA.
- GA admin access: signed out. Existing-property stream mapping and remote DebugView/Realtime ingestion remain unverified; no claim of GA dashboard verification.
- Final pushed SHA and GitHub CI run are reported in the completion message (a commit cannot embed its own SHA).
