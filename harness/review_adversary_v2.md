# Adversarial Security Review — Ground Control v2 (RED-TEAM, iteration 2)

Reviewer remit: security only. Files reviewed: OVERVIEW.md, CHANGES_SINCE_V1.md,
implementation.diff, /home/user/Claude/push-server/server.js, /home/user/Claude/sw.js,
/home/user/Claude/index.html.

---

## Verification of claimed fixes (#6–#8, #12–#13)

### #6 — Fail-closed CORS
**EFFECTIVE.**
`ALLOW_ORIGIN` is now a required env var; the server calls `process.exit(1)` if it
is absent. The `send()` helper unconditionally emits `Access-Control-Allow-Origin:
ALLOW_ORIGIN` on every response including errors and OPTIONS. No wildcard default
exists in code.

Residual note (not a regression — pre-existing): preflight responses (OPTIONS)
never carry a `Vary: Origin` header. This is irrelevant for a single-origin
deployment but would matter if ALLOW_ORIGIN is ever changed at runtime. Not scored
as a new defect.

### #7 — Constant-time admin-token compare
**PARTIALLY EFFECTIVE — a length-leak remains.**

```js
function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);     // (A)
}
```

`timingSafeEqual` itself is correct for byte-level comparison, but line (A) short-
circuits with a boolean `false` (fast path) when `ba.length !== bb.length`. An
attacker who can measure response latency can therefore distinguish "wrong length"
from "right length, wrong bytes" — that is, they can binary-search the token
length before exploiting the timing side-channel on the content. The standard
remedy is to pad both buffers to the same length before the `timingSafeEqual` call
(or to always call it and then also check the lengths). The fix leaves the length
oracle in place.

Additionally: `ADMIN_TOKEN` defaults to `""` (empty string). If the operator
deploys without setting this env var, line (A) evaluates `!ADMIN_TOKEN` → `!""` →
`true` → returns `false` unconditionally, so `/send` returns 401 for every request.
That is fail-closed for the admin endpoint, but it means the built-in hourly
`runDue()` tick delivers silently while the cron/operator path is bricked.

Severity: **Minor** (length leak; token content remains protected by timing-safe
bytes once length is correct; practical exploitability is low).

### #8 — Subscription cap
**EFFECTIVE for its stated purpose, but the check is logically bypassed by updates.**

```js
const isNew = !store.data[body.subscription.endpoint];
if (isNew && Object.keys(store.data).length >= MAX_SUBSCRIPTIONS) return send(res, 429, ...);
store.upsert(body.subscription, body.milestones);
```

The cap correctly prevents net-new endpoints from being added beyond MAX_SUBSCRIPTIONS.
However, an existing subscriber can re-POST with an arbitrarily large `milestones`
array; `store.upsert` replaces the existing record's milestone list without any
cap on milestone count or item size within the 16 KB body limit. 16 KB worth of
milestone JSON per subscription × 1 000 subscriptions = up to 16 MB in the store
file per flush. Not a bypass of the count cap, but an orthogonal data-size vector.
Given this is a reference server with a documented "swap for a real DB" caveat, I
score this **Minor**.

Also: the cap check reads `Object.keys(store.data).length` from the live in-memory
object. If the store file is replaced externally (or on a serverless platform with
ephemeral memory) the cap counter resets to 0 on restart, allowing unlimited re-
registration until it reaches MAX_SUBSCRIPTIONS again. Not a regression from v2.

### #12 — Export strips drive.fileId
**EFFECTIVE.**

```js
const safeSettings = s ? { ...s, drive: s.drive ? { ...s.drive, fileId: "" } : s.drive } : s;
```

`drive.fileId` is zeroed before export. `drive.email` was removed from the settings
shape entirely (not in DEFAULT_DRIVE). The exported JSON carries the OAuth client
id (public by design) and file name (harmless), but not the file pointer.

### #13 — SW-message source check
**PARTIALLY EFFECTIVE — contains a logic flaw that opens a bypass window.**

```js
if (ev.source && navigator.serviceWorker.controller && ev.source !== navigator.serviceWorker.controller) return;
```

The condition reads: "if source is truthy AND controller is truthy AND source ≠
controller, reject". The implicit contrapositive passes messages when **either**:

1. `ev.source` is `null` / falsy — e.g. messages posted by `BroadcastChannel`,
   `MessageChannel`, or a SW that was unregistered between the post and the handler
   firing; OR
2. `navigator.serviceWorker.controller` is `null` — which is the normal state
   during the `installing` / `waiting` phase, or just after a hard reload in
   Chrome (controller is `null` until the first controlled navigation completes).

