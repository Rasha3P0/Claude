# Ground Control — Portfolio Automation Handover

**Last updated:** 2026-06-24 (post data_incomplete streak; CBOE CSV fix; dashboard v31)
**Repo:** `Rasha3P0/Claude` | **Branch:** `claude/sweet-mayer-pv9t8h`
**Drive folder:** "Ground Control - Portfolio Automation"
  — folder ID: `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo`
  — log subfolder ID: `1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI`

Give this file plus `automation/runbooks/daily_skeleton_monitor.md` to a new
session. Between them they contain everything needed to run the skeleton routine
correctly and continue the project without repeating mistakes.

---

## 1. What this project is

A **daily macro crash-deploy monitor** for a UK Stocks & Shares ISA (Freetrade
Basic, ISA value ~£13,838 as of Jun 2026). The skeleton routine is the first
and only live automation as of this writing. Two further routines are planned but
not yet implemented: `checkin` and `reconcile`.

**The skeleton routine's single job:** check whether a macro crash-deploy
condition is live. If it is, alert the owner to re-underwrite three watchlist
names (KO, GSK, LSEG). Nothing else. It never suggests a buy, a size, or a
price. "Alert" means "go look at the fundamentals" — the human decides.

**This is not a trading system.** Nothing in automation_log has ever placed,
sized, or suggested a trade. All logs are read-and-draft only.

**Run time:** ~10:00 AM BST daily. Owner trades from the UK and wants to act
when LSE opens (08:00 BST). At run time: FTSE is live (use intraday); NYSE not
yet open (opens 14:30 BST) so S&P 500 and VIX use prior-session closes.

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

1. **Heartbeat check** — list automation_log, find last valid run, flag missing trading days.
2. **Fetch data** — S&P 500 level + 3-month high, FTSE 100 level + 3-month high, VIX level. Fetch ALL fresh every run.
3. **Silent-failure guard** — each figure must be confirmed by ≥2 independent live sources. If any figure fails: `status: error` or `data_incomplete`, not `quiet`. **`quiet` is a positive assertion — it must be earned.**
4. **Evaluate legs** — only when all three figures confirmed.
5. **Decide status** — `quiet` / `alert` / `data_incomplete` / `error`.
6. **Write log** — Drive `automation_log/YYYY-MM-DD_HHMM_skeleton.md`.

The full step-by-step text with all front-matter keys is in the runbook file.
Do not paraphrase it — follow it exactly.

---

## 4. Drive folder structure

```
Ground Control - Portfolio Automation/   (ID: 18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo)
├── HANDOVER_2026-06-19_post-cutover.md  superseded
├── HANDOVER_2026-06-24.md               current Drive copy of this handover
├── README_FORMAT_2026-06-19.md          parse contract for the folder
├── portfolio_dashboard_v31.md           CANONICAL dashboard (ID: 19Vby8jssxTJA6hUtCiQkxk7vKBwhbfJY)
└── automation_log/                      (ID: 1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI)
    ├── 2026-06-17_1946_skeleton.md      VALID (schema v1, inaugural run)
    ├── 2026-06-19_2015_skeleton.md      VALID (schema v2)
    ├── 2026-06-20_0900_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-21_1000_skeleton.md      VALID (schema v2, quiet — all confirmed)
    ├── 2026-06-22_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-23_1000_skeleton.md      VALID (schema v2, data_incomplete)
    └── 2026-06-24_1000_skeleton.md      VALID (schema v2, data_incomplete)
```

**Drive connector is create-only** — no update, no delete. Every log file is
immutable once written.

---

## 5. Log file validity table (as of 2026-06-24)

| Filename | Schema | Status | Valid? |
|---|---|---|---|
| 2026-06-17_1946_skeleton.md | v1 | quiet | YES (v1-era inaugural) |
| 2026-06-18_XXXX_skeleton.md | v1 | — | INVALID (pre-runbook; treat as non-existent) |
| 2026-06-19_1946_skeleton.md | v1 | — | INVALID (pre-runbook; treat as non-existent) |
| 2026-06-19_2015_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-20_0900_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-21_1000_skeleton.md | v2 | quiet | YES |
| 2026-06-22_1000_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-23_1000_skeleton.md | v2 | data_incomplete | YES |
| 2026-06-24_1000_skeleton.md | v2 | data_incomplete | YES |

