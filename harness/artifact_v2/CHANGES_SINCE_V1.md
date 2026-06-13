# What changed in v2 (applied from change_list_v1.md)

Focus review here — these are the deltas from the v1 artefact.

| # | Where | Change |
|---|-------|--------|
| 1 | `index.html` `googleDrive.appendMarkdown` | A failed `alt=media` read now ABORTS (`return {ok:false}`); only a 200-with-empty-body seeds the header. Fixes whole-file overwrite on a transient read failure. |
| 2 | `index.html` `googleDrive` | Resolved fileId cached in a module-level `fileId` var via `rememberId`; `resolveFile` prefers it. No longer depends on an async React re-render between writes. `disconnect` clears it. |
| 3 | `index.html` `App` SW message handler | `PUSH_SUBSCRIPTION_CHANGED` now calls the real `saveSettings` (stable useCallback), not a `store.set` lambda. |
| 4 | `index.html` `webpush.syncSchedule` | Reads the LIVE subscription (`pushManager.getSubscription()`), updates the stored copy, then posts schedule. Heals server drift after a push-service rotation on next open. |
| 5 | `push-server/server.js` `runDue` | Module-level `running` guard prevents the hourly tick + `/send` cron from double-delivering. |
| 6 | `push-server/server.js` config | `ALLOW_ORIGIN` is required; the server exits if unset (no `*` default). |
| 7 | `push-server/server.js` `/send` | Admin-token check uses `crypto.timingSafeEqual` (`safeEqual`). |
| 8 | `push-server/server.js` `/subscribe` | New endpoints rejected with 429 past `MAX_SUBSCRIPTIONS` (default 1000). |
| 9 | `index.html` `AlertScreen` drive mode | Shared markdown codebox + Copy button hoisted above the configured/unconfigured branch (no duplication); `driveConfigured` computed once. |
| 10 | `index.html` `SettingsTab` | Single cancelable `flashIntMsg` / `holdIntMsg` (useRef timer) replaces four ad-hoc `setTimeout`s; cleanup on unmount. |
| 11 | `push-server/server.js` `store.upsert` | `pruneSent` drops dedupe entries older than 30 days. |
| 12 | `index.html` | `drive.email` removed from the settings shape; `buildExportDump` strips `drive.fileId`. |
| 13 | `index.html` `App` SW message handler | Ignores messages where `ev.source !== navigator.serviceWorker.controller` (lenient on null source). |
| 14 | `index.html` `webpush.scheduleBody` | Takes `milestones` as an explicit arg; callers pass `loadMilestones()`. |

## Deliberately NOT changed (deferred by the adjudicator — do not re-raise unless newly broken)
- Per-subscription ownership auth on `/subscribe` + `/unsubscribe` (reference server;
  cap + fail-closed CORS landed; full auth documented as a known limitation).
- SW posting a rotated subscription directly to the server while the app is closed
  (page-open reconciliation via `syncSchedule` bounds the gap to the documented
  "open weekly" freshness window).
- Drive append has no ETag/If-Match optimistic concurrency (single-user sequential
  writes; the data-loss path is fixed by #1).
