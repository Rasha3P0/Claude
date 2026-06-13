# Correctness Review — v2 (iteration 2)

Reviewer: adversarial correctness pass  
Files read: `harness/artifact_v2/OVERVIEW.md`, `harness/artifact_v2/CHANGES_SINCE_V1.md`,
`harness/artifact_v2/implementation.diff`, `index.html`, `sw.js`, `push-server/server.js`.

---

## Part 1 — Change-list verification (items 1–14)

### Item 1 — Abort on failed read ✓
`appendMarkdown` checks `if (!cur.ok) return { ok:false, error:… }` before `cur.text()`.
Only a 200 proceeds; any non-2xx short-circuits. **Correctly implemented.**

### Item 2 — Module-level `fileId` cache ✓ (with a defect — see Issue A)
`fileId` lives as a module-level `let` inside the `googleDrive` IIFE.  
`rememberId` writes it; `resolveFile` reads `fileId || d.fileId`.  
`disconnect` zeroes it. The basic mechanism is in place.  
However a stale-`settings` bug (Issue A) means the in-memory `fileId` can diverge from what
`resolveFile` sees during a concurrent write — see detailed write-up below.

### Item 3 — SW message handler uses `saveSettings` useCallback ✓
Line 1497: `webpush.subscribe(s, saveSettings)` where `saveSettings` is the stable
`useCallback` defined at line 1460. **Correctly implemented.**

### Item 4 — `syncSchedule` reads live subscription ✓ (with a defect — see Issue B)
`syncSchedule` calls `reg.pushManager.getSubscription()`, stores the result, falls back to
the stored copy. The live-read is there. But `syncSchedule` is called inside a `useEffect`
whose dependency array is `[milestones, today]` — `settings` is NOT in the array (Issue B).

### Item 5 — `runDue` concurrency guard ✓
Module-level `let running = false` with `try/finally` reset. Both the hourly tick and POST
`/send` enter the same guard. **Correctly implemented.**

### Item 6 — `ALLOW_ORIGIN` required at startup ✓
`process.exit(1)` on line 44 if `ALLOW_ORIGIN` is falsy. **Correctly implemented.**

### Item 7 — `timingSafeEqual` for admin token ✓
`safeEqual` returns `false` if either argument is falsy (preventing the zero-length-buffer
trap), then delegates to `crypto.timingSafeEqual`. **Correctly implemented.**

### Item 8 — `MAX_SUBSCRIPTIONS` cap ✓
`/subscribe` checks `isNew && Object.keys(store.data).length >= MAX_SUBSCRIPTIONS`; returns
429 if at cap. Existing endpoints can still update. **Correctly implemented.**

### Item 9 — Deduped AlertScreen Drive UI ✓ (with a defect — see Issue C)
`driveConfigured` is computed once, markdown codebox hoisted above the branch. No
duplication. The `driveState !== "idle"` disable guard prevents double-clicks.
However the Copy button's `disabled` state and the `writeToDrive` closure capture a stale
`markdown` value — see Issue C.

### Item 10 — Single cancelable timer ✓
`intTimer` is a `useRef`; `holdIntMsg` cancels before setting; `flashIntMsg` calls
`holdIntMsg` then arms the new timer; `useEffect` cleanup on unmount. **Correctly
implemented.**

### Item 11 — `pruneSent` drops entries older than 30 days ✓ (with a defect — see Issue D)
`pruneSent` is called from `store.upsert`. The comparison `sent[key] < cutoff` prunes
entries whose VALUE (the date the notification was sent) is older than the cutoff. The
design is correct but has a subtle off-by-one in the equality boundary — see Issue D.

### Item 12 — `drive.email` removed; `buildExportDump` strips `drive.fileId` ✓
`DEFAULT_DRIVE` has no `email` field. `buildExportDump` creates `safeSettings` with
`fileId: ""`. **Correctly implemented.**

### Item 13 — Source-check on SW messages ✓
Line 1491: `if (ev.source && navigator.serviceWorker.controller && ev.source !== navigator.serviceWorker.controller) return;` — guards both non-null sources and the null-source (first-install) case by only dropping the message when source is non-null AND differs from the controller. **Correctly implemented.**

### Item 14 — `scheduleBody` takes `milestones` as explicit arg ✓
Signature is `scheduleBody(settings, sub, milestones)`. All call-sites pass
`loadMilestones()` explicitly. **Correctly implemented.**

---

## Part 2 — Defects (new / residual)

---

### Issue A — CRITICAL: `writeToDrive` passes a stale `settings` snapshot; `resolveFile` may write a resolved `fileId` back to an already-stale settings object, making subsequent writes re-resolve the file every time

**LOCATION:** `index.html` — `writeToDrive` (line ~2208) and `rememberId` (line ~951)

**SEVERITY:** Major