Last fully clean `quiet` run: **2026-06-21**.
Running data_incomplete streak: Jun 22 / Jun 23 / Jun 24 — root cause: VIX
prior-session close not indexable to ≥2 sources by 10:00 AM BST.
See §7 for the fix.

---

## 6. Current market context (as of 2026-06-24 run)

All figures are the most recently confirmed values. Fetch fresh on each run.

| Figure | Value | Date confirmed | Notes |
|---|---|---|---|
| S&P 500 | 7,365.46 | Jun 23 close | −1.44%; tech/semi selloff (Micron −11.4%, SMH −6.5%) |
| S&P 500 3-month high | 7,609.78 | Jun 2 | ≥3 sources; within Mar 24–Jun 24 window |
| S&P 500 trigger floor | 6,848.80 | — | 7,609.78 × 0.90; S&P currently 7.5% above floor |
| FTSE 100 | 10,428.85 | Jun 23 close | −0.09%; miners/tech funds led decline |
| FTSE 100 3-month high | 10,504 | Jun 17 | confirmed across prior runs |
| FTSE 100 trigger floor | 9,453.60 | — | 10,504 × 0.90; FTSE currently 10.3% above floor |
| VIX | ~19.50 | Jun 23 | 1 source only (not confirmed); Jun 22 confirmed 17.28 |
| index_leg | false | — | both legs independently false at wide margins |
| vix_leg | null | — | unconfirmed; definitively false under all available data |
| macro_leg_live | false | — | |

Macro backdrop: Jun 23 tech/semi rout (BofA rate-hike note + South Korean KOSPI
crash) drove S&P −1.44%, Nasdaq −2.21%. Not a systemic crash. Both trigger floors
remain very distant. VIX period ceiling (May 25–Jun 23) was 23.34 — still 17%
below the 28 trigger.

---

## 7. Data source notes (hard-won)

### OPEN ISSUE — VIX data_incomplete streak

Four consecutive runs (Jun 22–24) have logged `data_incomplete` because VIX
prior-session close is not reliably confirmed to ≥2 independent sources by 10:00
AM BST using generic web search queries.

**Fix to attempt on next run — CBOE public CSV endpoint:**

```
WebFetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
         "return the last row: date and closing value")
```

This is CBOE's own machine-readable daily VIX history file (not an HTML page).
It is structurally independent of web search results. If the proxy allows it,
the last row gives the prior-session close and it counts as a first independent
source. Pair it with any search result confirming the same figure = ≥2 confirmed.

**Document the result** (accessible / 403 / other) in the next run's notes and
update this section accordingly.

### Works reliably

- **WebSearch** with specific date queries — triangulate ≥2 results.
- **TheStreet** `stock-market-today` recap articles — reliably indexed by 08:00
  BST; contain explicit VIX, S&P 500, Nasdaq, and FTSE levels with percentages.
  Best VIX query: `"stock market today [full date] Dow S&P 500 Nasdaq VIX"`
  or `"TheStreet stock market today [date]"`.
- **Yahoo Finance** market news articles — good for FTSE (UK/intl recaps), VIX,
  US closes.
- **Trading Economics / IG / Reuters** via search — good for FTSE intraday.
- **Schwab market update** — good for US daily recap.

### Does NOT work

- **WebFetch on financial HTML pages** (CNBC, Yahoo Finance, macrotrends, IG,
  FRED, streetstats) — returns HTTP 403. Use WebSearch only for these.
- **Generic VIX queries** (`"VIX current level [date]"`) — often return only
  1 named source at 10:00 AM BST. Use recap-article queries instead (see above).

### Known hallucination pitfalls

- Search AI summaries can swap S&P 500 and Nasdaq levels. S&P is ~7,000–8,000;
  Nasdaq is ~23,000–27,000. Use magnitude to sanity-check.
- Single result summaries can fabricate specific levels. Always cross-check
  with Dow direction and percentage for internal consistency.

### Source priority order by figure

**VIX (prior-session close — at 10:00 AM BST, NYSE closed):**
1. `WebFetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv")` → last row CLOSE
2. `WebSearch("stock market today [full date] Dow S&P 500 Nasdaq VIX")` → TheStreet/CNBC recap article
3. `WebSearch("VIX close [date] CBOE fear gauge market")`
→ Source 1 + either of 2/3 = ≥2 confirmed.

