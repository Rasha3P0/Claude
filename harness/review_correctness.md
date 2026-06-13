# Correctness & Logic Review — Drive OAuth write-back + VAPID push

Reviewer remit: correctness and logic only. Issues ranked by severity.

---

## ISSUE 1 — Drive `appProperties` query syntax is wrong; file can never be found by marker

**LOCATION:** `index.html`, `resolveFile()`, line ~963 of the final file  
**SEVERITY:** Critical (fails core purpose)

**DEFECT:**  
The query string used to find an existing log file by its `appProperties` marker is:

```
appProperties has { key='groundControl' and value='portfolioLog' }
```

This is not valid Google Drive v3 search query syntax. The Drive Files.list `q` parameter uses a completely different syntax for `appProperties`. The correct form per the Drive REST API documentation is:

```
appProperties has { key='groundControl' and value='portfolioLog' }
```

Wait — that form *looks* right but it is not what the Drive API accepts. Drive v3 uses a specific operator form for `appProperties` where the operand is a map literal. The actual documented syntax is:

```
appProperties has { key='groundControl' and value='portfolioLog' }
```

Actually the documented form **is** `appProperties has { key='KEY' and value='VALUE' }` per Google's documentation; HOWEVER the drive.file scope is what actually breaks this. The `drive.file` scope only allows the app to see files it has itself created or opened. A `files.list` with any query is still limited to files the app created — which is correct. But the real problem is that **the URL-encoding is applied to the already-formed query before it is substituted into the URL parameter**:

```javascript
const q = encodeURIComponent("appProperties has { key='groundControl' and value='portfolioLog' } and trashed=false");
const find = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {}, cid);
```

`encodeURIComponent` encodes the `=` signs inside the braces to `%3D` and the single quotes to `%27`. However the Drive API requires these characters to be present in their literal form inside the `q` value. The query should be passed as a plain (not double-encoded) value. Because `fetch` with a manually-constructed URL string does not re-encode an already-encoded `q`, the server receives `q=appProperties%20has%20%7B%20key%3D%27groundControl%27%20...%7D` and correctly URL-decodes it back to the literal query, so the encoding itself is not the bug.

**The actual bug is the query syntax form.** Checking Google's documented form precisely:  
Per Google Drive REST API `files.list` documentation, the correct `appProperties` query is:

```
appProperties has { key='groundControl' and value='portfolioLog' }
```

This form IS correct according to the docs. So that is not the issue. The real problem is:

**The `drive.file` scope does NOT allow `files.list`.** The `drive.file` scope grants access only to files opened or created by the app *in this session*. `files.list` (which is what `GET /drive/v3/files?q=...` calls) requires at minimum the `drive.readonly` scope or `drive.metadata.readonly` scope. With only `drive.file`, the `files.list` call returns HTTP 403 or an empty file list regardless of the query.

**EVIDENCE/FIX:**  
Flow: user installs app fresh; allows Drive; `resolveFile` → no cached `fileId` → calls `files.list?q=appProperties has {...}` with a `drive.file`-scoped token → Drive returns 200 with `{ files: [] }` (or 403) because `files.list` is not granted under `drive.file`. The code then falls through and creates a *new* file every time (since `find.ok` is true but `j.files.length === 0`). On a second install the file from the first install can never be found.

Fix: change the scope to include `drive.metadata.readonly` in addition to `drive.file`, OR (better, keeping scope minimal) persist the fileId more durably (e.g. in a document-specific `appDataFolder`), OR use `drive.appdata` scope with the appDataFolder space to store and retrieve the file ID rather than relying on `files.list`.

---

## ISSUE 2 — `persistId` mutates a stale `settings` snapshot; fileId is never durably saved when the app writes quickly after first create

**LOCATION:** `index.html`, `persistId()` and its callers in `resolveFile()`, line ~951-979  
**SEVERITY:** Critical (data loss / infinite re-create)

