# Adversarial Security Review — Ground Control Phase 2 (Drive OAuth + VAPID Push)

Reviewer role: RED-TEAM. Remit: security defects only. Finding nothing without certification is a failed review.

---

## ISSUE 1 — Unauthenticated /subscribe: any internet client can inject or overwrite any subscriber's milestone schedule

**LOCATION:** `push-server/server.js` lines 123–127 (`POST /subscribe` handler); `store.upsert` lines 52–57

**SEVERITY: Critical**

**DEFECT:** `POST /subscribe` accepts `{ subscription, milestones[] }` from any caller with zero authentication, zero ownership proof, and no subscription cap. The store is keyed by `subscription.endpoint`, which is fully attacker-supplied and only regex-checked for `^https://`. Three distinct attacks follow:

1. **Schedule poisoning**: an attacker who knows or intercepts a victim's push endpoint URL (not a secret — visible in browser devtools, network proxies, and in the `push_subscription` localStorage key) can POST that endpoint with an attacker-controlled `milestones[]` array, overwriting the victim's schedule. The server will then deliver attacker-authored push notifications at attacker-chosen times.

2. **Open relay**: an attacker registers their own valid browser subscription with any milestones they choose. The server becomes a free push relay: no association between "the account" and "the stored schedule" is ever checked.

3. **Store bloat / DoS**: with no subscription cap and no rate limiting, an attacker can register millions of subscriptions. Each `upsert` calls `store.save()`, which performs a synchronous `fs.writeFileSync` (line 50) on the entire in-memory object, stalling the Node.js event loop until the write completes. Tens of thousands of concurrent POSTs cause cascading event-loop blockage and effective denial of service.

The README acknowledges the issue in a "harden for production" note but the shipped code has no mitigation at all.

**EVIDENCE/FIX:**

Attack: `curl -X POST https://push-server/subscribe -H 'Content-Type: application/json' -d '{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/VICTIM_TOKEN","keys":{"p256dh":"<base64>","auth":"<base64>"}},"milestones":[{"id":"x","name":"SELL EVERYTHING","project":"p","action":"SELL NOW","fire":"2024-01-01"}]}'`

Fix: (a) generate a random server-issued subscribe-token on first registration and require it on subsequent updates to that endpoint; OR (b) add an `ADMIN_TOKEN`-equivalent shared secret that the PWA includes in the `Authorization` header (acceptable because the server URL is already user-configured); AND (c) add a `MAX_SUBSCRIPTIONS` cap and per-IP rate limiting before `upsert`.

---

## ISSUE 2 — CORS defaults to `"*"`: all routes open to cross-origin browser requests

**LOCATION:** `push-server/server.js` line 34; `send()` function lines 79–87

```js
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";
```

**SEVERITY: Major**

**DEFECT:** If `ALLOW_ORIGIN` is not configured (unset env var, quick-start deployment), every HTTP response carries `Access-Control-Allow-Origin: *`. Any web page on the internet can then make cross-origin `fetch` calls to the push server from a victim's browser. This enables:

- **Cross-origin subscription hijack**: a malicious ad or compromised third-party script running in the victim's browser can call `POST /subscribe` or `POST /unsubscribe` directly.
- **Health enumeration**: `GET /health` returns the current subscription count and VAPID public key to any origin.

Note that `credentials: "include"` is blocked by the wildcard, but these routes are not cookie-protected — they require only JSON bodies, which are freely writable cross-origin.

**EVIDENCE/FIX:**

Fix: fail-closed — require `ALLOW_ORIGIN` to be set or refuse to start, matching the existing VAPID key check at line 37:

```js
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN;
if (!ALLOW_ORIGIN) {
  console.error("ALLOW_ORIGIN must be set to your PWA origin (e.g. https://my-app.example). Refusing to start.");
  process.exit(1);
}
```

---

## ISSUE 3 — Unauthenticated /unsubscribe: any party knowing the endpoint URL can silently delete any victim's subscription

**LOCATION:** `push-server/server.js` lines 130–134 (`POST /unsubscribe` handler)

**SEVERITY: Major**

**DEFECT:** `POST /unsubscribe` accepts `{ endpoint: <string> }` and calls `store.remove(endpoint)` with no ownership proof. Push endpoint URLs are not secrets — they appear in browser devtools, network logs, and the `push_subscription` localStorage key (readable by any XSS). An attacker who obtains any victim's endpoint URL can permanently delete their push subscription from the server, silently disabling all trading alerts with no indication in the PWA UI.

Unlike the browser-side `PushSubscription.unsubscribe()` (which requires browser-level access), this server-side deletion requires only the endpoint string, obtainable via any of the paths above.

**EVIDENCE/FIX:**

Fix: require proof of subscription ownership before deletion. Simplest: return a random `deleteToken` from `/subscribe`, store it server-side, and require it on `/unsubscribe`. Alternatively, accept deletion only if the caller presents the correct `keys` object (p256dh + auth) alongside the endpoint — a passive network observer cannot recover these since they are only ever sent client-to-server over TLS, not derivable from the endpoint URL alone.

---

## ISSUE 4 — Timing oracle on ADMIN_TOKEN: `!==` comparison leaks token content via response latency

**LOCATION:** `push-server/server.js` line 139

```js
if (!ADMIN_TOKEN || auth !== ADMIN_TOKEN) return send(res, 401, { error: "unauthorized" });
```

**SEVERITY: Major**

**DEFECT:** JavaScript's `!==` string comparison short-circuits on the first differing byte, exposing a character-by-character timing side-channel. On a low-latency link (same datacenter, localhost, or a high-bandwidth adversary with many samples) the ADMIN_TOKEN can be recovered incrementally. Compromising `ADMIN_TOKEN` gives the attacker unlimited on-demand delivery of all stored push notifications via `POST /send`, and when combined with Issue 1 (attacker-injected milestones), allows delivery of arbitrary notification text to all subscribers.

