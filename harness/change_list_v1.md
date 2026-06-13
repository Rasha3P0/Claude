# Adjudication v1 → DECISION: ITERATE (build artifact_v2)

Adjudicator (Opus). Sceptical of artefact AND reviewers. 19 findings across 3
reviews. ACCEPTED issues include Critical + several Major, so we ITERATE.

## Rulings (all 19)
| # | Remit | Sev (claimed) | Ruling | One-line reason |
|---|-------|---------------|--------|-----------------|
| A1 | correctness | Critical | **REJECT** | False: `files.list` IS allowed under `drive.file` and returns app-created files, so re-link works; no orphan-per-install. |
| A2 | correctness | Critical | **ACCEPT (Major)** | Real fragility: fileId resolution depends on async React state. Cache fileId in module closure. (Also moots A1.) |
| A3 | correctness | Critical | **ACCEPT (Critical)** | Real data loss: a failed `alt=media` read is treated as empty, so the PATCH overwrites the whole file. Must abort on read failure. |
| A4 | correctness | Major | **ACCEPT (Major, scoped)** | Real: rotation-while-closed leaves a stale server endpoint. Heal on next app open by syncing the LIVE subscription. (Full closed-app SW re-register DEFERRED.) |
| A5 | correctness | Major | **ACCEPT** | Real: no lock in `runDue()` → tick + `/send` can double-deliver. Add a `running` guard. |
| A6 | correctness | Major | **ACCEPT** | Real: `PUSH_SUBSCRIPTION_CHANGED` uses a bare `store.set`, so React state goes stale. Use real `saveSettings`. (= C1.) |
| A7 | correctness | Major | **ACCEPT (Minor)** | Real but low-impact: server `sent{}` grows forever. Prune. (= B5.) |
| A8 | correctness | Minor | **REJECT** | False: Drive v3 query uses single quotes; current code is correct. |
| B1 | security | Critical | **ACCEPT (Major) DoS part; DEFER full auth** | Unauth `/subscribe`: add a subscription cap (cheap DoS fix). Full per-subscription ownership auth needs PWA token plumbing — DEFER (reference server). |
| B2 | security | Major | **ACCEPT** | `ALLOW_ORIGIN` default `*` opens all routes. Fail-closed if unset. |
| B3 | security | Major | **DEFER** | Unauth `/unsubscribe` needs the endpoint (not broadcast); same ownership-auth family as B1. Low real risk for a single-user self-host. Document. |
| B4 | security | Major | **ACCEPT** | `!==` on ADMIN_TOKEN is a timing oracle. Use `crypto.timingSafeEqual`. |
| B5 | security | Minor | **ACCEPT** | = A7. Prune `sent{}`. |
| B6 | security | Minor | **ACCEPT** | Strip transient integration fields from export (`drive.fileId`; drop `drive.email`). |
| B7 | security | Minor | **ACCEPT** | Verify `ev.source === navigator.serviceWorker.controller` before handling SW messages. |
| C1 | maint | Major | **ACCEPT** | = A6. |
| C2 | maint | Major | **ACCEPT** | Markdown codebox + Copy button duplicated across both Drive branches. Hoist shared parts. |
| C3 | maint | Major | **ACCEPT** | Four ad-hoc `setIntMsg` timeouts, uncancelled. Single cancelable `flashIntMsg`. |
| C4 | maint | Minor | **ACCEPT** | `scheduleBody` reaches for `loadMilestones()`/`todayStr()` as hidden globals. Pass milestones explicitly. |

## DEFERRED (real, out of scope for this iteration — see final_notes when CONVERGED)
- **B1-full / B3** — per-subscription ownership auth on `/subscribe` + `/unsubscribe`
  (server-issued token or keys-proof). Needs PWA-side plumbing; reference server is
  single-user self-hosted. Cap + fail-closed CORS land now; full auth documented.
