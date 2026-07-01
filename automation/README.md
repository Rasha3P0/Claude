# Portfolio Automation — Ground Control

Read-only, **draft-and-surface** automation around the portfolio dashboard. It
monitors, reconciles, and drafts — it **never** places, modifies, or cancels a
trade. Final calls are the user's.

> **Source of truth:** the dashboard markdown (`portfolio_dashboard_vNN.md`),
> canonical copy in Google Drive. A frozen seed of v29 is in `baseline/`.
> This repo holds the **logic**; Drive holds the **outputs**.

---

## The five non-negotiable rules (encoded everywhere)

1. **Never execute.** No placing/modifying/cancelling orders, ever. Draft and
   surface; the user commits.
2. **Always fetch prices fresh** at run time — never cache, never trust a dashboard
   figure. US equities in UK morning: triangulate **>= 2** live sources, discard
   stale outliers.
3. **Verify ticker → fund name → underlying** before referencing any fund.
4. **Dashboard edited only via file tools:** view exact strings first, targeted
   edits, **changelog every change**, and **preserve honest caveats / logged
   deviations verbatim** — never rewrite a deviation into a clean rule.
5. **Automation drafts a new version; it does not overwrite.** User reviews and commits.

---

## The three routines

| Routine | When | Output | File |
|--------|------|--------|------|
| **Daily skeleton monitor** | each UK trading day | quiet 1-line log, or a TRIGGERED re-underwrite alert | `runbooks/daily_skeleton_monitor.md` |
| **Monthly check-in** (draft) | 1st of month | spec-cap maths, bucket split + breaches, UK macro, renewal countdown, changelog stub | `runbooks/monthly_checkin.md` |
| **Reconcile / mark-to-market** | on demand + monthly | full m2m, drift/breach flags, **DRAFT next-version dashboard** | `runbooks/reconcile_m2m.md` |

- **Skeleton trigger** (both legs): an index (S&P 500 or FTSE 100) **>= 10% below
  its trailing 3-month high** **AND** **VIX >= 28**. Triggered = "re-underwrite
  KO/GSK/LSEG", **not** a buy. Quiet days stay silent.
- Data/rules live in `data/framework_params.json` and `data/holdings_registry.json`.
- Output format is fixed in `DRIVE_OUTPUT_FORMAT.md` (mirrored to Drive).

---

## How "scheduled" works (chosen mechanism: Claude Code web triggers)

This container is ephemeral — nothing runs here on a timer by itself. The durable
scheduler is **Claude Code on the web scheduled triggers**, each starting a session
with web + Drive access that executes a runbook. **These must be created in the web
UI** (they can't be set from inside a session). Set up:

1. **Daily skeleton** — schedule: each weekday, ~07:30 Europe/London. Prompt:
   > Execute `automation/runbooks/daily_skeleton_monitor.md` against the canonical
   > dashboard in Drive. Follow it exactly. Fetch prices fresh.
2. **Monthly check-in + reconcile** — schedule: 1st of month, ~08:00 Europe/London.
   Prompt:
   > Execute `automation/runbooks/reconcile_m2m.md`, then
   > `automation/runbooks/monthly_checkin.md`, against the canonical dashboard in
   > Drive. Follow them exactly. Fetch prices and macro fresh. Drafts only.

Adjust times to taste. On-demand reconcile: just ask a session to run the reconcile
runbook.

See `docs/SETUP.md` for step-by-step trigger wiring.

---

## Alerts (setting: log + push + email)

- **Quiet runs are silent** — log entry only.
- **On a skeleton trigger or any band/ceiling breach:** phone **push** + a **Gmail
  draft** to `nirbras@gmail.com`. (The Gmail connector can only *draft*, not send —
  so the email is a durable alert in your Drafts; the push is the live ping.)
- Alerts never contain sizing or execution — skeleton alerts say "re-underwrite".

---

## Known environment constraints (probed 17 Jun 2026)

- **Live prices:** WebSearch works; WebFetch is host-dependent (FRED/Yahoo OK,
  Stooq returned 403). Runbooks triangulate across what works.
- **Drive is create-only** — no update-in-place, no delete. Hence the append-only
  log is a **folder of immutable dated files** (`automation_log/`), not one growing
  file (see `DRIVE_OUTPUT_FORMAT.md` §0). Two `_probe_delete_me.md` test files were
  left in the Drive folder by the probe — delete them by hand in the Drive UI.
- **Baseline can't be auto-uploaded.** The 117 KB v29 exceeds the connector's
  inline-content limit and there is no upload-from-file, so the user places
  `portfolio_dashboard_v29.md` in the Drive folder (or lets the first reconcile
  bootstrap from `baseline/`). See `docs/SETUP.md` and the in-folder
  `_PLACE_v29_BASELINE_HERE.md`.
- **Gmail is draft-only** (no send) — see Alerts above.

---

## Layout

```
automation/
├── README.md                       <- this file
├── DRIVE_OUTPUT_FORMAT.md          <- the stable output contract (mirrored to Drive)
├── docs/SETUP.md                   <- how to wire the web triggers
├── runbooks/
│   ├── daily_skeleton_monitor.md
│   ├── monthly_checkin.md
│   └── reconcile_m2m.md
├── data/
│   ├── framework_params.json       <- numeric rules (bands, ceilings, skeleton)
│   └── holdings_registry.json      <- ticker/identity/classification (v29 seed)
└── baseline/
    └── portfolio_dashboard_v29.md  <- frozen verbatim seed (live canonical is in Drive)
```
