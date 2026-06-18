# Daily Skeleton Monitor — Runbook

**Routine:** `skeleton`
**Schedule:** Daily (any time; typically evening BST)
**Output:** One log file in Drive `automation_log/` folder per run

---

## Purpose

Check macro trigger conditions that would require re-underwriting the KO / GSK / LSEG
positions. Does NOT suggest sizing or execution. Never a buy signal.

**Trigger = BOTH legs live simultaneously:**
- **Index leg:** at least one index (S&P 500 or FTSE 100) is ≥10% below its trailing
  3-month closing high
- **VIX leg:** CBOE VIX ≥ 28

If triggered: re-underwrite KO/GSK/LSEG (reassess hold thesis, candidate target zones).
Candidate target zones remain OPEN (unset) until a triggered reassessment sets them.

---

## Inputs

1. **S&P 500** — current level + trailing 3-month closing high (fetch fresh, ≥2 sources)
2. **FTSE 100** — current level + trailing 3-month closing high (fetch fresh, ≥2 sources)
3. **VIX (CBOE)** — current level (fetch fresh, ≥2 sources)

> Always fetch the 3-month highs fresh from web sources. Do NOT copy from the
> dashboard — the dashboard may lag. Trailing 3 months = today minus 91 days.

---

## Evaluation

```
sp500_pct_from_high  = (sp500_level  - sp500_3mo_high)  / sp500_3mo_high  * 100
ftse100_pct_from_high = (ftse100_level - ftse100_3mo_high) / ftse100_3mo_high * 100

index_leg  = (sp500_pct_from_high <= -10) OR (ftse100_pct_from_high <= -10)
vix_leg    = vix >= 28
macro_leg_live = index_leg AND vix_leg
status     = "TRIGGERED" if macro_leg_live else "quiet"
```

---

## Log format (Drive `automation_log/YYYY-MM-DD_HHMM_skeleton.md`)

HHMM is local BST (UTC+1). File is immutable once written (Drive connector is
create-only). Schema version 1.

```yaml
---
schema_version: 1
routine: skeleton
run_timestamp: <ISO-8601 with TZ offset>
run_date: <YYYY-MM-DD>
status: quiet | TRIGGERED
sp500_level: <number>
sp500_3mo_high: <number>
sp500_pct_from_high: <number, 1dp>
ftse100_level: <number>
ftse100_3mo_high: <number>
ftse100_pct_from_high: <number, 1dp>
vix: <number, 1dp>
index_leg: true | false
vix_leg: true | false
macro_leg_live: true | false
sources: [<source_1>, <source_2>, ...]
alert_sent: []   # or ["gmail_draft"] if TRIGGERED
---

<YYYY-MM-DD> — Skeleton <status>. <One-line human summary of levels and why.>
```

---

## Decision tree

### Quiet (macro_leg_live = false)

1. Write the log file to Drive `automation_log/`.
2. No Gmail draft. No push notification. No repo commit required.

### TRIGGERED (macro_leg_live = true)

1. Write the log file to Drive `automation_log/`.
2. **Create a Gmail draft** to `nirbras@gmail.com`:
   - Subject: `[Ground Control] TRIGGER — re-underwrite KO/GSK/LSEG`
   - Body: current levels, which leg(s) are live, instruction to reassess hold
     thesis on KO/GSK/LSEG. Never suggest sizing or execution.
3. **Push notification** to user via PushNotification tool.
4. **Commit** the log snapshot to the repo on branch `claude/sweet-mayer-d1yhce`
   under `automation/log_snapshots/` and push.

---

## Rules

- **Never suggest sizing or execution** — this is a re-underwrite flag only.
- Never copy 3-month highs from the dashboard; always fetch live.
- Triangulate each data point across ≥2 independent sources.
- If a source returns an error (e.g. 403), note it in `sources` and use alternates.
- The canonical dashboard (`portfolio_dashboard_vNN.md` in the Drive folder) is
  read-only context for this routine — it is NOT modified by the skeleton monitor.
- If no canonical dashboard exists in Drive (only a placeholder), proceed using
  live-fetched data only.
