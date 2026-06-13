# Decision log — v2 (ADJUDICATOR ONLY; reviewers must not see this)

## What this iteration did
Implemented all 14 must-fix items from change_list_v1.md. No deferred item was
pulled in. Syntax verified (prettier on the JSX block; `node --check` on sw.js and
server.js). No live-endpoint testing possible in-sandbox (unchanged from v1).

## Notes on specific fixes (where I made a judgement call)
- **Item 13 (ev.source guard):** the reviewer's stated vector — a same-origin
  `window.postMessage` spoofing `PUSH_SUBSCRIPTION_CHANGED` — does NOT actually reach
  a `navigator.serviceWorker`-scoped message listener (window messages fire
  `window.onmessage`, a different event target). So this guard is defence-in-depth,
  not a vuln fix. Implemented LENIENTLY (`ev.source && controller && mismatch → drop`)
  so it can't regress the legitimate `NOTIFICATION_CLICK` path when `controller` is
  briefly null (first load / uncontrolled). Honest framing, real hardening, no regression risk.
- **Item 1 (read-failure abort):** a freshly created metadata-only file returns 200
  with an empty body on `alt=media`, so the `!cur.ok` abort does not misfire on the
  legitimate first write; empty-body-200 still seeds the header.
- **Item 4 (live subscription):** chose page-open reconciliation over SW-side direct
  re-registration (deferred). After a rotation while closed, the stale server record
  self-heals on next open and the dead endpoint is pruned on the server's next send
  (404/410). The only gap is pushes between rotation and next open — identical to the
  already-documented "schedule is only as fresh as the last open" limitation.
- **Item 2 (module fileId cache):** also moots the rejected A1 — even if `files.list`
  behaved unexpectedly, consecutive writes now reuse the cached id without a search.

## 2–3 weakest / most-likely-wrong points (honest)
- **W1 — Live behaviour still unverified.** Same as v1 W3: the GIS token callbacks,
  the Drive REST sequence, and `web-push` delivery have not run against real Google /
  push endpoints (sandbox blocks the CDN; no OAuth client / push service). Everything
  is to documented contracts and syntactically clean, but a real-environment smoke
  test is required before trusting it. This is the single biggest residual risk.
- **W2 — Reference server auth is intentionally partial.** `/subscribe` and
  `/unsubscribe` remain unauthenticated by design (browsers self-register). Cap +
  fail-closed CORS + body limit blunt the DoS, but a party who learns a subscription
  endpoint URL can still overwrite/delete that record. Accepted + documented for a
  single-user self-host; would be Critical for a public multi-tenant deployment.
- **W3 — `flashIntMsg`/`holdIntMsg` timer is per-mount.** If the user triggers an
  async op (e.g. enable push) and switches tabs before it resolves, the result
  `flashIntMsg` runs after unmount → a no-op `setIntMsg` on an unmounted component
  (React warns, harmless). The unmount cleanup clears the pending CLEAR timer but not
  an in-flight await. Low impact; noted for completeness.

## Convergence expectation
All accepted v1 issues addressed. Remaining items are deferred-by-design or the
inherent live-validation gap. Expect CONVERGED unless v2 reviewers find a NEW
Major/Critical (e.g. a regression from the refactors in items 9/10/2).
