# Adversarial Security Review — Ground Control Phase-2 (Drive OAuth + VAPID Push)

Reviewer role: RED-TEAM. Finding nothing without certification is a failed review.

---

## ISSUE 1 — Unauthenticated arbitrary subscription injection + persistent schedule poisoning

**LOCATION:** `push-server/server.js` lines 123–127, `POST /subscribe` handler; `store.upsert` (lines 52–57)

**SEVERITY: Critical**

**DEFECT:** `POST /subscribe` carries no authentication whatsoever. Any attacker on the internet can POST a legitimate browser push subscription they control (or any valid-looking one) along with a fully attacker-controlled `milestones[]` array. The server stores it permanently in `subs.json` under the attacker's endpoint key and will deliver push notifications to that endpoint on the schedule the attacker chose. There is no binding between "the browser that owns this subscription" and "the user whose milestone data is stored." The server is therefore an open relay: register any subscription, supply any schedule, get arbitrary push notifications delivered.

More concretely: because `upsert` uses `endpoint` as the only key, and the endpoint is fully attacker-supplied (it only passes a regex check for `^https://`), an attacker who knows or intercepts a victim's real push endpoint can POST that endpoint with an attacker-chosen milestone schedule, overwriting the victim's actual schedule. The victim then receives attacker-dictated notifications at attacker-chosen times. This is a stored-data-integrity attack that requires knowing the endpoint string — but endpoints are long opaque URLs, not secrets, and can be obtained by an attacker who observes network traffic or the `push_subscription` value in localStorage (readable by any XSS in the PWA).

Additionally, the `sent{}` deduplication map within each record grows without bound (one entry per `id@fire` pair ever delivered); a patient attacker can POST millions of unique milestones over time to bloat it permanently.

**EVIDENCE/FIX:**

Attack: `curl -X POST https://push-server/subscribe -H 'Content-Type: application/json' -d '{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/ATTACKER_CONTROLLED","keys":{"p256dh":"...","auth":"..."}},"milestones":[{"id":"x","name":"Sell everything","project":"p","action":"SELL","fire":"2024-01-01"}]}'` — server accepts, stores, and delivers.

Fix options (in increasing strength):
1. Require the client to sign the request with a per-subscription secret (e.g., derive from the `auth` key) so only the owning browser can update its record.
2. Issue a server-generated `token` on first subscribe and require it on subsequent updates to that endpoint.
3. At minimum, add an `ADMIN_TOKEN`-equivalent or a rotating nonce so arbitrary internet clients cannot write to the store. The README acknowledges this ("Add rate limiting and a max-subscriptions cap at the edge") but the shipped code has no mitigation at all.

---

## ISSUE 2 — Timing-safe comparison absent on ADMIN_TOKEN: timing oracle enables token brute-force

**LOCATION:** `push-server/server.js` line 139

```js
if (!ADMIN_TOKEN || auth !== ADMIN_TOKEN) return send(res, 401, { error: "unauthorized" });
```

**SEVERITY: Major**

**DEFECT:** The bearer token comparison uses JavaScript's `!==` string equality operator, which short-circuits on the first differing character. This exposes a character-by-character timing oracle. An attacker sending many requests to `POST /send` with varying token guesses can measure response latency differences to recover the `ADMIN_TOKEN` one character at a time. Node.js's V8 string comparison is particularly susceptible because it is not constant-time.

`POST /send` triggers `runDue()`, which delivers any due push notifications to all subscribers. A compromised ADMIN_TOKEN allows an attacker to flood all subscribers with arbitrary push notifications on demand (the payload content is still controlled by the stored milestone data, but an attacker who previously exploited Issue 1 to inject milestones can combine both to deliver arbitrary notification text).

**EVIDENCE/FIX:**

Fix: replace with `crypto.timingSafeEqual`:

```js
const crypto = require("crypto");
// ...
function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
// in /send handler:
if (!ADMIN_TOKEN || !safeCompare(auth, ADMIN_TOKEN)) return send(res, 401, ...);
```

---

## ISSUE 3 — CORS wildcard default exposes all routes to cross-origin browser requests

**LOCATION:** `push-server/server.js` line 34, `send()` function lines 79–87

```js
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";
```

**SEVERITY: Major**

**DEFECT:** If `ALLOW_ORIGIN` is not set (missing env var, misconfiguration, or "quick start" deployment), the server sends `Access-Control-Allow-Origin: *` on every response including `POST /subscribe`, `POST /unsubscribe`, and `POST /send`. The wildcard means any web page on the internet can make cross-origin fetch calls to the server from a victim's browser.

Concrete attack: a malicious third-party web page (or a compromised ad) can silently call `POST /unsubscribe` with the victim's push endpoint (obtained if the attacker can read the victim's localStorage via XSS) to disable the victim's push subscription without their knowledge. Or call `POST /subscribe` to register a new subscription pointing at the attacker (as per Issue 1).

Note: `credentials: "include"` is blocked by the wildcard, so cookie-bearing requests are safe, but the routes don't require cookies — they only require JSON bodies, which are freely cross-origin.

**EVIDENCE/FIX:**

Fix: fail-closed — if `ALLOW_ORIGIN` is not set, default to `""` (no CORS) or throw on startup:

```js
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN;
if (!ALLOW_ORIGIN) {
  console.error("ALLOW_ORIGIN must be set to your PWA origin (e.g. https://my-app.example).");
  process.exit(1);
}
```

---

## ISSUE 4 — Unauthenticated arbitrary subscription deletion: any party can unsubscribe any victim

**LOCATION:** `push-server/server.js` lines 130–134, `POST /unsubscribe` handler

**SEVERITY: Major**