**EVIDENCE/FIX:**

Fix:

```js
const crypto = require("crypto");

function safeCompare(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false; // length itself is non-secret (token is fixed at deploy)
  return crypto.timingSafeEqual(ba, bb);
}

// in /send:
if (!ADMIN_TOKEN || !safeCompare(auth, ADMIN_TOKEN)) return send(res, 401, { error: "unauthorized" });
```

---

## ISSUE 5 — `sent{}` deduplication map grows unboundedly: persistent memory and disk amplification

**LOCATION:** `push-server/server.js` `store.upsert` (lines 52–57); `runDue` (lines 97–102)

**SEVERITY: Minor** (Major when combined with Issue 1)

**DEFECT:** The `sent` map within each subscription record (`{ "id@fire": "YYYY-MM-DD", ... }`) is never pruned. Every delivered milestone adds a permanent entry. For a legitimate long-term user this grows slowly; for an attacker who exploits Issue 1 to inject a subscription with thousands of synthetic past-due milestones, the `sent` map bloats immediately. Because `store.save()` serialises the entire in-memory object on every write, a large `sent` map causes write amplification proportional to total history size across all records.

**EVIDENCE/FIX:**

Fix: prune entries older than N days (e.g., 30) during `upsert` or at the start of `runDue`:

```js
function pruneSent(sent, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(sent)) {
    if (sent[k] < cutoff) delete sent[k];
  }
}
```

Call `pruneSent(prev.sent)` inside `upsert` before storing.

---

## ISSUE 6 — Drive integration metadata (fileId, email) included in plaintext user backup export

**LOCATION:** `index.html` — `gc_settings.drive` shape (diff lines 547–552); export-all function in `SettingsTab`

**SEVERITY: Minor**

**DEFECT:** `gc_settings.drive` persists `clientId`, `fileId`, and `email`. The app's existing backup-export feature serialises all of `gc_settings` to a downloadable JSON blob. Users who post or share their backup (a common "help me debug" action) inadvertently expose:

- `drive.fileId`: the exact Drive file ID for their portfolio log — an attacker with a separately-obtained OAuth token for the same account can directly target this file.
- `drive.email`: the user's Google account address — PII, unnecessary to persist (it is display-only).
- `push.endpoint`: the full push subscription URL — see Issue 3.

**EVIDENCE/FIX:**

Fix: exclude transient/resolvable integration fields from export: `drive.fileId` (resolved on next write), `drive.email` (fetched on demand post-OAuth), and `push.endpoint` + `push.vapidPublicKey` (re-entered from Settings). Only `drive.clientId` is worth preserving across installs (so the user doesn't re-enter it).

---

## ISSUE 7 — Page PUSH_SUBSCRIPTION_CHANGED handler does not verify message source

**LOCATION:** `index.html` lines ~1468–1474 (message event listener in `App` component); `sw.js` lines 138–153

**SEVERITY: Minor**

**DEFECT:** The `App` component's `message` listener acts on `ev.data.type === "PUSH_SUBSCRIPTION_CHANGED"` without verifying that `ev.source` is a trusted service worker. In the standard case the SW is the only sender of this message; however, any `window.postMessage` from the same origin (or from an `iframe` or `SharedWorker`) can spoof this type string and trigger an immediate `webpush.subscribe()` call — which requests notification permission (if not already granted) and POSTs the current milestone schedule to the configured push server. An XSS attacker with JS execution in the same origin can exploit this to exfiltrate the user's full milestone schedule on demand.

**EVIDENCE/FIX:**

Fix: guard the handler with a source check:

```js
navigator.serviceWorker.addEventListener("message", (ev) => {
  // Only process messages from this page's own SW controller
  if (ev.source !== navigator.serviceWorker.controller) return;
  if (ev.data && ev.data.type === "PUSH_SUBSCRIPTION_CHANGED") { ... }
});
```

Note: the current code uses the generic `navigator.serviceWorker.addEventListener("message", ...)` inside a `"serviceWorker" in navigator` guard — it should additionally check `ev.source`.

---

## Summary — Ranked by Severity

| Rank | Severity | Issue | Location | One-line defect | One-line fix |
|------|----------|-------|----------|-----------------|--------------|
| 1 | **Critical** | #1 | server.js `/subscribe` | Any internet client can register or overwrite any subscriber's schedule | Add shared secret or per-subscription ownership token; add subscription cap |
| 2 | **Major** | #2 | server.js `ALLOW_ORIGIN` default | Default `"*"` opens all routes to cross-origin browser requests | Fail on startup if `ALLOW_ORIGIN` is unset |
| 3 | **Major** | #3 | server.js `/unsubscribe` | Any party with the endpoint URL can silently delete any victim's subscription | Require delete-token or keys proof on unsubscribe |
| 4 | **Major** | #4 | server.js `/send` auth | `!==` leaks ADMIN_TOKEN via timing side-channel | Use `crypto.timingSafeEqual` |
| 5 | **Minor** | #5 | server.js `store.sent` | `sent{}` map grows forever; DoS amplifier when combined with #1 | Prune entries older than 30 days in `upsert` |
| 6 | **Minor** | #6 | index.html export | `fileId`, `email`, push endpoint included in plaintext backup export | Strip transient integration fields from export payload |
| 7 | **Minor** | #7 | index.html message listener | `PUSH_SUBSCRIPTION_CHANGED` handler trusts any same-origin `postMessage` | Verify `ev.source === navigator.serviceWorker.controller` |