Case 2 is exploitable: if an attacker can cause the page to reload while the SW is
in `waiting` state (or convince the user to do a Shift-Reload, which clears the
controller), then `navigator.serviceWorker.controller` is `null`, so the guard
short-circuits and ANY `message` event source — including a cross-origin iframe or
a malicious shared worker — can trigger `PUSH_SUBSCRIPTION_CHANGED`, which causes
the app to call `webpush.subscribe(s, saveSettings)` with whatever settings are
currently in localStorage. In practice this re-subscribes to the push server, which
is annoying but not directly exploitable beyond phishing-grade noise (no settings
are modified by the handler itself).

Case 1 (null source): BroadcastChannel and MessageChannel messages arrive on
`window` with `ev.source === null`, so the guard does not filter them. Any script
on the page (or a 3rd-party CDN script if CSP is absent) can post:

```js
const bc = new BroadcastChannel("anything");
// ...no, BroadcastChannel fires on BroadcastChannel, not navigator.serviceWorker
```

Corrected: `navigator.serviceWorker.addEventListener` only fires for messages whose
source is a ServiceWorker, so `ev.source` being null in that context is uncommon
and would require deliberate message posting via `postMessage` from a SW context.
The actual threat surface for case 1 is narrower than a general `window.onmessage`
listener. However the controller-null bypass (case 2) remains a real window.

Severity for the controller-null bypass: **Minor** (consequence is unwanted re-
subscribe, not credential exfiltration or arbitrary code execution).

---

## New defects introduced or uncovered in v2

### FINDING 1 — CORS headers emitted on unauthenticated VAPID-key disclosure via /health (Major → Minor in context, scored Minor)
**LOCATION:** push-server/server.js line 147  
**SEVERITY:** Minor  
**DEFECT:** `GET /health` returns `publicKey: PUBLIC_KEY` in the JSON body. The
VAPID public key is public by design and must be distributed to clients; this is
intentional and documented. However `/health` requires no authentication and emits
the CORS header `Access-Control-Allow-Origin: ALLOW_ORIGIN`. An operator who
mistakenly sets `ALLOW_ORIGIN` to a wildcard via a reverse-proxy header would
expose the health route cross-origin. This is not a v2 regression; it is a
documentation gap. Scored Minor because the public key is designed to be shared.

### FINDING 2 — ADMIN_TOKEN empty-string default silently disables the manual /send path (Major)
**LOCATION:** push-server/server.js lines 34, 168  
**SEVERITY:** Major  
**DEFECT:** `ADMIN_TOKEN` defaults to `""`. The `safeEqual` guard handles this
correctly (returns false → 401), but there is no startup check analogous to the
VAPID key check. A misconfigured deployment starts without error, the admin `/send`
route is permanently locked out (returns 401 for every request including valid
Bearer tokens that happen to be empty), and the operator has no signal that the
cron integration is broken. The built-in hourly tick still fires (it does not go
through the auth check), so push delivery continues — but any external cron job
silently fails. An operator may believe the cron is working when it isn't.

More critically, if an operator intends to rely on the cron and disables the hourly
tick (e.g., in a serverless deployment), a missing `ADMIN_TOKEN` means push stops
entirely with no error log.

**Attack scenario:** not attacker-driven; this is a misconfiguration hazard. But
on a serverless deployment it causes silent loss of push delivery.

**Fix:** add a startup check identical to the VAPID key check:
```js
if (!ADMIN_TOKEN) {
  console.error("Missing ADMIN_TOKEN. POST /send will always return 401 (built-in tick still runs).");
  // optionally: process.exit(1) to force explicit opt-out
}
```

