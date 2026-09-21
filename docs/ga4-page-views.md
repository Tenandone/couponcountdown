# GA4 page views deployment runbook

Status: real GA4 connection verified on 2026-09-21. GitHub manual verification run 35576469334 succeeded. Existing project turing-nature-473308-t4; dedicated service account has GA4 Viewer with cost/revenue restrictions and no Cloud IAM roles. Secret registered; downloaded key removed after encrypted transfer.

## One-time account setup

1. Enable Google Analytics Data API and Google Analytics Admin API in the service account's Google Cloud project.
2. Grant the service account email **Viewer** on existing GA4 Property **528476729**, whose stream must contain **G-1TS6F1NK5K**. Do not create a new GA property.
3. Save the service account JSON directly in repository Actions Secret **GA4_SERVICE_ACCOUNT_JSON**. Never send its value in chat or commit it.
4. Leave repository variable **GA4_STATS_ENABLED** unset until a manual real-data collection succeeds.

## Meaning and timezone

The Data API eventCount metric is filtered to eventName=page_view and hostName in couponcountdown.com / www.couponcountdown.com. This includes hub, games, Markets, archives and locale pages, excluding previews. It does not estimate unconsented or blocked traffic. Total begins at the property's creation date; GA processing, historical availability and corrections affect totals. Today is the current KST calendar day, not a realtime API guarantee.

The collector first reads the property timezone and validates the Measurement ID. It requires Asia/Seoul and verifies report metadata. If timezone differs it fails without replacing data: property-day aggregates cannot reliably be converted to KST after aggregation. Do not silently change the GA property timezone; resolve the reporting basis with the owner before activation. Actual Admin API and report metadata both confirm Asia/Seoul.

Public JSON fields: totalPageViews (integer), todayPageViews (integer), updatedAt (ISO8601 +09:00), reportingDate (KST YYYY-MM-DD), source=GA4, metric=page_view, propertyTimeZone, totalStartDate, staleAfterHours=3. No raw events, identifiers or credentials are published.

## Release sequence

GitHub requires a workflow_dispatch workflow to be registered on the default branch. Once credentials are ready, register the manual-only/disabled-by-variable workflow and collector on main first (without exposing the counter). Run **Update GA4 page views** manually and inspect its real stats.json and success. Only after that succeeds merge the counter/build changes, run build/test and prepare:pages, push normally, verify the Pages SHA and production pages. Finally set GA4_STATS_ENABLED=true and verify a scheduled run. Manual verification registration was performed at 82cf1a4d98813ebc37c4626469b67f46e1632f65 without changing production HTML.

Cron `0 * * * *` is UTC hourly, corresponding to every KST hour at :00. GitHub schedules can be delayed. Each run requests an OAuth token, two Admin resources and one batch containing two Data reports. No npm install, static generator or site build runs hourly. The existing legacy Pages main/root delivery still republishes the static files after only data/stats.json changes. CNAME, DNS and Pages source remain untouched.

## Failure behavior

API/auth/schema/timezone errors leave the existing file byte-for-byte unchanged and fail the workflow before publish. A suspicious all-time zero after a positive total is rejected. Genuine zero today is valid. Git push conflicts fail without force push. Frontend fetch is nonblocking, credential-free, hourly-cache-keyed and time-limited. Missing, invalid, older-than-three-hours or prior-KST-day data is hidden in reserved space. No manufactured zero appears. GA tracking is unchanged and does not depend on the counter fetch.

## Verification

31 automated tests passed, including API response mocks, production event filters, KST midnight, preserved fallback file, 8 locales, K/M formatting, and one GA config per full page navigation. Mock values exist only in test fixtures; they are not production stats. Real API and workflow_dispatch succeeded: 656 total / 7 today at 2026-09-21T17:10:07+09:00. Scheduled execution and GA DebugView receipt require separate verification.

Official references: https://developers.google.com/analytics/devguides/reporting/data/v1/basics and https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties

Browser integration: 15 checks passed, including all 8 locales at 320/375/390/430px and counter height before/after load. The initial es-419 320px height shift was fixed and the complete browser suite rerun successfully.

## Growth Count display (2026-09-21)
The GA4 query is unchanged. totalPageViews remains the actual aggregate for compatibility; actualPageViews mirrors it. After each successful collection, displayGrowthCount is computed as actualPageViews * 1000 with a safe-integer guard. Public labels distinguish Growth Count from today's actual page views in all eight locales. Numbers use locale-specific thousands separators. Failed collection preserves the whole prior JSON, including the derived value.