**FTSE 100 (intraday at ~10:00 BST — LSE open since 08:00):**
1. `WebFetch("https://www.londonstockexchange.com/indices/ftse-100")` → current level
2. Two separate search queries with different phrasing, both returning the same figure
→ If 1 is 403: two convergent search results = ≥2 confirmed.

**S&P 500 (prior-session close):**
- Already works reliably. Two search queries with date specificity (TheStreet + Yahoo/CNBC).

**3-month highs (both indices):**
- `WebSearch("S&P 500 record high [month] [year]")` + second source.
- Confirmed current values (re-derive fresh but these are the floors):
  - S&P 500: 7,609.78 (Jun 2 2026) — window floor 6,848.80
  - FTSE 100: 10,504 (Jun 17 2026) — window floor 9,453.60

### Holiday handling

- **US holidays** (Juneteenth, Independence Day, etc.): NYSE/VIX closed. Use
  confirmed prior-session close for S&P 500 and VIX, labelled explicitly.
  LSE is NOT closed on US holidays — fetch FTSE live.
- **UK bank holidays**: LSE closed, FTSE carries prior-session close (holiday
  exception). US markets usually open; fetch S&P and VIX fresh.
- Do NOT flag weekends or confirmed holidays as heartbeat gaps.

---

## 8. Canonical dashboard

`portfolio_dashboard_v31.md` — Drive ID: `19Vby8jssxTJA6hUtCiQkxk7vKBwhbfJY`
Parent folder: `18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo` (correct folder — v30 location
bug is resolved in v31).

ISA broker-hard total: **£13,838.06** (17 Jun 2026 refresh).
The skeleton routine does NOT read the dashboard. It fetches all data live.

Highest-versioned `portfolio_dashboard_vNN.md` WITHOUT `_DRAFT` suffix = canonical.

---

## 9. Portfolio allocation context

ISA value: ~£13,838 (Jun 2026). Freetrade Basic. GBP.

| Sleeve | Target | Band |
|---|---|---|
| Quality + dividend | 55–60% | — |
| Gilts | ~20% | — |
| Spec total | 10–15% | — |
| — Spec sensible sub-pot | 10% target | 9–11% |
| — Spec risky sub-pot | 5% target | 4–6% |
| Cash (withdrawable) | 3–5% | ≤5% |

Watchlist names for crash-deploy: **KO, GSK, LSEG** (re-underwrite on trigger;
never a buy signal — human decides after reviewing fundamentals).

Active milestones: T-bill maturity/roll (~3 Jul), UNH Q2 results (16 Jul 2026 BMO).
SMGB DCA cadence under review. SOUN limit sell check passed (Jun 30).

---

## 10. Repo file map (automation-relevant)

```
automation/
├── HANDOVER.md                         this file
└── runbooks/
    └── daily_skeleton_monitor.md       official runbook (schema v2) + source priority appendix
```

Main app (`index.html`, `sw.js`, etc.) lives in repo root — separate concern.

---

## 11. Hard rules (non-negotiable)

- **Never suggest, size, or price a trade.** Alert = "go re-underwrite." Full stop.
- **Never log `status: quiet` without ≥2 confirmed sources for ALL three figures.**
  Quiet is a positive assertion; it must be earned.
- **Never carry a stale figure forward as current** without labelling it as a
  confirmed holiday-exception close.
- **Never treat a weekend or bank holiday as a heartbeat gap.** Only flag missing
  trading days.
- **Never read 3-month highs from a prior log or the dashboard.** Always fetch fresh.
- **Never include a "near-miss" watch** ("VIX getting close to 28…"). The binary
  trigger is deliberate.
- **The Drive connector is create-only.** Never attempt to update or delete a log
  file.

---

## 12. What the next session should do

1. Read this file and `automation/runbooks/daily_skeleton_monitor.md`.
2. On first run: **test the CBOE CSV WebFetch** (§7). Document accessible/403 in
   the run notes. If accessible, the VIX data_incomplete streak ends immediately.
3. Run the skeleton normally per the runbook.
4. Write a new `HANDOVER_2026-06-25.md` (or later date) to Drive if anything
   material changes.