- **A4-closed-app** — SW posting the rotated subscription directly to the server
  (needs SW-readable server config via Cache/IndexedDB). Page-open reconciliation
  (item 4) bounds the breakage to the documented "open weekly" freshness window.
- **W1 (from decision log)** — Drive append has no ETag/If-Match optimistic
  concurrency and the log grows unbounded. A3 fixes the data-loss; concurrency is
  low-risk for one user writing one alert at a time. Defer If-Match.
- **W2** — schedule freshness depends on the app being opened. Inherent without
  server-side fire-date computation. Documented.
- **W3** — none of the Google/Push paths are exercised against live endpoints in
  the sandbox (CDN blocked, no real OAuth client / push service). Syntax verified;
  runtime behaviour needs a real-environment smoke test before relying on it.

---

# CHANGE LIST for v2 (ordered must-fix; the resumed generator implements THIS only)

1. **[Critical · Drive data loss] `appendMarkdown` (index.html).** If the
   `alt=media` content read is not `ok`, ABORT: return `{ok:false, error:...}` and
   do NOT PATCH. Only a 200 response with an empty body is a genuine new/empty file
   (seed the header then). Never overwrite existing content with seed-only text.
2. **[Major · Drive robustness] fileId caching (index.html `googleDrive`).** Hold the
   resolved fileId in the module-level closure (next to `token`). `resolveFile`
   returns the cached id first; still persist to settings for cross-session reuse.
   Removes the dependency on an async React re-render between consecutive writes.
3. **[Major · Push state] `PUSH_SUBSCRIPTION_CHANGED` handler (index.html `App`).**
   Call the component's real `saveSettings` (stable `useCallback`), not a
   `store.set` lambda, so React state updates.
4. **[Major · Push healing] `webpush.subscribe` + `syncSchedule` (index.html).** Read
   the LIVE subscription from `(await navigator.serviceWorker.ready).pushManager
   .getSubscription()`, not the stale `push_subscription` localStorage value; update
   the stored value to the live one. Heals server drift on next open after rotation.
5. **[Major · Server dup] `runDue()` (push-server/server.js).** Guard with a
   module-level `running` boolean; if already running, return early.
6. **[Major · Server CORS] (push-server/server.js).** If `ALLOW_ORIGIN` is unset,
   log and `process.exit(1)` (mirror the VAPID key check). No `*` default.
7. **[Major · Server auth] `/send` token check (push-server/server.js).** Replace
   `auth !== ADMIN_TOKEN` with a constant-time compare (`crypto.timingSafeEqual`,
   length-guarded).
8. **[Major · Server DoS] `/subscribe` (push-server/server.js).** Enforce a
   `MAX_SUBSCRIPTIONS` cap (env, sensible default); reject new endpoints over the cap
   with 429. (Body is already 16KB-limited.)
9. **[Major · UI dup] AlertScreen drive mode (index.html).** Hoist the shared
   markdown codebox + Copy button above the `googleDrive.configured` branch; branch
   only on the action buttons (Write-to-Drive vs Open-Drive).
10. **[Major · UI timers] `SettingsTab` (index.html).** Replace the four ad-hoc
    `setTimeout(()=>setIntMsg(""))` calls with one `flashIntMsg(text)` backed by a
    `useRef` timer that clears the previous timeout before scheduling.
11. **[Minor · Server hygiene] `store.upsert` (push-server/server.js).** Prune each
    record's `sent{}` entries older than 30 days.
12. **[Minor · Privacy] export dump (index.html `buildExportDump`).** Exclude
    `drive.fileId`; drop `drive.email` from the settings shape entirely (never
    populated). Keep `drive.clientId` and push server config.
13. **[Minor · Hardening] SW message listener (index.html `App`).** Ignore messages
    whose `ev.source !== navigator.serviceWorker.controller`.
14. **[Minor · Clarity] `webpush.scheduleBody` (index.html).** Take `milestones` as an
    explicit argument; pass `loadMilestones()` from the callers.