**DEFECT:** `POST /unsubscribe` accepts `{ endpoint: <string> }` with zero authentication. The endpoint is a public-ish URL (visible in browser devtools, network logs, and the `push_subscription` localStorage key). Any party that obtains the endpoint string — an XSS attacker, a network observer, or the CORS-origin weakness in Issue 3 — can permanently delete the victim's push subscription from the server. The victim loses background push silently with no indication in the UI.

Unlike the browser-side `sub.unsubscribe()` (which requires browser-level access), the server-side `store.remove(endpoint)` has no ownership proof.

**EVIDENCE/FIX:**

Fix: require proof of subscription ownership before deletion. A simple approach: when the subscription is first created, generate a random deletion token and return it to the client; require that token on unsubscribe. Alternatively, treat unsubscribe as authenticated by the same mechanism recommended in Issue 1.

---

## ISSUE 5 — `sent{}` map grows unboundedly per subscription: memory/disk DoS

**LOCATION:** `push-server/server.js` lines 52–57 (`upsert`), lines 97–102 (`runDue`)

**SEVERITY: Minor** (with Major DoS potential if Issue 1 is abused)

**DEFECT:** The `sent` map in each subscription record is keyed by `id@fire` and is never pruned. Every milestone delivered adds a permanent entry. If an attacker exploits Issue 1 to register a subscription with millions of synthetic milestones (all with past `fire` dates), `runDue()` iterates all of them on every hourly tick, and the `sent` map for that record bloats indefinitely. For a legitimate user with years of milestones, this degrades gradually; for an attacker it is an immediate resource exhaustion vector.

The file store serialises the entire in-memory `data` object on every write (`store.save()`), so a large `sent` map causes write amplification proportional to total history size.

**EVIDENCE/FIX:**

Fix: prune `sent` entries older than N days (e.g., 30) during `upsert` or at the start of `runDue`:

```js
function pruneSent(sent, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(sent)) {
    if (sent[k] < cutoff) delete sent[k];
  }
}
```

---

## ISSUE 6 — `clientId` stored in `localStorage` inside `gc_settings` and exported in plaintext backup

**LOCATION:** `index.html` — `DEFAULT_DRIVE` (line 547), `store.set("gc_settings", ...)`, export-all function (lines 1252–1258)

**SEVERITY: Minor**

**DEFECT:** The OAuth client id is deliberately "public" and is not a secret per the Google OAuth 2.0 model for public clients. However, the existing data-export feature (`SettingsTab` backup export) serialises all of `gc_settings` to a JSON blob that includes `drive.clientId`, `drive.fileId`, and `push.endpoint` + `push.vapidPublicKey`. Users who share or post their exported backup (a common support action) expose their client id and, more importantly, the `drive.fileId` (the exact file id of their portfolio log file). An attacker who obtains a shared backup and also has access to a separately leaked Drive OAuth token for the same account can directly target that file.

The `drive.email` field is also persisted in settings (when the GIS callback populates it) and likewise included in exports — leaking PII via backup exports is a privacy concern even if not directly exploitable.

**EVIDENCE/FIX:**

Fix: exclude `drive.fileId`, `drive.email`, and `push.endpoint` from the export payload (these are auto-resolvable or re-enterable on restore). Alternatively, document clearly in the export UI that the export contains integration metadata.

---

## ISSUE 7 — No origin check in SW `pushsubscriptionchange` re-subscribe message to page clients

**LOCATION:** `sw.js` lines 138–153, specifically `c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", endpoint })`; `index.html` lines 1468–1474, the `message` event listener

**SEVERITY: Minor**

**DEFECT:** The SW broadcasts `PUSH_SUBSCRIPTION_CHANGED` to all window clients (`includeUncontrolled: true`). The page's message listener (`addEventListener("message", ...)`) checks `ev.data.type === "PUSH_SUBSCRIPTION_CHANGED"` and immediately calls `webpush.subscribe(s, ...)` — which triggers `Notification.requestPermission()`, a `pushManager.subscribe()` call, and a POST to the push server.

The SW originates this message, so it is not directly exploitable from an external origin. However, `includeUncontrolled: true` means pages that are not yet controlled by this SW (e.g., during an update race) receive the message. If a future version of the SW or a buggy update triggers spurious messages, it can cause unintended subscribe calls. More concretely: the page message handler does not verify `ev.source` is a trusted SW before acting on `PUSH_SUBSCRIPTION_CHANGED`, so any SW-originated message with that type triggers a subscribe. This is currently a SW-to-page trust boundary, but warrants a note.

**EVIDENCE/FIX:**

Fix: check `ev.source instanceof ServiceWorker` (or `ev.source === navigator.serviceWorker.controller`) before acting on the message:

```js
if (ev.source instanceof ServiceWorker && ev.data && ev.data.type === "PUSH_SUBSCRIPTION_CHANGED") { ... }
```

---

## Summary — Ranked by Severity

| Rank | Severity | Issue | One-line defect |
|------|----------|-------|-----------------|
| 1 | **Critical** | #1 Unauthenticated /subscribe | Any internet client can inject or overwrite any subscriber's milestone schedule |
| 2 | **Major** | #3 CORS wildcard default | Missing env var opens all routes to cross-origin browser requests |
| 3 | **Major** | #4 Unauthenticated /unsubscribe | Any party can silently delete any victim's push subscription by endpoint string |
| 4 | **Major** | #2 Timing oracle on ADMIN_TOKEN | `!==` comparison leaks token length/content via response latency |
| 5 | **Minor** | #5 Unbounded `sent{}` map | DoS amplification when combined with unauthenticated subscription injection |
| 6 | **Minor** | #6 Integration secrets in export | `fileId`, `email`, `endpoint` included in plaintext user backup |
| 7 | **Minor** | #7 SW re-subscribe message no source check | Page acts on PUSH_SUBSCRIPTION_CHANGED without verifying message source |