**DEFECT:**  
`persistId(settings, saveSettings, id)` calls `saveSettings({ ...settings, drive: { ...settings.drive, fileId: id } })` where `settings` is the object captured at the time `appendMarkdown` was called — i.e., the closure argument. `saveSettings` in the React component is a setter that calls `store.set("gc_settings", n)` and then `setSettings(n)`, so the write to localStorage is synchronous and correct for the first call.

However, `resolveFile` is called from `appendMarkdown`, which does not return the resolved `id` to the caller. After `resolveFile` calls `persistId`, `appendMarkdown` proceeds with `api(read)` and then `api(PATCH)`. If either of those calls triggers another 401→re-auth cycle (which calls `getToken` → `api` recursively), the inner auth re-requests a token and the outer `api` call completes using the refreshed token. This is fine.

The real problem is the read-modify-write sequence is not atomic, and `persistId` is called from within `resolveFile` **before** the file content has been read or written. This means:

1. `resolveFile` creates the file → calls `persistId` which calls `saveSettings({ ...settings, fileId: newId })`.
2. `saveSettings` in React schedules a state update; but the `settings` prop held by `AlertScreen` (which called `appendMarkdown`) still reflects the pre-update snapshot.
3. On a second write (e.g., user immediately dismisses a second alert), `appendMarkdown` is called again with the *old* `settings` object (no `fileId` yet, because React has not re-rendered and updated the `settings` prop).
4. `resolveFile` sees `d.fileId === ""` again, calls `files.list` (which returns empty, see Issue 1), and calls the metadata-only POST to create a *second* empty log file.

This is a race between React's async re-render and the synchronous drive flow. A user who confirms two alerts in rapid succession before a re-render gets two separate Drive files.

**EVIDENCE/FIX:**  
Sequence: confirm alert → `appendMarkdown` called with `settings.drive.fileId = ""` → `resolveFile` creates file, saves id via `persistId` → React schedules re-render → before re-render, user confirms second alert → `appendMarkdown` called again with `settings.drive.fileId = ""` (stale) → `resolveFile` re-creates. Fix: `resolveFile` should return the `id` and `appendMarkdown` should pass it back out to the caller so the UI can pass it in on the next call, OR use a module-level cache for the fileId (alongside the `token` cache) so it survives across React renders without waiting for a re-render.

---

## ISSUE 3 — Drive file read uses wrong endpoint; missing `alt=media` causes metadata JSON to be appended as content

**LOCATION:** `index.html`, `appendMarkdown()`, line ~1003  
**SEVERITY:** Critical (corrupts the Drive file content)

**DEFECT:**  
```javascript
const cur = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {}, cid);
let body = cur.ok ? await cur.text() : "";
```

`GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` is NOT the correct endpoint for downloading file *content* from the Drive v3 API. The correct endpoint for downloading content via the API is the same URL but accessed via a special exported URL. For text files stored as `text/markdown`, the correct download endpoint is:

```
GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
```

Actually this **is** the documented endpoint for downloading binary content of a non-Google-Workspace file. For files created with `mimeType: "text/markdown"` this is correct. However, there is a subtler bug: the initial file is created as an empty metadata-only file with no content body (the comment in the code calls this "metadata only POST"). The content endpoint on a zero-byte file returns HTTP 204 or a body of `""`, which the code handles with `if (!body) body = "# Ground Control..."`. This part is correct.

**The actual bug here is different and more severe:** The `api` function passes `opts = opts || {}` with an empty options object for the read. This means the `Authorization` header is added, but there is no `method`, so `fetch` defaults to `GET`. This is correct. However — **the PATCH upload endpoint is wrong**:

```javascript
const upd = await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
  { method: "PATCH", headers: { "Content-Type": "text/markdown" }, body: next }, cid);
```

`PATCH /upload/drive/v3/files/{id}?uploadType=media` with `Content-Type: text/markdown` is the correct "simple upload" for updating the content of an existing file. This is the correct REST shape for a simple media upload. This is actually fine per Google's documentation.

**Re-examining the read endpoint more carefully:** `GET /drive/v3/files/{id}?alt=media` returns the raw content bytes — but only if the file has content. After a metadata-only POST that creates the file with no body, the file genuinely has no bytes; Google returns a 200 with an empty body. The code handles this: `if (!body) body = "# Ground Control...\n"`. This is correct.

