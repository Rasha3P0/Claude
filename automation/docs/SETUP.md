# Setup — wiring the scheduled triggers + Drive

One-time steps. After this, the routines run themselves and write to Drive.

## 1. Google Drive
A dedicated folder already exists: **"Ground Control - Portfolio Automation"**
(My Drive), id `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo`. It is seeded with:
- `portfolio_dashboard_v29.md` — canonical baseline (source of truth).
- `README_FORMAT.md` — the output contract the routines follow.
- `automation_log/` — dated entry files (the append-only log).

**Tidy-up:** delete the two `_probe_delete_me.md` files by hand (the Drive
connector has no delete tool, so they were left by the create-only probe).

**Promoting a draft:** when a reconcile writes `portfolio_dashboard_vNN_DRAFT.md`,
review it, then save/rename it as `portfolio_dashboard_vNN.md` to make it canonical.
The automation never promotes a draft itself.

## 2. Claude Code on the web — scheduled triggers
Create two triggers (Claude Code web UI → this repo/environment → Triggers /
Schedules). They start a session with web + Drive + Gmail access and run a runbook.

**Trigger A — Daily skeleton**
- Schedule: weekdays, 07:30 Europe/London (adjust freely).
- Prompt:
  ```
  Execute automation/runbooks/daily_skeleton_monitor.md against the canonical
  dashboard in the Drive folder "Ground Control - Portfolio Automation". Follow it
  exactly. Fetch S&P 500 / FTSE 100 / VIX fresh and triangulate. Quiet days: log one
  line, no alerts. Trigger: log + push + Gmail draft. Never suggest sizing/execution.
  ```

**Trigger B — Monthly check-in + reconcile**
- Schedule: day 1 of each month, 08:00 Europe/London.
- Prompt:
  ```
  Execute automation/runbooks/reconcile_m2m.md, then automation/runbooks/
  monthly_checkin.md, against the canonical dashboard in the Drive folder "Ground
  Control - Portfolio Automation". Fetch all prices, FX and UK macro fresh. Produce a
  DRAFT next-version dashboard (do not overwrite canonical) and a changelog stub.
  Drafts only. Alerts on breach = log + push + Gmail draft.
  ```

## 3. On-demand reconcile
Open a session any time and say:
```
Run automation/runbooks/reconcile_m2m.md now. Here is my current broker total: £____.
```
Providing a broker figure lets it compute drift.

## 4. Alerts
Setting = **log + push + email**. Quiet runs stay silent. On a skeleton trigger or a
band/ceiling breach: phone push + a Gmail **draft** to nirbras@gmail.com (Gmail
connector drafts only; the push is the live ping). To test the channels, ask a
session to "send a test Ground Control alert".

## 5. Keeping the seed data current
When you commit a new canonical dashboard after trades, update
`automation/data/holdings_registry.json` (shares/holdings) and, if the framework
changes, `automation/data/framework_params.json`. The Drive dashboard always wins
over these convenience files.
