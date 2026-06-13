# Adjudication v2 → DECISION: ITERATE (build v3) — this is loop 3 (the cap)

Adjudicator (Opus). v2 re-review: correctness (5 findings) + adversary (6 findings).
Verdict on v1 fixes: all 14 mechanically present; #6/#12 fully effective; #7/#13
partially effective (addressed below); #2/#4 correct-but-improvable. Two new Majors
(duplicate Drive write; sensitive action text at-rest on server) → ITERATE once more.

Per the cap (3 loops): after applying v3 below, STOP and CONVERGE — no 4th reviewer
round (diminishing returns + budget; harness §7/§9). v3 is final polish.

## Rulings (v2 findings)
| # | Remit | Sev | Ruling | Reason |
|---|-------|-----|--------|--------|
| Cv2-1 rememberId stale settings | corr | Major | **ACCEPT (Minor)** | Real clobber risk; trivial fresh-read fix. Persisted fileId is still read on reload, so impact < claimed. |
| Cv2-2 syncSchedule stale closure | corr | Major | **ACCEPT (Minor)** | `subscribe()` already posts schedule on enable (critical path intact); fresh-read removes the smell. |
| Cv2-3 writeToDrive double-click → double append | corr | Major | **ACCEPT (Major)** | Real, user-visible duplicate Drive entry. Needs a synchronous in-flight guard. |
| Cv2-4 pruneSent strict `<` | corr | Minor | **ACCEPT** | Trivial: use `<=`. |
| Cv2-5 runDue double-save / counter | corr | Minor | **REJECT** | Suggested fix (drop save from `store.remove`) would break `/unsubscribe` durability; double-write is rare + negligible. |
| Sv2-1 ADMIN_TOKEN no startup guard | sec | Major | **ACCEPT (as warning)** | `/send` is optional (built-in tick works); exit would over-constrain. Warn at startup that `/send` is disabled. |
| Sv2-2 full `action` text stored at-rest on server | sec | Major | **ACCEPT (Major)** | Real data-minimization gap: exact buy/sell instructions in `subs.json`. Stop sending `action`; generic body; keep `name` as title. |
| Sv2-3 safeEqual length oracle | sec | Minor | **ACCEPT** | Compare SHA-256 digests (constant length) — removes the leak cleanly. |
| Sv2-4 SW guard controller-null pass-through | sec | Minor | **ACCEPT** | Add `ev.source instanceof ServiceWorker` before the controller match. |
| Sv2-5 SW message listener no cleanup | sec | Minor | **ACCEPT** | Name the handler; remove it in effect cleanup. |
| Sv2-6 `/health` emits sub count | sec | Minor | **ACCEPT (light)** | Drop the count; keep `ok` + public key (public by design). |

## DEFER (note in final_notes)
- Per-record milestones-array size: already bounded by the 16KB body limit; explicit
  length cap deferred as redundant.
- Residual: `name`/`project`/`fire` still stored server-side (needed for a useful
  notification + scheduling). Documented as the accepted minimum.

---

# CHANGE LIST for v3 (ordered must-fix; final polish at the loop cap)

1. **[Major · dup write] `index.html` `AlertScreen.writeToDrive`.** Add a `useRef`
   in-flight guard checked synchronously at the top (return if already writing);
   clear it when the call settles. Prevents a double-click from appending twice
   before `driveState` disables the button.
2. **[Major · data minimization] Drop `action` from the server.**
   - `index.html` `webpush.scheduleBody`: send `{id, name, project, fire}` only — no `action`.
   - `push-server/server.js` `runDue`: build the notification body from a fixed
     string ("Open Ground Control to review the action."), title stays `name`.
   - `push-server/README.md`: note the server stores id/name/project/fire + the
     subscription, never the detailed action text.
3. **[Minor · stale settings] `index.html` `rememberId`.** Merge `fileId` into
   `store.get("gc_settings", settings)` (fresh), not the captured `settings`.
4. **[Minor · stale closure] `index.html` scheduling effect.** Call
   `webpush.syncSchedule(store.get("gc_settings", settings))` for the freshest settings.
5. **[Minor · timing] `push-server/server.js` `safeEqual`.** Compare SHA-256 digests
   of the two tokens (always 32 bytes) so token length isn't leaked.
6. **[Minor · SW guard] `index.html` message handler.** `if (!(ev.source instanceof
   ServiceWorker)) return;` then, if `navigator.serviceWorker.controller` is set,
   require `ev.source === controller`.
7. **[Minor · listener leak] `index.html` SW effect.** Name the message handler and
   return a cleanup that `removeEventListener`s it.
8. **[Minor · prune boundary] `push-server/server.js` `pruneSent`.** `sent[key] <= cutoff`.
9. **[Minor · startup] `push-server/server.js`.** If `ADMIN_TOKEN` is unset, log a
   startup warning that `POST /send` is disabled (built-in tick still runs). No exit.
10. **[Minor · disclosure] `push-server/server.js` `/health`.** Drop the
    `subscriptions` count; return `{ ok, publicKey }`.
