# Ground Control — Portfolio Automation Handover

**Last updated:** 2026-06-19 (after schema v2 runbook was deployed)
**Repo:** `Rasha3P0/Claude` | **Branch:** `claude/sweet-mayer-d1yhce`
**Drive folder:** "Ground Control - Portfolio Automation"
  — folder ID: `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo`
  — log subfolder ID: `1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI`

Give this file plus `automation/runbooks/daily_skeleton_monitor.md` to a new
session. Between them they contain everything needed to run the skeleton routine
correctly and continue the project without repeating mistakes.

---

## 1. What this project is

A **daily macro crash-deploy monitor** for a UK Stocks & Shares ISA (Freetrade
Basic, ISA value ~£13,661 as of Jun 2026). The skeleton routine is the first
and only live automation as of this writing. Two further routines are planned but
not yet implemented: `checkin` and `reconcile`.

**The skeleton routine's single job:** check whether a macro crash-deploy
condition is live. If it is, alert the owner to re-underwrite three watchlist
names (KO, GSK, LSEG). Nothing else. It never suggests a buy, a size, or a
price. "Alert" means "go look at the fundamentals" — the human decides.

**This is not a trading system.** Nothing in automation_log has ever placed,
sized, or suggested a trade. All logs are read-and-draft only.

---

## 2. Trigger condition

Both legs must be simultaneously true for `macro_leg_live = true`:

```
index_leg = true  if S&P 500 OR FTSE 100 is ≥10% below its trailing-3-month high
vix_leg   = true  if VIX ≥ 28
macro_leg_live = (index_leg AND vix_leg)
```

Trigger floor for each index = `3mo_high × 0.90`. Show this floor in every log.

Trailing 3-month window = run_date minus 91 calendar days. The 3-month high must
fall strictly inside this window. The FTSE 100 all-time high (~10,750, Feb 25
2026) is OUTSIDE the window as of June 2026 and must NOT be used.

If triggered: action is "re-underwrite KO/GSK/LSEG — verify weakness is
broad/market-driven and fundamentals are intact, then a human decides."
Candidate target zones are still OPEN (unset) as of June 2026.

---

## 3. Runbook

File: `automation/runbooks/daily_skeleton_monitor.md` (in this repo, this branch).

**Schema version: 2** (deployed 2026-06-19). Follow this exactly. Six steps:

1. **Heartbeat check** — list automation_log, find last valid run, flag missing
   trading days.
2. **Fetch data** — S&P 500 level + 3-month high, FTSE 100 level + 3-month high,
   VIX level. Fetch ALL fresh every run.
3. **Silent-failure guard** — each figure must be confirmed by ≥2 independent
   live sources. If any figure fails: `status: error` or `data_incomplete`, not
   `quiet`. **`quiet` is a positive assertion — it must be earned.**
4. **Evaluate legs** — only when all three figures confirmed.
5. **Decide status** — `quiet` / `alert` / `data_incomplete` / `error`.
6. **Write log** — Drive `automation_log/YYYY-MM-DD_HHMM_skeleton.md`.

The full step-by-step text with all front-matter keys is in the runbook file.
Do not paraphrase it — follow it exactly.

---

## 4. Drive folder structure

```
Ground Control - Portfolio Automation/   (ID: 18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo)
├── README_FORMAT.md                     parse contract for the folder
├── _PLACE_v29_BASELINE_HERE.md          placeholder — see §8 below
└── automation_log/                      (ID: 1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI)
    ├── 2026-06-17_1946_skeleton.md      VALID (schema v1, inaugural run)
    ├── 2026-06-18_1946_skeleton.md      ** INVALID — see §6 **
    ├── 2026-06-19_1946_skeleton.md      ** INVALID — see §6 **
    └── 2026-06-19_2015_skeleton.md      VALID (schema v2, authoritative)
```

**Drive connector is create-only** — no update, no delete. Every log file is
immutable once written. Invalid files cannot be removed; they must be ignored by
filename/schema. When listing logs for heartbeat purposes, treat any file that
fails schema v2 front-matter parsing, or that is explicitly flagged INVALID in a
later log, as non-existent for gap-detection purposes.

---

## 5. Log file validity table (as of 2026-06-19)

