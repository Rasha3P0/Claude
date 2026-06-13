# Maintainability Review — Drive OAuth write-back + VAPID background push

Reviewer remit: maintainability and simplicity only. Security issues noted only where they manifest as a maintainability problem.

---

## Issue 1

**LOCATION:** `index.html` — `PUSH_SUBSCRIPTION_CHANGED` handler inside `App()`, diff hunk around line 1471–1474.

**SEVERITY:** Major

**DEFECT:** The `PUSH_SUBSCRIPTION_CHANGED` handler saves new settings by writing directly to `store` via a raw lambda `(n) => store.set("gc_settings", n)` instead of via the existing `saveSettings` callback that is already in scope. Every other settings mutation in the file goes through `saveSettings` (which calls both `setSettings` and `store.set`). This handler bypasses React state entirely: the in-memory `settings` object held by the `useState` hook is not updated, so after a subscription rotation the component continues to render stale push state (e.g., `settings.push.subscribed` is still the old value) until the user reloads. A future maintainer looking at "why does the UI show push as disconnected right after re-subscribe?" will not find the culprit by searching `saveSettings` — the bug hides inside a single-use lambda that looks superficially like the pattern.

**EVIDENCE/FIX:** Replace
```js
webpush.subscribe(s, (n) => store.set("gc_settings", n));
```
with
```js
webpush.subscribe(s, saveSettings);
```
`saveSettings` is defined in the same component scope and its reference is stable (it is wrapped in `useCallback`). No other change needed.

---

## Issue 2

**LOCATION:** `index.html` — `AlertScreen` component, `mode === "drive"` branch, diff hunk around lines 2269–2293.

**SEVERITY:** Major

**DEFECT:** The two branches of `googleDrive.configured(settings)` duplicate the markdown codebox and Copy button almost verbatim. The only structural difference is: (a) the Drive-configured branch adds a "Write to Drive" primary button and moves "Copy" to a secondary position; (b) the unconfigured branch keeps an "Open Drive" fallback link. Because the two blocks share no sub-component, any future change to the markdown display (e.g., syntax highlighting, a character-count notice, localisation) must be applied in two places. The house style elsewhere avoids this by inverting conditions or hoisting the shared element above the conditional. This pattern will rot immediately the moment the markdown block is touched.

**EVIDENCE/FIX:** Hoist the shared elements above the conditional block and only branch on the button group:

```jsx
{mode === "drive" && (
  <div>
    <h2>Write to Drive</h2>
    <p className="small muted mt8">
      {googleDrive.configured(settings)
        ? "Append this entry to your Drive portfolio log, or copy it."
        : "Copy this to your portfolio dashboard. Connect Google Drive in Settings to write directly."}
    </p>
    <div className="codebox mt12">{markdown}</div>
    {googleDrive.configured(settings) ? (
      <>
        <button className="primary block mt12" disabled={driveState !== "idle"} onClick={writeToDrive}>
          {driveState === "writing" ? "Writing to Drive…" : driveState === "done" ? "Written to Drive ✓" : "Write to Drive"}
        </button>
        {driveErr && <div className="banner warn mt8">{driveErr} Copy it instead.</div>}
        <button className="block mt8" onClick={async()=>{ const ok = await copyText(markdown); setCopied(ok); }}>
          {copied ? "Copied" : "Copy log entry"}
        </button>
      </>
    ) : (
      <>
        <button className="primary block mt12" onClick={async()=>{ const ok = await copyText(markdown); setCopied(ok); }}>
          {copied ? "Copied" : "Copy log entry"}
        </button>
        <button className="block mt8" onClick={()=>window.open("https://drive.google.com","_blank")}>Open Drive</button>
      </>
    )}
    <button className="ghost block mt8" onClick={onClose}>Done</button>
  </div>
)}
```

---

## Issue 3

**LOCATION:** `index.html` — `SettingsTab` component, `connectDrive` / `disconnectDrive` / `enablePush` / `disablePush` handlers; `intMsg` state; all four raw `setTimeout(() => setIntMsg(""), N)` calls at lines 2865, 2869, 2876, 2880.

**SEVERITY:** Major

**DEFECT:** Four distinct magic timeout durations (1600 ms, 2600 ms, 1600 ms, 3200 ms) are hard-coded inline with no named constant and no comment explaining why they differ. The existing `msg` state in the same component uses 1500 ms for comparison. A future maintainer has no way to know whether 2600 vs 3200 is deliberate pacing or an accident, and changing one of them risks introducing a race where a second action fires before the previous message clears (the timeouts are not cancelled before being set). More critically, the `setTimeout` handles are never stored or cancelled: if the user rapidly toggles Drive/Push, stale `setIntMsg("")` calls will blank a newer, still-relevant message. The existing `msg` / `setMsg` pattern in the same component has the same uncancelled-timeout smell but does not share state with `intMsg`, so cross-contamination is not possible there — here it is.

**EVIDENCE/FIX:** Introduce a single named constant and a shared helper that cancels the previous handle before scheduling the next one:

```js
const MSG_DELAY = 2000;
const intTimer = useRef(null);
function flashIntMsg(text) {
  clearTimeout(intTimer.current);
  setIntMsg(text);
  intTimer.current = setTimeout(() => setIntMsg(""), MSG_DELAY);
}
```

Replace every `setIntMsg(...); setTimeout(() => setIntMsg(""), N)` pair with a single `flashIntMsg(...)` call. Add `useEffect(() => () => clearTimeout(intTimer.current), [])` to clean up on unmount. Delete the four raw `setTimeout` calls and the varying magic numbers.

---

## Issue 4

**LOCATION:** `index.html` — `webpush` object, `scheduleBody` method, diff hunk around lines 278–285.

**SEVERITY:** Minor

**DEFECT:** `scheduleBody` calls `loadMilestones()` and `todayStr()` directly — both are module-level functions with side effects (localStorage reads). This couples a plain data-formatting helper to the localStorage API and to the `effectiveFire` utility without any of that being visible from its call sites (`subscribe`, `syncSchedule`). The method signature advertises `(settings, sub)` but invisibly depends on two more globals. This is invisible coupling: a future maintainer adding a test harness, or extracting `webpush` into a module, will discover the hidden dependencies only at runtime. `googleDrive.appendMarkdown` takes `text` as an explicit argument; `scheduleBody` should follow the same pattern.

**EVIDENCE/FIX:** Change the signature to accept milestones explicitly:

```js
scheduleBody(settings, sub, milestones) {
  return JSON.stringify({
    subscription: sub,
    milestones: milestones
      .map(m => ({ id: m.id, name: m.name, project: m.project, action: (m.action || "").slice(0, 140), fire: effectiveFire(m, todayStr()) }))
      .filter(x => x.fire)
  });
},
```

At both call sites (`subscribe`, `syncSchedule`) pass `loadMilestones()` explicitly. `effectiveFire` and `todayStr` remain utilities rather than hidden dependencies of `scheduleBody` itself.

---

## Certification

Four distinct issues are found. No further issues of Major or Critical severity exist. There are no dead-code additions (the new constants are used, migrations are wired) and no naming inconsistencies beyond those reported. The `loadScriptOnce` helper, the `clamp` utility in `sw.js`, the `runDue` scheduler, the store interface, and the migration block in `seedIfNeeded` are all clear and idiomatic within the established house style.
