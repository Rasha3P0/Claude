# Ground Control — Portfolio Automation Handover

**Last updated:** 2026-06-25 (runs Jun 20–25 logged; dashboard now v33; CBOE CSV 403 confirmed)
**Repo:** `Rasha3P0/Claude` | **Branch:** `claude/sweet-mayer-bvmgik`
**Drive folder:** "Ground Control - Portfolio Automation"
  — folder ID: `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo`
  — log subfolder ID: `1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI`

Give this file plus `automation/runbooks/daily_skeleton_monitor.md` to a new
session. Between them they contain everything needed to run the skeleton routine
correctly and continue the project without repeating mistakes.

---

## 1. What this project is

A **daily macro crash-deploy monitor** for a UK Stocks & Shares ISA (Freetrade
Basic, ISA value ~£13,870 as of Jun 24 2026). The skeleton routine is the first
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
├── HANDOVER_2026-06-19_post-cutover.md  prior handover (superseded)
├── README_FORMAT_2026-06-19.md          parse contract for the folder
└── automation_log/                      (ID: 1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI)
    ├── 2026-06-17_1946_skeleton.md      VALID (schema v1, inaugural run)
    ├── 2026-06-19_2015_skeleton.md      VALID (schema v2)
    ├── 2026-06-20_0900_skeleton.md      VALID (schema v2, weekend run)
    ├── 2026-06-21_1000_skeleton.md      VALID (schema v2, quiet — last clean run)
    ├── 2026-06-22_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-23_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-24_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-24_1200_skeleton.md      VALID (schema v2, data_incomplete — resolved VIX)
    └── 2026-06-25_1000_skeleton.md      VALID (schema v2, data_incomplete — this run)