| Filename | Schema | Status logged | Valid? | Notes |
|---|---|---|---|---|
| 2026-06-17_1946_skeleton.md | v1 | quiet | YES (v1 era) | Inaugural run. v1 schema was current then. Treat as valid history. |
| 2026-06-18_1946_skeleton.md | v1 | quiet | **NO** | Written before official runbook loaded. Used Jun 17 intraday data as if current; did not perform heartbeat check; `quiet` logged without ≥2-source confirmation per v2 standard. June 18 is UNMONITORED. |
| 2026-06-19_1946_skeleton.md | v1 | quiet | **NO** | Another pre-runbook attempt. VIX figure (18.44) was the Jun 17 close, incorrectly treated as Jun 18/19 current. `quiet` logged without ≥2-source confirmation per v2 standard. |
| 2026-06-19_2015_skeleton.md | v2 | data_incomplete | YES | Authoritative Jun 19 run. US markets closed (Juneteenth). FTSE Jun 19 current from 1 source only → null. VIX confirmed (binding constraint: 16.40 < 28). Heartbeat gap for Jun 18 flagged. |

**For heartbeat purposes:** last VALID run = **2026-06-17**. The next run should
flag 2026-06-18 as a missed trading day unless a valid v2 run for that date is
subsequently added (it cannot be, since Drive is create-only and the slot is
occupied by an invalid file).

---

## 6. Current market context (as of 2026-06-19)

All figures below are the most recently confirmed values. Use them as context
only — fetch fresh on the next run.

| Figure | Value | Date | Notes |
|---|---|---|---|
| S&P 500 | 7,500.58 | Jun 18 close | +1.08% recovery after FOMC sell-off |
| S&P 500 3-month high | ~7,600 | Set ~Jun 2 | First cross of 7,600; within trailing window |
| S&P 500 trigger floor | 6,840 | — | 7,600 × 0.90 |
| FTSE 100 | 10,399.70 | Jun 18 close | -1.0%; BoE held rates at 3.75% (hawkish hold) |
| FTSE 100 3-month high | 10,504 | Jun 17 | Jun 19 may be marginally higher (unconfirmed) |
| FTSE 100 trigger floor | 9,454 | — | 10,504 × 0.90 |
| VIX | 16.40 | Jun 18 close | Down from 18.44 (Jun 17 close) as equities recovered |
| index_leg | false | — | S&P -1.3% from high; FTSE null Jun 19 (BoE day) |
| vix_leg | false | — | 16.40 << 28; binding constraint |
| macro_leg_live | false | — | — |