**DEFECT:**  
`AlertScreen` receives `settings` as a React prop at mount time. `writeToDrive` captures
that closure-captured `settings` and passes it to `appendMarkdown(markdown, settings,
saveSettings)`. Inside `resolveFile`, `rememberId(settings, saveSettings, id)` is called
with the SAME stale `settings` snapshot. If `saveSettings` has already been called since
`AlertScreen` last rendered (e.g., the drive connect flow in Settings just updated
`settings.drive.fileId`), `rememberId` will call:

```js
saveSettings({ ...settings, drive: { ...settings.drive, fileId: id } })
```

…where `settings` is the old snapshot, potentially clobbering changes made after
`AlertScreen` opened (specifically the `fileId` field that a concurrent first-write
resolution just saved). The module-level `fileId` variable IS updated correctly; the
settings write-back in `rememberId` is the problem: it uses the stale `settings` from the
closure rather than reading fresh from `store.get("gc_settings")`.

**Practical consequence:** The very first write resolves `fileId` and calls `rememberId`.
That stores `fileId` correctly in the module variable. But if `settings` inside `AlertScreen`
hasn't re-rendered yet (it's a modal, closed after use anyway), the `saveSettings` call in
`rememberId` may not persist the `fileId` change — or may overwrite a more recent snapshot.
The module-level `fileId` cache hides this most of the time, but after a page reload the
module cache is empty, forcing a re-resolve on every open until a clean settings write lands.

**Evidence-fix:** In `rememberId`, read fresh settings before persisting:

```js
function rememberId(_ignored, saveSettings, id) {
  fileId = id;
  const s = store.get("gc_settings");
  if (s && ((s.drive || {}).fileId) !== id)
    saveSettings({ ...s, drive: { ...(s.drive || {}), fileId: id } });
}
```

---

### Issue B — MAJOR: `syncSchedule` is called with a stale `settings` closure when milestones change but push config didn't

**LOCATION:** `index.html` — `useEffect` containing `webpush.syncSchedule(settings)` (line ~1538), deps `[milestones, today]`

**SEVERITY:** Major

**DEFECT:**  
The `useEffect` at line 1514 has dependency array `[milestones, today]`. Inside it,
`webpush.syncSchedule(settings)` is called, but `settings` is NOT in the dep array.
React captures `settings` at the time the effect closure was created — which may be an
earlier render if `settings` changed (e.g., push was enabled/disabled) but `milestones`
and `today` did not change at the same render tick.

**Practical scenario:**  
1. User enables push → `settings.push.subscribed = true`, `settings` re-renders.
2. `milestones` and `today` did not change, so the effect does NOT re-run.
3. `webpush.syncSchedule(settings)` is NEVER called with the newly subscribed settings
   until tomorrow (when `today` changes) or until a milestone is saved.

This means the server's schedule can go un-synced for up to 24 hours after the user first
enables push, even though the code comment says "re-posts on every open."  
The `subscribe` call in `enablePush` does POST once — but `syncSchedule` is the heal-on-
open mechanism, and it silently skips the freshly-enabled state until the next natural
effect re-trigger.

Conversely, if push is DISABLED between triggers, the stale-`settings` closure still
has `subscribed: true` and may fire an unnecessary sync to a subscription that no longer
exists on the server.

**Evidence-fix:** Add `settings` (or at least `settings.push`) to the dep array, or read
settings fresh from `store.get` inside the effect:

```js
}, [milestones, today, settings]);
```

Or inside the effect body: `webpush.syncSchedule(store.get("gc_settings", DEFAULT_SETTINGS));`

---

### Issue C — MAJOR: `writeToDrive` closes over `markdown` which is `""` when the component first renders in drive mode; a race between state-flush and button click can write an empty string to Drive

**LOCATION:** `index.html` — `writeToDrive` (line ~2208), `markdown` derivation (line ~2245)

**SEVERITY:** Major

**DEFECT:**  
`markdown` is a derived constant:
```js
const markdown = response ? buildMarkdown(response, …) : "";
```
`writeToDrive` is defined BEFORE `markdown`:
```js
const writeToDrive = async () => {
  …
  const r = await googleDrive.appendMarkdown(markdown, settings, saveSettings);
  …
};
```

In JavaScript, `writeToDrive` closes over the variable binding `markdown` in the render
scope. So it will always see the `markdown` value from the same render. That part is fine —
BUT consider what happens if `driveState` transitions trigger a re-render:

`setDriveErr(""); setDriveState("writing");` are two synchronous `setState` calls in the
same event handler. React 18 batches them into a single re-render. In that re-render,
`writeToDrive` is re-created with the NEW `markdown` value. However the `await
googleDrive.appendMarkdown(…)` is already in-flight — it captured `markdown` from the
PREVIOUS render where the button was clicked. This is fine in that path.

The REAL defect is more subtle: the "Write to Drive" button is only shown when
`driveConfigured && driveState === "idle"`. But `driveState` is component-local state
initialised to `"idle"`. When the AlertScreen mounts in `"drive"` mode (after `doConfirm`
calls `setMode("drive")`), `response` is already set and `markdown` is non-empty, so this
path is fine in normal use.

