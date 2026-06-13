# Decision log — v1 (ADJUDICATOR ONLY; reviewers must not see this)

## Non-obvious assumptions / committed decisions
1. **Drive auth = GIS token model, public client id, NO secret, NO refresh token.**
   A static site can't keep a secret. Access token lives in a module variable
   (memory only), re-requested on expiry; one interactive retry on 401. Chose this
   over a PKCE auth-code flow specifically to avoid persisting any long-lived
   credential in a static client.
2. **Scope = `drive.file`, not `drive`.** Narrowest scope that works; blast radius
   of a leaked token is one app-owned file. Deliberate security-over-convenience call.
3. **Write target is the app's OWN file** (`ground_control_portfolio_log.md`,
   tagged via `appProperties`), created/owned by the app — NOT the user's
   pre-existing "portfolio_dashboard" doc. `drive.file` cannot see files the app
   didn't create, so appending to a user's existing arbitrary doc is impossible
   without a Google Picker grant. Accepted the gap to keep the narrow scope.
4. **Background push requires the companion server; the static PWA cannot do it.**
   Implemented the client (subscribe + hand schedule to server) and a reference
   server (`push-server/`) holding the VAPID private key. Server stores subs in a
   JSON file and delivers on an hourly tick or `POST /send` cron.
5. **Schedule sync model:** the PWA posts `{subscription, milestones[]}` on
   subscribe and re-posts on every open (`syncSchedule`). The server does not
   recompute fire dates itself — it trusts the client's `fire` values.
6. **Both integrations ship OFF.** Inert with no credentials; migration adds
   `drive`/`push` settings non-destructively. Zero behaviour change by default.
7. **File create is two-step** (metadata-only POST, then media write) rather than a
   multipart upload — a self-review caught that a `FormData` body sends
   `multipart/form-data`, which Drive's `uploadType=multipart` rejects (it wants
   `multipart/related`). Fixed before snapshot.

## 2–3 weakest / most-likely-wrong points (honest)
- **W1 — Drive append is read-modify-write with no concurrency control.** Each
  write re-downloads the whole file, appends, re-uploads the whole file. No
  ETag/If-Match, so two overlapping writes could lose one. Mitigated in practice
  (single phone user, one modal alert at a time) but it's a real correctness
  limit, and the file grows unbounded over years. I think this is acceptable for
  the MVP but a reviewer is right to flag it.
- **W2 — "Works when closed" is only as fresh as the last app open.** If a
  milestone's `fire` date changes (e.g. snooze, advance) and the user never opens
  the app again, the server keeps the stale schedule and could fire late/wrong or
  miss the change. The whole value prop is closed-app delivery, yet the schedule
  depends on the app being opened to refresh — a partial contradiction I could not
  fully resolve without moving fire-date computation server-side (out of scope).
- **W3 — None of the Google/Push paths are exercised against live endpoints.** The
  sandbox blocks the GIS CDN and there's no real OAuth client or push service, so
  the Drive REST sequence, GIS token callbacks (`prompt:""` silent behaviour,
  `error_callback`), and `web-push` send are written to documented contracts but
  unverified at runtime. Syntax is checked; behaviour is not.

## Lower-confidence specifics a reviewer may legitimately challenge
- Built-in hourly tick means a push could arrive at an off-hour; production should
  drive `POST /send` from a cron at ~09:00 local. Documented, not enforced.
- `push-server` store is a local JSON file — wrong for serverless (ephemeral FS);
  README says swap for KV, but the default could mislead.
- `/subscribe` is unauthenticated (browsers must self-register); no rate limit by
  default — README flags it, code doesn't enforce.
- Token is held only in a module variable, so a full page reload forces a re-auth
  (usually silent). Acceptable, but not stated to the user.
