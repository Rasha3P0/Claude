# FINAL NOTES — CONVERGED (loop 3 of 3)

Adjudicator (Opus). The adversarial harness ran to its 3-loop cap and converged:
no accepted Major/Critical issue remains open. The shipped artefact is the code in
`index.html`, `sw.js`, and `push-server/` (full diff: `harness/artifact_v3/implementation.diff`).

## What the loop produced
Two phase-2 boundaries for Ground Control, both OFF until configured (the app ships
unchanged by default):
- **(a) Direct Google Drive OAuth write-back** — Google Identity Services token
  model, public client id (no secret), narrow `drive.file` scope, access token in
  memory only, module-cached fileId, append via read-modify-write with a read-failure
  abort, copy/paste fallback retained.
- **(b) Background push via VAPID** — client subscribe/sync + a reference companion
  server (`push-server/`) that holds the private key and delivers on schedule, wired
  into the existing service worker.

## How the three loops moved the work
| Loop | Found / fixed |
|------|----------------|
| 1 | 19 findings (3 reviewers). **1 Critical**: a failed Drive read overwrote the whole log file. Majors: server CORS `*` default, timing-unsafe admin compare, no `runDue` lock (duplicate pushes), no subscription cap, push-rotation breaking silently, stale React state, fileId racing React re-renders, duplicated UI, magic timers. **Rejected 2** reviewer claims as factually wrong (`files.list` IS allowed under `drive.file`; Drive v3 query uses single quotes). |
| 2 | 11 findings (2 reviewers). New **Majors**: a double-click could append to Drive twice; the full trading **action text** was stored at-rest in plaintext on the server. Plus stale-settings/closure reads, timing length-oracle, SW source-guard gaps. Rejected the `store.remove`/`runDue` double-save fix (would break `/unsubscribe` durability). |
| 3 | Applied all accepted v2 fixes (in-flight write guard; drop `action` from the server — generic body, full detail in-app only; fresh-settings reads; hash-based constant-length token compare; `instanceof ServiceWorker` guard + listener cleanup; prune boundary; ADMIN_TOKEN startup warning; `/health` trimmed). Converged. |

Net: the harness caught a genuine data-loss Critical and a data-at-rest privacy
Major that the first draft shipped, and corrected two over-zealous reviewer claims.

## Verification done
- Syntax: `prettier --parser babel` on the extracted JSX block, `node --check` on
  `sw.js` and `push-server/server.js` — all clean at every iteration.
- NOT done: live-endpoint testing (see DEFERRED W1).

## DEFERRED — real, out of scope for these three loops (productionization backlog)
- **W1 · Live validation gap (highest residual risk).** The GIS token callbacks, the
  Drive REST sequence, and `web-push` delivery have never run against real Google /
  push endpoints — the sandbox blocks the GIS/React CDNs and there is no real OAuth
  client or push service. Everything is to documented contracts and is syntax-clean,
  but a real-environment smoke test is required before relying on either feature:
  create a Google OAuth Web client (authorised JS origin = the PWA origin), connect
  Drive, confirm an alert writes; deploy `push-server/` with generated VAPID keys,
  enable push, confirm a due milestone delivers when the app is closed.
- **Reference-server auth.** `/subscribe` and `/unsubscribe` are unauthenticated by
  design (browsers self-register). A `MAX_SUBSCRIPTIONS` cap, 16KB body limit, and
  fail-closed CORS blunt DoS, but a party who learns a subscription's endpoint URL can
  overwrite its schedule or delete it. For public/multi-tenant use add per-subscription
  ownership proof (server-issued token from `/subscribe`, required on `/unsubscribe`)
  and edge rate limiting.
- **Closed-app subscription rotation.** If the push service rotates a subscription
  while the app is fully closed, the SW re-subscribes but the server's record only
  heals on the next app open (`syncSchedule` reads the live subscription). Bounded to
  the documented "open weekly" freshness window; full closed-app re-register needs
  SW-readable server config (Cache/IndexedDB).
- **Drive append concurrency / growth.** No ETag/If-Match optimistic concurrency, and
  the log grows unbounded. The data-loss path is fixed (read-failure abort); concurrent
  overlapping writes are prevented in the UI (one modal, in-flight guard). Low risk for
  one user; revisit if multi-device concurrent writes become real.
- **Residual server-stored data.** Each milestone's `name`/`project`/`fire` is stored
  server-side (needed for a useful notification + scheduling). The sensitive `action`
  detail is not. Accepted minimum.

## To resume / extend
The feature is implemented and self-validated to the limit of a no-network sandbox.
The single most valuable next action is the **W1 live smoke test**. After that, the
reference-server auth hardening is the next item if the push server is ever exposed
beyond a single self-hosted user.