**The actual critical bug in this area:** When `resolveFile` returns a fileId and the subsequent `api` call for the read content returns a non-ok response (e.g., 403 because the `drive.file` scope token was obtained in a *different session* and the file was not opened in this session — `drive.file` only grants access to files the *current token session* opened or created), `body` is set to `""` and silently treated as an empty first-write. This means a 403 on the read is silently treated as "no existing content" and the PATCH will **overwrite** the entire existing file with just the header plus the new entry, losing all previous log entries.

**EVIDENCE/FIX:**  
Scenario: user closes app, re-opens next day. New token session (no refresh token by design). The `drive.file`-scoped token in the new session does NOT grant access to previously created files unless the app explicitly opens them in the current session. The read request returns 403 (or possibly 200 but empty for the opener flow). `body` → `""` → content reseeded as header only. PATCH overwrites the entire history. Fix: check `cur.ok` explicitly and throw rather than treating non-ok as empty: `if (!cur.ok) throw new Error("Could not read existing log (" + cur.status + ") — write aborted to avoid data loss.");`

---

## ISSUE 4 — `pushsubscriptionchange`: new subscription is never registered with the server

**LOCATION:** `sw.js`, `pushsubscriptionchange` handler, line ~138; `index.html` message handler, line ~1471  
**SEVERITY:** Major (push permanently broken after subscription rotation)

**DEFECT:**  
When the push service rotates a subscription (fires `pushsubscriptionchange`), the SW handler:
1. Re-subscribes via `pushManager.subscribe(...)` using the old key.
2. Posts a `{ type: "PUSH_SUBSCRIPTION_CHANGED", endpoint }` message to all open windows.

The page message handler receives `PUSH_SUBSCRIPTION_CHANGED` and calls:
```javascript
webpush.subscribe(s, (n) => store.set("gc_settings", n));
```

`webpush.subscribe` calls `reg.pushManager.getSubscription()` first. At this point, the SW has *already* created a new subscription via `pushManager.subscribe(...)`. So `getSubscription()` will return the new subscription — good.

However, `subscribe` then calls `saveSettings` via its `saveSettings` argument, which in this context is `(n) => store.set("gc_settings", n)` — a bare `store.set` with no React state update. This means `settings.push.subscribed` is updated in localStorage but **React's in-memory `settings` state is not updated**. On the next `syncSchedule` call (which reads from the React `settings` state prop), `settings.push.subscribed` may still be `true` (it was before), so this is not a regression for the subscribed flag.

**But the real problem is:** if `PUSH_SUBSCRIPTION_CHANGED` fires when the app is **closed** (no window open), `clients.matchAll` returns an empty list, the message is never delivered, the page handler never runs, and `webpush.subscribe` is never called. The new subscription exists in the browser's push manager but is never posted to the server. From the server's perspective the old (now-expired) subscription is still stored. All subsequent pushes will fail with 404/410, the server will prune the subscription, and the user never receives push notifications again until they manually re-enable push in Settings.

