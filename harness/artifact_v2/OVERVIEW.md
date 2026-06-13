# Artifact v2 — Drive OAuth write-back + VAPID background push (revised)

Full feature as it stands after the v1 adjudication. `implementation.diff` is the
complete change vs the pre-feature baseline (PR #9). Review the code, not this map.
`CHANGES_SINCE_V1.md` lists exactly what moved in this iteration — focus there.

## Scope (unchanged from v1)
Single-file React 18 PWA (index.html, React+Babel via CDN, no build step), state in
localStorage. Adds (a) direct Google Drive OAuth write-back for trading alerts and
(b) background push via VAPID, both OFF until configured in Settings → Integrations.

## Files
| File | Change |
|------|--------|
| `index.html` | `googleDrive` (GIS token model, `drive.file` scope, memory-only token + memory-cached fileId) and `webpush` (subscribe/unsubscribe/syncSchedule) modules; `drive`/`push` settings + migration; AlertScreen "Write to Drive" (deduped UI); Settings → Integrations card (single cancelable status helper); SW-message handling (source-checked). |
| `sw.js` | Validated/clamped push payload; `pushsubscriptionchange` re-subscribe; cache `v2`. |
| `push-server/` | Reference VAPID server: fail-closed CORS, constant-time admin-token check, subscription cap, `runDue` concurrency guard, pruned dedupe map. |
| `README.md`, `push-server/README.md` | Integrations, limitations, env, security notes. |

## Key flows
**Drive write-back.** Confirm/Dismiss → "drive" mode. When `settings.drive.clientId`
is set, **Write to Drive** calls `googleDrive.appendMarkdown`:
1. `getToken` (GIS token model, public client id, scope `drive.file`; token in a
   module variable, memory only; silent re-request on expiry; one interactive retry on 401).
2. `resolveFile` — module-cached fileId → settings fileId → find by `appProperties`
   marker → create (metadata-only POST).
3. Read current file (`alt=media`); **abort if the read fails** (never overwrite);
   append; `PATCH ?uploadType=media`.
Copy/paste remains as the fallback and when Drive is unconfigured.

**Background push.** Settings → Integrations: push-server URL + public VAPID key →
`webpush.subscribe` (permission → `pushManager.subscribe` → store + POST schedule to
`<server>/subscribe`). `syncSchedule` re-reads the LIVE subscription on each open and
re-posts (heals drift after a rotation). The server delivers any milestone whose
`fire` date has arrived (deduped, concurrency-guarded, dead subs pruned). The SW
validates the payload and shows it; `pushsubscriptionchange` re-subscribes.

## Settings / storage
```
gc_settings.drive = { clientId, fileId, fileName }     // email field removed
gc_settings.push  = { endpoint, vapidPublicKey, subscribed }
push_subscription = <PushSubscription JSON>
```
Export strips `drive.fileId`. `seedIfNeeded` migrates older installs non-destructively.

## Syntax check (no browser; CDN blocked in-sandbox)
```
python3 -c "import re;open('/tmp/c.jsx','w').write(re.search(r'<script type=\"text/babel\"[^>]*>(.*?)</script>',open('index.html').read(),re.S).group(1))"
npx prettier@3 --parser babel /tmp/c.jsx >/dev/null   # non-zero on syntax error
node --check sw.js && node --check push-server/server.js
```