### FINDING 3 — Milestone schedule sent to push server includes full action text (up to 140 chars of trading instruction) — confidentiality risk (Major)
**LOCATION:** index.html `webpush.scheduleBody` (~line 1044–1052); push-server/server.js `runDue` line 123  
**SEVERITY:** Major  
**DEFECT:** Every time the client syncs (on every app open, and on subscribe), it
sends the full milestone schedule to the push server, including:
- `name` (milestone name)
- `project` (project name)
- `action` — up to 140 characters of trading instruction text (e.g., "Buy 1 share
  SMGB at market price on Freetrade. No limit order…")
- `fire` date

The server stores this verbatim in `subs.json` and re-sends `action` text in the
push payload. This means the companion server — which is documented as something
the operator "deploys" to a third-party host (Render, Fly, Railway) — receives
and stores specific, time-sensitive trading instructions in plaintext.

The OVERVIEW.md states: "Stored data is a push subscription… plus the milestone
schedule — no Ground Control health/portfolio data." This understates the
sensitivity: the `action` field contains literal trading orders.

If the store file leaks (world-readable subs.json, a misconfigured cloud object
store, a compromised host), an attacker learns the user's exact trading schedule
and instructions before execution.

**This is not mitigated by Web Push E2E encryption** — the payload is encrypted
in transit to the push service, but the server stores the plaintext milestone
schedule at rest.

**Fix options:**
1. Strip `action` from what is stored on the server; have the push payload contain
   only `id` + `fire`, and let the SW retrieve the action text from localStorage
   on push receipt (requires the app to be open, which defeats the purpose).
2. More practical: strip or abbreviate `action` to a minimal hint ("Trading alert
   due") in `scheduleBody` so the server never sees the trading instruction.
3. Document the confidentiality risk explicitly so operators understand what the
   server stores.

### FINDING 4 — Drive OAuth client id persisted in localStorage and included in export JSON (Minor)
**LOCATION:** index.html `buildExportDump` / `DEFAULT_DRIVE` / `saveSettings`  
**SEVERITY:** Minor  
**DEFECT:** `drive.clientId` is stored in `gc_settings` (localStorage) and is
included in the export dump without stripping. The client id is described as
"public" and it is — Google OAuth client ids are not secrets. However:

1. The client id is scoped to a specific origin (set in the Google Cloud Console).
   Exporting it in a JSON backup that a user might share exposes which Google
   Cloud project backs this deployment.
2. An attacker who obtains a backup can attempt to perform OAuth flows against the
   same client id from the authorised origin. This is not a security issue per se
   (the origin restriction and user consent still apply) but is unnecessary surface.

The fix applied in #12 correctly strips `fileId` but not `clientId`. Whether to
strip `clientId` from exports is a design call; I flag it as Minor.

### FINDING 5 — SW message handler registers on every render inside a useEffect with empty deps — listener stacks on hot reload / SW update (Minor)
**LOCATION:** index.html, `App` component, `useEffect(()=>{ navigator.serviceWorker.addEventListener("message", ...) }, [])`  
**SEVERITY:** Minor  
**DEFECT:** The `useEffect` with `[]` deps registers a `message` listener on
`navigator.serviceWorker` on mount and — critically — does **not** return a cleanup
function that removes it. In development (React Strict Mode double-invoke) and in
any scenario where the `App` component unmounts and remounts (which is unlikely in
a SPA but possible), listener copies accumulate. More practically: if the SW is
updated and `skipWaiting()` is called, the page reloads, which is fine. But the
`PUSH_SUBSCRIPTION_CHANGED` handler within the listener captures the `saveSettings`
callback from the closure at registration time. If `saveSettings` stale-closes over
old state, the subscription re-register would use stale settings.

In practice `saveSettings` is a `useCallback` with `[]` deps (line 1460), so it is
stable. The listener accumulation risk is real in development/Strict Mode but low
in production single-page use.

**Fix:** return a cleanup from the `useEffect`:
```js
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(()=>{});
  const handler = (ev) => { ... };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}, []);
```

### FINDING 6 — readJson body size check uses character count, not byte count, for UTF-8 bodies (Minor)
**LOCATION:** push-server/server.js lines 91–96  
**SEVERITY:** Minor  
**DEFECT:**
```js
let body = "", size = 0;
req.on("data", (c) => {
  size += c.length;   // Buffer.length = byte count ✓ for Buffer chunks
  if (size > limit) { reject(...); req.destroy(); }
  else body += c;
});
```

When `c` is a `Buffer` (as it normally is from Node's HTTP layer), `c.length` is
byte count, so the 16 KB cap is enforced in bytes correctly. However, `body += c`
coerces `c` to a UTF-8 string via `.toString()`. This is fine for JSON (ASCII
subset), but if `Content-Type` were something else, the string could expand.
More importantly: the `size` counter is accumulated before the `limit` check on
each chunk, but if a single chunk is > 16 KB (unlikely with default TCP MSS, but
possible with a large loopback request), the reject fires but `body` has already
been appended for all previous chunks. The final `JSON.parse(body)` after `end`
would then fail or parse a truncated document — but the `reject(new Error(...))` is
called first so the promise rejects before `end` fires. This is correct; scoring as
Minor for the theoretical edge case.

---

## Summary table

| # | Location | Severity | Finding |
|---|----------|----------|---------|
| F1 | server.js L147 | Minor | /health exposes public VAPID key without auth (by design, but undocumented reverse-proxy risk) |
| F2 | server.js L34, L168 | Major | ADMIN_TOKEN empty-string default causes silent cron failure; no startup check |
| F3 | index.html scheduleBody / server.js runDue | Major | Full trading action text stored at-rest on companion server; confidentiality risk |
| F4 | index.html buildExportDump | Minor | drive.clientId included in exported backup (public but unnecessary) |
| F5 | index.html App useEffect | Minor | SW message listener not removed on unmount; listener stacking in Strict Mode |
| F6 | server.js readJson | Minor | Body size counter correct in practice but fragile across chunk boundaries |

---

## Fix verification verdict

| Fix | Verdict |
|-----|---------|
| #6 CORS fail-closed | Effective |
| #7 Constant-time admin compare | Partially effective — length oracle remains |
| #8 Subscription cap | Effective for count; milestone-payload size per subscription is uncapped |
| #12 Export strips drive.fileId | Effective |
| #13 SW message source check | Partially effective — controller-null bypass window remains |
