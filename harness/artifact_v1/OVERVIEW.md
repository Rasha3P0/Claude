# Artifact v1 — Drive OAuth write-back + VAPID background push

Factual map of the change for review. The substance is `implementation.diff`
(full unified diff of all touched/new files). Review the code, not this summary.

## Scope
Implements the two phase-2 boundaries for Ground Control (a single-file React 18
PWA, no build step, state in `localStorage`):
- **(a)** Direct Google Drive OAuth write-back for the trading alerts, replacing
  the copy/paste-only flow.
- **(b)** Background push via VAPID, wired into the existing service worker.

Both are **off until configured** in Settings → Integrations; with no credentials
the app behaves exactly as before (copy/paste logs + in-app `setTimeout` alerts).

## Files
| File | Change |
|------|--------|
| `index.html` | New `googleDrive` (OAuth token model + Drive REST) and `webpush` (subscribe/unsubscribe/syncSchedule) modules; `loadScriptOnce`, `urlBase64ToUint8Array` helpers; `drive`/`push` settings + migration; AlertScreen "Write to Drive" UI; Settings → Integrations card; SW `PUSH_SUBSCRIPTION_CHANGED` handling. |
| `sw.js` | Hardened/validated push payload (`clamp`); `pushsubscriptionchange` re-subscribe; cache bumped `v1`→`v2`; comments updated. |
| `push-server/` | New. Companion VAPID server (`server.js`), `package.json`, `README.md`. Holds the VAPID private key and delivers on schedule. |
| `README.md` | Integrations + limitations updated. |

## Key flows
**Drive write-back.** Confirm/Dismiss an alert → "drive" mode. If
`settings.drive.clientId` is set, a **Write to Drive** button calls
`googleDrive.appendMarkdown(markdown, settings, saveSettings)`:
1. `getToken` — Google Identity Services token model, public client id, scope
   `https://www.googleapis.com/auth/drive.file`. Access token in a module
   variable (memory only); silent re-request on expiry; one interactive retry on 401.
2. `resolveFile` — reuse cached `fileId`; else find by `appProperties` marker;
   else create (metadata-only POST).
3. Read current file (`alt=media`), append the markdown block, `PATCH ?uploadType=media`.
Copy/paste remains as a fallback and when Drive is not configured.

**Background push.** Settings → Integrations: paste push-server URL + public VAPID
key → `webpush.subscribe`:
1. `Notification.requestPermission()` → `pushManager.subscribe({ userVisibleOnly:true,
   applicationServerKey })`.
2. Store subscription in `push_subscription`; POST `{subscription, milestones[]}`
   to `<server>/subscribe`.
The server (`push-server/server.js`) stores subscriptions, and on an hourly tick
(or `POST /send` cron) delivers any milestone whose `fire` date has arrived
(deduped, dead subs pruned). The SW `push` handler validates the payload and shows
the notification; `pushsubscriptionchange` re-subscribes and notifies the page.

`webpush.syncSchedule` re-posts the schedule to the server on every app open when
subscribed.

## New localStorage / settings shape
```
gc_settings.drive = { clientId, fileId, fileName, email }
gc_settings.push  = { endpoint, vapidPublicKey, subscribed }
push_subscription = <PushSubscription JSON>   (key already reserved pre-change)
```
`seedIfNeeded` migrates older installs (adds `drive`/`push` defaults non-destructively).

## How to syntax-check (no browser; CDN is blocked in-sandbox)
```
python3 - <<'PY'
import re; s=open("index.html").read()
import re; m=re.search(r'<script type="text/babel"[^>]*>(.*?)</script>', s, re.S)
open("/tmp/c.jsx","w").write(m.group(1))
PY
npx prettier@3 --parser babel /tmp/c.jsx >/dev/null   # exits non-zero on syntax error
node --check sw.js
node --check push-server/server.js
```