However: a second click is possible between when `setDriveState("writing")` is called and
when the button's `disabled={driveState !== "idle"}` takes effect in the DOM (a single
microtask gap). Because `setDriveState` is asynchronous (React state update), the button is
NOT yet disabled during the synchronous tail of the click handler. A second rapid click
before React re-renders will fire `writeToDrive` twice, calling `appendMarkdown` twice and
potentially appending the same markdown block twice to the Drive file.

The `disabled` prop does prevent this after the render, but there is no debounce or
in-flight guard at the function level.

**Evidence-fix:** Add a module-level or `useRef` guard:

```js
const driveWritingRef = useRef(false);
const writeToDrive = async () => {
  if (driveWritingRef.current) return;
  driveWritingRef.current = true;
  setDriveErr(""); setDriveState("writing");
  try {
    const r = await googleDrive.appendMarkdown(markdown, settings, saveSettings);
    if (r.ok) setDriveState("done");
    else { setDriveState("idle"); setDriveErr(r.error || "Write failed."); }
  } finally { driveWritingRef.current = false; }
};
```

---

### Issue D — MINOR: `pruneSent` uses strict less-than (`<`) instead of less-than-or-equal; dedupe entries from exactly 30 days ago are kept forever

**LOCATION:** `push-server/server.js` — `pruneSent` (line ~81)

**SEVERITY:** Minor

**DEFECT:**
```js
function pruneSent(sent, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  for (const key of Object.keys(sent)) if (sent[key] < cutoff) delete sent[key];
}
```

`sent[key]` is the ISO date the notification was sent (e.g., `"2026-05-14"`). The cutoff
is today minus 30 days. An entry sent on exactly the cutoff date satisfies
`sent[key] === cutoff`, which is NOT `< cutoff`, so it is never pruned. This is a
boundary leak, not an off-by-one that causes re-delivery (the dedupe key includes the
`fire` date, which would have to coincide), but the dedupe map grows by one day's entries
perpetually — entries from exactly 30 days ago stay in the store indefinitely.

**Evidence-fix:** Change `< cutoff` to `<= cutoff`.

---

### Issue E — MINOR: `runDue` removes a subscription from `store.data` mid-iteration but the outer `for…of Object.keys(store.data)` loop was already materialised — correct, but `store.save()` is called redundantly

**LOCATION:** `push-server/server.js` — `runDue` (line ~111), specifically lines 128 and 133

**SEVERITY:** Minor

**DEFECT:**  
When a subscription returns 404/410, `store.remove(k)` is called (line 128). `store.remove`
calls `this.save()` immediately (writes the file). Then at the end of `runDue`, line 133
checks `if (sent || pruned) store.save()` and writes the file again. After pruning, `pruned`
is non-zero so the condition is true, causing a redundant sync `fs.writeFileSync`. Under
normal operation this is harmless, but it doubles the I/O for any run where subscriptions
are pruned AND notifications are sent in the same pass.

More importantly: `rec.sent[dedupe] = today` updates the in-memory `rec` object. After
`store.remove(k)` deletes that key from `store.data`, subsequent iterations write to
`rec.sent` on a now-detached object (the previous record). After the `break`, the outer
loop moves to the next key. The detached mutation is harmless (the object is unreachable
and will be GC'd), but the `if (sent || pruned) store.save()` at line 133 saves ONLY the
remaining (non-pruned) records' `sent` fields — the one that was pruned is gone, which is
correct. However, `rec.sent[dedupe] = today; sent++` at line 126 may execute BEFORE the
`break`, meaning we count `sent++` for a subscription we are about to prune. The count
returned includes a notification that was sent to a subscription that was then pruned — a
cosmetic inaccuracy in the return value, not a delivery defect.

**Evidence-fix:** This is cosmetic; no real bug. The double-save is minor I/O waste. To fix the double-save, call `store.save()` only once at the end of `runDue` (remove the `save()` inside `store.remove`), or skip the final `save()` if only pruning occurred (no new `sent` entries in surviving records). The sent-count inaccuracy can be fixed by not incrementing `sent` before the success path commits to a surviving record.

---

## Summary of change-list items

| Item | Status |
|------|--------|
| 1 | Correctly implemented |
| 2 | Mechanically correct; stale-settings bug in `rememberId` (Issue A) is a residual defect of this change |
| 3 | Correctly implemented |
| 4 | Live-read is present; stale-settings dep array in the calling `useEffect` (Issue B) partially undermines the heal-on-open intent |
| 5 | Correctly implemented |
| 6 | Correctly implemented |
| 7 | Correctly implemented |
| 8 | Correctly implemented |
| 9 | Correctly implemented as described; double-fire race (Issue C) is a new defect in this refactor |
| 10 | Correctly implemented |
| 11 | Correct logic; boundary condition (Issue D) is a minor defect |
| 12 | Correctly implemented |
| 13 | Correctly implemented |
| 14 | Correctly implemented |

**Items partially or incompletely implemented: 2 (stale settings write-back in `rememberId`), 4 (stale `settings` closure in dep array).**