**Macro backdrop:** Jun 16-17 FOMC (Chair Warsh's first press conference) showed
hawkish dot-plot — 9/18 Fed officials favour ≥1 rate hike in 2026. S&P fell 1.21%
on Jun 17 (7,420.10), partially recovered Jun 18 (+1.08%, chips/tech rally, Iran
ceasefire). BoE held at 3.75% Jun 18 — hawkish hold weighed on FTSE. VIX spiked
to 18.44 on Jun 17 close then fell back to 16.40. None of this is remotely near
the trigger condition.

---

## 7. Data source notes (hard-won)

### Works reliably

- **WebSearch tool** with specific queries ("S&P 500 close [date]", "FTSE 100
  [date] close", "VIX CBOE [date]") — triangulate across ≥2 results.
- **TheStreet** daily market recap articles (`stock-market-today` URL slug) —
  reliable for confirmed US closes with specific levels.
- **Yahoo Finance** market articles — reliable for FTSE (UK/intl recap articles),
  VIX, and US closes.
- **Trading Economics / IG / Reuters** via search — good for FTSE intraday.
- **Schwab market update** — good for US daily recap, specific closes.

### Does NOT work / unreliable

- **FRED VIXCLS direct fetch** — returns HTTP 403. Do not attempt direct URL
  fetch; use WebSearch instead.
- **WebFetch on financial sites** (CNBC, Yahoo Finance, macrotrends, IG,
  streetstats) — most return HTTP 403. Use WebSearch only.
- **Search AI summaries can swap S&P 500 and Nasdaq levels.** The indices have
  very different magnitudes (S&P ~7,400-7,600; Nasdaq ~25,000-27,000) — use
  magnitude to identify which is which when the summary mislabels them. Always
  cross-check with the Dow (+/- points) for consistency.
- **Single search result summaries can hallucinate specific levels.** The figure
  "26,517.93" appeared once as the S&P 500 close — it was actually the Nasdaq.
  Discard any level that conflicts with known index magnitude ranges.

### 3-month high methodology

Fetch fresh every run. Do NOT copy from a prior log or the dashboard. The trailing
window is run_date − 91 days. Search for "S&P 500 high [month] [year]" and
"FTSE 100 high [month] [year]" and verify the date of the high falls within the
window. The FTSE Feb 25 2026 all-time high (~10,750) is outside the window for any
run date in June 2026 or later.

### Holiday handling

US holidays (Juneteenth, Independence Day, Labour Day, etc.): NYSE/Nasdaq/VIX
closed. Holiday exception: use the confirmed prior-session close for S&P 500 and
VIX, labelled explicitly in `sources` and notes. **LSE is NOT closed on US
holidays** — FTSE must be fetched as a live figure on those days. If only one
source is available for FTSE on a US holiday (when search attention skews to US),
log as `data_incomplete`.

UK bank holidays: LSE closed, FTSE carries prior-session close (holiday
exception). US markets usually open; fetch S&P and VIX fresh.

Do NOT flag weekends or confirmed holidays as heartbeat gaps.

---

## 8. Canonical dashboard (not yet present)

The Drive folder should contain `portfolio_dashboard_vNN.md` — the source-of-truth
portfolio snapshot. As of June 2026, only a placeholder exists
(`_PLACE_v29_BASELINE_HERE.md`). The baseline file `portfolio_dashboard_v29.md`
is version-controlled at `automation/baseline/portfolio_dashboard_v29.md` in this
repo (the file does not yet exist in the repo either — it has not been uploaded).

**The skeleton routine does NOT read the dashboard.** It fetches all data live.
The dashboard absence does not block skeleton runs.

When the dashboard does exist: the highest-versioned `portfolio_dashboard_vNN.md`
WITHOUT a `_DRAFT` suffix is the canonical one. DRAFT files are proposals from
the `reconcile` routine awaiting human review.

---

## 9. Portfolio allocation context

ISA value: ~£13,661 (Jun 2026). Freetrade Basic. GBP.

| Sleeve | Target | Band |
|---|---|---|
| Quality + dividend | 55-60% | — |
| Gilts | ~20% | — |
| Spec total | 10-15% | — |
| — Spec sensible sub-pot | 10% target | 9-11% |
| — Spec risky sub-pot | 5% target | 4-6% |
| Cash (withdrawable) | 3-5% | ≤5% |

Watchlist names for crash-deploy: **KO, GSK, LSEG** (re-underwrite on trigger;
never a buy signal — human decides after reviewing fundamentals).

Active milestones (from app): SMGB DCA July tranche (Jul 31), SOUN limit sell
check (Jun 30), T-bill maturity/roll (Jul 1), UNH Q2 (Jul 10), RIOL→VFEM
rotation (Jul 25). See `GROUND_CONTROL_BUILD_BRIEF.md` §7 for full list.

---

## 10. Repo file map (automation-relevant)

```
automation/
├── HANDOVER.md                         this file
├── runbooks/
│   └── daily_skeleton_monitor.md       official runbook (schema v2)
└── baseline/                           (empty — v29 baseline not yet uploaded)
```

The main app (`index.html`, `sw.js`, etc.) lives in the repo root and is a
separate concern — see `GROUND_CONTROL_BUILD_BRIEF.md` for the app handover.

---

## 11. Hard rules (non-negotiable)

- **Never suggest, size, or price a trade.** Alert = "go re-underwrite." Full stop.
- **Never log `status: quiet` without ≥2 confirmed sources for ALL three figures.**
  Quiet is a positive assertion; it must be earned. Unconfirmed data → `data_incomplete`.
- **Never carry a stale figure forward as current** without labelling it as a
  confirmed holiday-exception close.
- **Never treat a weekend or bank holiday as a heartbeat gap.** Only flag missing
  trading days.
- **Never read 3-month highs from a prior log or the dashboard.** Always fetch fresh.
- **Never include a "near-miss" watch** ("VIX getting close to 28…"). The binary
  trigger is deliberate — this guards against action-bias.
- **The Drive connector is create-only.** Never attempt to update or delete a log
  file. Invalid files persist; document them, don't try to remove them.

---

## 12. What the next run should do

Next valid run date: **2026-06-20 (Saturday)** — NOT a trading day. Next trading
day is **Monday 2026-06-22**.

On 2026-06-22 run:
1. Heartbeat check: list automation_log. Last valid run = 2026-06-17 (v1) or
   2026-06-19 2015 (v2). Valid v2 files for 2026-06-18 and 2026-06-19 1946 do NOT
   exist (those files are schema v1 and flagged invalid). Flag 2026-06-18 as a
   missed run (already documented in 2026-06-19_2015). The 2026-06-19 gap is
   technically `data_incomplete` (not a clean quiet), but no valid v2 skeleton log
   covers it either. For simplicity: last fully clean run = 2026-06-17; flag
   2026-06-18 as previously documented missed run; note Jun 19 was
   `data_incomplete` (documented in 2026-06-19_2015); Jun 20-21 are weekend.
2. Fetch fresh S&P 500, FTSE 100, VIX for June 22.
3. Confirm ≥2 sources each. Evaluate legs. Write v2 log.