```

**Drive connector is create-only** — no update, no delete. Every log file is
immutable once written. Invalid files cannot be removed; they must be ignored by
filename/schema. When listing logs for heartbeat purposes, treat any file that
fails schema v2 front-matter parsing, or that is explicitly flagged INVALID in a
later log, as non-existent for gap-detection purposes.

---

## 5. Log file validity table (as of 2026-06-25)

| Filename | Schema | Status | Valid? |
|---|---|---|---|
| 2026-06-17_1946_skeleton.md | v1 | quiet | YES (v1-era inaugural) |
| 2026-06-18 | — | — | NO VALID RUN (missed trading day; documented in Jun 19 log) |
| 2026-06-19_2015_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-20_0900_skeleton.md | v2 | data_incomplete | YES (weekend; expected) |
| 2026-06-21_1000_skeleton.md | v2 | quiet | YES — **last fully clean run** (all 3 figures confirmed; used Jun 18/19 closes) |
| 2026-06-22_1000_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-23_1000_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-24_1000_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-24_1200_skeleton.md | v2 | data_incomplete | YES (second same-day run; resolved VIX gap from 1000 run — VIX Jun 23 = 19.49 confirmed) |
| 2026-06-25_1000_skeleton.md | v2 | data_incomplete | YES (this run; S&P + FTSE Jun 24 confirmed; VIX Jun 24 null) |

**For heartbeat purposes:** last valid run covering any trading activity = **2026-06-24_1200**.
Last fully clean (`quiet`) run = **2026-06-21** (Sunday, used most-recent closes as of that date).

**Persistent data-incomplete streak:** VIX Jun 24 close was not confirmable to ≥2 sources in this run.
The streak root cause: CBOE CSV returns 403; VIX prior-session close is not reliably indexed by
10:00 BST. Using TheStreet/Yahoo Finance daily recap articles is the reliable workaround — but
those articles appear to cover the previous session and arrive after 10:00 BST (confirmed by the
1200 BST run on Jun 24 which DID resolve VIX Jun 23). Running later (12:00+ BST) is more likely
to capture the prior-session VIX close.

---

## 6. Current market context (as of 2026-06-25 run)

All figures below are the most recently confirmed values. Fetch fresh on the next run.

| Figure | Value | Date | Notes |
|---|---|---|---|
| S&P 500 | 7,358.22 | Jun 24 close | −0.10%; Nasdaq −0.43%, Dow +0.35%; pre-Micron AH earnings |
| S&P 500 3-month high | 7,609.78 | Jun 2 | Confirmed ≥2 sources across multiple runs; supersedes the unverified 7,620.90 from a single Investing.com source in the Jun 19 HANDOVER |
| S&P 500 trigger floor | 6,848.80 | — | 7,609.78 × 0.90 |
| S&P 500 pct from high | −3.31% | Jun 24 | 7.46% above trigger floor |
| FTSE 100 | 10,454 | Jun 24 close | +0.24%; Segro +17.2%, B&M +13.1%, Berkeley +7.6%; BP −3.6%, Glencore −3.5% on oil/metals |
| FTSE 100 3-month high | 10,504 | Jun 17 | Unchanged since inaugural run; window Mar 26–Jun 25 ✓ |
| FTSE 100 trigger floor | 9,453.60 | — | 10,504 × 0.90 |
| FTSE 100 pct from high | −0.48% | Jun 24 | 10.58% above trigger floor |
| VIX | 19.49 | Jun 23 close (last confirmed) | Jun 24 close unconfirmed; estimated 18-19 (1 imprecise source); VIX is 30%+ below 28 trigger regardless |
| index_leg | false | — | Both sub-legs independently false at wide margins |
| vix_leg | false (informally) | — | Cannot formally confirm to standard; definitively false under any plausible Jun 24 reading |
| macro_leg_live | false | — | — |

**Micron context:** Micron reported Q3 FY2026 after hours June 24 — blowout beat (EPS $25.11 vs
$20.20 expected; revenue $41.5B vs $35.6B expected; Q4 outlook $50B ± $1B vs $42.9B expected).
AH reaction: semiconductor equities surged. This may affect Jun 25 open and intraday VIX.

**Macro backdrop (Jun 24):** Oil down ~4% (Brent $73.74, WTI $70.34) on demand concerns.
Treasury 10yr yield fell below 4.5%. Session mixed: tech/energy down, Dow industrials up.

---

## 7. Data source notes (hard-won)

### Works reliably

- **WebSearch tool** with specific queries ("S&P 500 close [date]", "FTSE 100
  [date] close", "VIX CBOE [date]") — triangulate across ≥2 results.
- **TheStreet** daily market recap articles (`stock-market-today` URL slug) —
  reliable for confirmed US closes with specific levels.
- **Yahoo Finance** market articles — reliable for FTSE (UK/intl recap articles),
  VIX, and US closes.
- **Saxo "Market Quick Take" articles** — reliable for FTSE 100 and European
  market closes; appeared as a good source in Jun 24 run.
- **Trading Economics / IG / Reuters** via search — good for FTSE intraday.
- **Schwab market update** — good for US daily recap, specific closes.

### Does NOT work / unreliable

- **CBOE VIX CSV direct fetch** — returns HTTP 403. **Confirmed 403 in the
  2026-06-24_1200 run** (tested explicitly). Remove this from all VIX fetch
  strategies permanently. Use WebSearch for VIX (TheStreet/Yahoo recap articles).
- **WebFetch on financial sites** (CNBC, Yahoo Finance, macrotrends, IG,
  streetstats) — most return HTTP 403. Use WebSearch only.
- **Search AI summaries can swap S&P 500 and Nasdaq levels.** The indices have
  very different magnitudes (S&P ~7,300-7,600; Nasdaq ~25,000-27,000) — use
  magnitude to identify which is which when the summary mislabels them. Always
  cross-check with the Dow (+/- points) for consistency.
- **Single search result summaries can hallucinate specific levels.** The figure
  "26,517.93" appeared once as the S&P 500 close — it was actually the Nasdaq.
  Discard any level that conflicts with known index magnitude ranges.
- **Trading Economics US500** — tracks a CFD product, not the NYSE cash close.
  Reported 7,380 for Jun 24 when cash close was 7,358.22. Do not use for
  official S&P 500 cash-close confirmation.

### 3-month high methodology

Fetch fresh every run. Do NOT copy from a prior log or the dashboard. The trailing
window is run_date − 91 days. Search for "S&P 500 high [month] [year]" and
"FTSE 100 high [month] [year]" and verify the date of the high falls within the
window. The FTSE Feb 25 2026 all-time high (~10,750) is outside the window for any
run date in June 2026 or later.

**Current confirmed highs (as of Jun 25 run):**
- S&P 500: 7,609.78 (Jun 2, 2026) — confirmed ≥2 sources multiple times. The
  earlier HANDOVER cited 7,620.90 from a single Investing.com source; that figure
  was never confirmed to ≥2 sources and is superseded by the 7,609.78 consensus.
- FTSE 100: 10,504 (Jun 17, 2026) — confirmed multiple runs. Possible marginal
  revisions (10,508.61 or 10,510.16 from single sources on Jun 17/19) remain
  unconfirmed; 10,504 is the safe floor.

### VIX timing note

VIX prior-session close is often not confirmed to ≥2 sources at the 10:00 BST
run time. The 12:00 BST run on Jun 24 successfully resolved the Jun 23 VIX (19.49)
using TheStreet + Yahoo Finance recap articles. Running at 12:00+ BST is more
reliable for VIX confirmation than the 10:00 BST slot.

### Holiday handling

US holidays (Juneteenth, Independence Day, Labour Day, etc.): NYSE/Nasdaq/VIX
closed. Holiday exception: use the confirmed prior-session close for S&P 500 and
VIX, labelled explicitly in `sources` and notes. **LSE is NOT closed on US
holidays** — FTSE must be fetched as a live figure on those days.

UK bank holidays: LSE closed, FTSE carries prior-session close (holiday
exception). US markets usually open; fetch S&P and VIX fresh.

Do NOT flag weekends or confirmed holidays as heartbeat gaps.

---

## 8. Canonical dashboard (live — v33)

`portfolio_dashboard_v33.md` is live in Drive (134KB, updated Jun 24 2026 17:52)
and is the current source-of-truth portfolio snapshot. ISA total: **£13,869.85**.

The OPEN item from the prior HANDOVER (dashboard in wrong Drive folder) appears
**resolved** — v33 is confirmed in the "Ground Control - Portfolio Automation"
folder (ID: `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo`). The `reconcile` routine can
read it from there.

The highest-versioned `portfolio_dashboard_vNN.md` WITHOUT a `_DRAFT` suffix is
the canonical one (currently **v33**). DRAFT files are proposals from the
`reconcile` routine awaiting human review.

**The skeleton routine does NOT read the dashboard.** It fetches all data live.

---

## 9. Portfolio allocation context

ISA value: **£13,869.85** (Jun 24 2026). Freetrade Basic. GBP.

| Sleeve | Target | Band |
|---|---|---|
| Quality + dividend | 55-60% | — |
| Gilts | ~20% | — |
| Spec total | 10-15% | — |
| — Spec sensible sub-pot | 10% target | 9-11% |
| — Spec risky sub-pot | 5% target | 4-6% |
| Cash (withdrawable) | 3-5% | ≤5% |

Current allocation (Jun 24): Equities £10,257.35 (73.9%), Gilt ~£2,420 (~17.4%),
Cash ~£1,192 (~8.6%). T-bill set to 100% roll on maturity (~3 Jul).

Watchlist names for crash-deploy: **KO, GSK, LSEG** (re-underwrite on trigger;
never a buy signal — human decides after reviewing fundamentals).

Active milestones (from dashboard v33): SOUN limit sell check (Jun 30), T-bill
maturity/roll (~3 Jul), UNH Q2 results (16 Jul 2026 BMO).

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
- **Never use CBOE CSV endpoint for VIX.** Returns 403. Use WebSearch only.

---

## 12. What the next run should do

Next trading day: **2026-06-26 (Friday)**.

On the 2026-06-26 run:
1. **Heartbeat check:** list automation_log. Last valid run = 2026-06-25_1000.
   Jun 25 is a trading day; no gap between Jun 25 and Jun 26. heartbeat_ok: true.
2. **Fetch fresh:**
   - S&P 500 Jun 25 close (NYSE closes 21:00 BST Jun 25 — confirmed data available
     by a 10:00 BST Jun 26 run; Micron AH beat may have lifted semis/tech).
   - FTSE 100 Jun 25 close (LSE closes ~16:30 BST Jun 25 — confirmed by Jun 26 morning).
   - VIX Jun 25 close (CBOE closes with NYSE — use WebSearch, TheStreet/Yahoo recap
     articles; consider running at 12:00 BST if 10:00 BST run fails again).
3. **Re-derive 3-month highs** fresh (window: Mar 27 – Jun 26, 2026):
   - S&P 500: Jun 2 high of 7,609.78 still likely the highest; check if Jun 25
     (post-Micron beat) exceeded it.
   - FTSE 100: Jun 17 high of 10,504; check if Jun 25 exceeded it.
4. Confirm ≥2 sources each. Evaluate legs. Write v2 log.

**VIX streak note:** VIX Jun 24 close remains unconfirmed. If Jun 25 VIX is
confirmable, the streak ends; if not, log data_incomplete again and note the
ongoing streak.