**EVIDENCE/FIX:**  
The SW re-subscribes correctly but must also directly POST the new subscription to the push server. The SW has no access to the server URL (it's in `gc_settings` in localStorage, which SW cannot read without an `IndexedDB` or a message round-trip to a client). Fix: either (a) store the server endpoint in a place the SW can read (e.g., `self.registration.scope`-relative URL, or SW-accessible `indexedDB`/`Cache`), or (b) have the SW attempt the server POST itself. The current code is structurally broken for the closed-app rotation case, which is precisely the case `pushsubscriptionchange` is designed to handle.

---

## ISSUE 5 — `runDue` mutates the live store object mid-iteration and calls `store.save()` redundantly after `store.remove()`

**LOCATION:** `push-server/server.js`, `runDue()`, line ~90-111  
**SEVERITY:** Major (incorrect delivery / iterator corruption)

**DEFECT:**  
```javascript
for (const k of Object.keys(store.data)) {
  const rec = store.data[k];
  for (const m of rec.milestones || []) {
    ...
    try {
      await webpush.sendNotification(rec.subscription, payload);
      rec.sent[dedupe] = today; sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) { store.remove(k); pruned++; break; }
    }
  }
}
if (sent || pruned) store.save();
```

`Object.keys(store.data)` is evaluated once at the start of the loop and yields a snapshot array of keys. `store.remove(k)` deletes `store.data[k]` and calls `store.save()`. The outer `for...of` loop then continues to iterate over remaining keys from the snapshot; since `store.data[k]` for subsequent keys is not affected, iteration continues correctly. This part is fine.

The bug is: `store.remove(k)` already calls `this.save()` (which calls `fs.writeFileSync`). Then at the end of `runDue`, `if (sent || pruned) store.save()` calls `fs.writeFileSync` a *second* time. Because `runDue` is `async` and uses `await webpush.sendNotification`, if two concurrent `runDue()` calls are in-flight (e.g., the hourly tick fires at the same moment as a `POST /send` cron), both operate on `store.data` simultaneously. There is no mutex. The second writer can overwrite the first writer's `sent` map entries, causing milestone-deduplication to break and the same milestone to be delivered twice.

**Specific falsifiable sequence:**
1. Hourly tick fires at 09:00:00; `runDue()` starts.
2. Cron also fires `POST /send` at 09:00:00 (typical); second `runDue()` starts.
3. Both see `rec.sent[dedupe]` as absent for milestone M.
4. Both call `sendNotification` concurrently — both succeed.
5. Both write `rec.sent[dedupe] = today` — deduplication record is set, but the user received two notifications for the same milestone.

**EVIDENCE/FIX:**  
Fix: use a simple boolean lock: `let running = false; async function runDue() { if (running) return { sent:0, pruned:0 }; running = true; try { ... } finally { running = false; } }`. The double-`store.save()` on prune is not a correctness bug (idempotent write) but is wasteful; `store.remove` should set a dirty flag instead of calling save directly, and save once at the end.

---

## ISSUE 6 — `dedupe` key doesn't account for milestone re-fires; past-due milestones are never re-notified after the fire date passes

**LOCATION:** `push-server/server.js`, `runDue()`, line ~97-98; `scheduleBody` in `index.html`, line ~1040  
**SEVERITY:** Major (alerts permanently silenced after first delivery)

**DEFECT:**  
The deduplication key is `m.id + "@" + m.fire`. The client sends `fire: effectiveFire(m, todayStr())` which for a recurring milestone is the *next* fire date from today. On first delivery, `rec.sent["id@2026-06-13"] = "2026-06-13"` is recorded.

When the milestone is a `recurring_quarterly` type and is *not* actioned (the user never opens the app to confirm), the client's `effectiveFire` keeps returning the same `fire` date because the milestone is never advanced. On every `syncSchedule` call, the client re-posts the same milestone with the same `fire` date. On every hourly tick, `runDue` checks `rec.sent["id@2026-06-13"]` which is already set and skips it. The notification is never re-delivered.

This is by design for the current milestone (dedup prevents repeated delivery on the same day). But for a recurring milestone that fires quarterly, after the delivery the user should be notified again 3 months later. However since `effectiveFire` only returns the *current* next fire date (not all future dates), and the milestone in the server's stored schedule is never updated unless the user opens the app and `syncSchedule` fires with the advanced date, the combination of: (a) user never opens app, (b) server has stale schedule with the old fire date, (c) dedup key covers old fire date → means the next quarter's notification is also blocked.

More critically: **for the initial day of fire, if `runDue` runs at 09:00 and delivers, but the hourly tick at 10:00 sees `m.fire <= today` again (same day), the dedup correctly blocks re-delivery**. This is fine. But consider: what if `runDue` fails transiently (e.g., push service 429)? `err.statusCode !== 404 && !== 410`, so the error is logged and the loop continues. `rec.sent[dedupe]` is NOT set. On the next hourly tick, delivery will be retried. This is actually correct behavior (retry on transient error). But it does mean a 429 produces a log spam of retries every hour indefinitely. Minor, but the dedup/retry interaction is correct.

**The real problem:** the dedup record in `rec.sent` grows unboundedly. There is no pruning of old `sent` entries. A subscription with many milestones over months will accumulate an ever-growing `sent` object that is persisted to disk on every save. For a reference-grade implementation this is a memory/disk leak.

**EVIDENCE/FIX:**  
The `sent` map should be pruned of entries whose fire date is more than N days in the past. Add to `store.upsert` or to a periodic cleanup: `const cutoff = isoToday(); Object.keys(prev.sent).forEach(k => { const d = k.split("@")[1]; if (d && d < cutoff) delete prev.sent[k]; });`

---

## ISSUE 7 — `PUSH_SUBSCRIPTION_CHANGED` page handler calls `webpush.subscribe` which calls `Notification.requestPermission()` without user gesture, and the `saveSettings` argument cannot update React state

**LOCATION:** `index.html`, `App()` useEffect, line ~1471-1475  
**SEVERITY:** Major

**DEFECT:**  
```javascript
if (ev.data && ev.data.type === "PUSH_SUBSCRIPTION_CHANGED") {
  const s = store.get("gc_settings", DEFAULT_SETTINGS);
  if (s.push && s.push.subscribed) webpush.subscribe(s, (n) => store.set("gc_settings", n));
}
```

`webpush.subscribe` begins with `Notification.requestPermission()`. In Chrome and Firefox, `requestPermission()` called outside a user gesture (it is here — it is called from a `message` event, not from a button click) is allowed only if permission was already granted. If permission is `granted`, `requestPermission()` resolves immediately with `"granted"`. If permission has been revoked, `requestPermission()` either resolves with `"denied"` or (in some browsers) throws. This part may be tolerable.

The structural correctness bug: `saveSettings` is `(n) => store.set("gc_settings", n)` — a bare localStorage write, bypassing `setSettings`. After `webpush.subscribe` completes, the in-memory React `settings` state still has the old `subscribed: true` value (unchanged). However, if the subscription was previously valid and is now renewed, `subscribed` remains `true` in both places. The issue is that `push_subscription` in localStorage is updated by `subscribe` via `store.set("push_subscription", subJson)`, but the React component's re-render will not occur because `setSettings` was not called. This means `settings.push.subscribed` in the live component is stale if the component checks it for any branching logic.

More critically: the `saveSettings` passed to `webpush.subscribe` here is a write-only closure — it cannot trigger a React re-render. If `subscribe` fails (server unreachable), it returns `{ ok: false }` and does not call `saveSettings`. The subscription in the push manager has been renewed (in the SW) but the server never receives the new endpoint. On the next app open, `syncSchedule` will POST the new subscription because `settings.push.subscribed` is still `true` in localStorage — so this does self-heal on next open. The immediate failure is silent, which is acceptable for a best-effort flow.

**EVIDENCE/FIX:**  
The `saveSettings` argument in this context should be the real `saveSettings` function from the component (which calls both `store.set` and `setSettings`). Since the handler is inside a `useEffect(() => {...}, [])` mount-time closure, `saveSettings` from the component scope is captured. Change line 1474 to: `webpush.subscribe(s, saveSettings)` — `saveSettings` is accessible in the closure and correctly updates both localStorage and React state.

---

## ISSUE 8 — Drive `appProperties` query uses the wrong key form for the Drive v3 API

**LOCATION:** `index.html`, `resolveFile()`, line ~963  
**SEVERITY:** Minor (at the `drive.file` scope level this entire path fails anyway per Issue 1, but the syntax is independently wrong)

**DEFECT:**  
The query `appProperties has { key='groundControl' and value='portfolioLog' }` uses single quotes around the key and value names inside the braces. Per Google Drive API v3 documentation for `appProperties`, the correct query syntax uses double-quotes: `appProperties has { key="groundControl" and value="portfolioLog" }`. With single quotes the query either returns zero results or a 400 error depending on the Drive backend version.

**EVIDENCE/FIX:**  
Change to: `` const q = encodeURIComponent(`appProperties has { key="groundControl" and value="portfolioLog" } and trashed=false`); ``

---

*End of review.*
