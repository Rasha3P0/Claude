# Ground Control — Portfolio Automation Handover

**Last updated:** 2026-06-24 (post-CBOE-test; VIX streak resolved; Jun 24 second run)
**Repo:** `Rasha3P0/Claude` | **Branch:** `claude/eloquent-maxwell-zbgec9`
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
├── HANDOVER_2026-06-24.md               Drive copy (pre-CBOE-test)
├── README_FORMAT_2026-06-19.md          parse contract for the folder
├── portfolio_dashboard_v31.md           CANONICAL dashboard (ID: 19Vby8jssxTJA6hUtCiQkxk7vKBwhbfJY)
└── automation_log/                      (ID: 1oxYpzTigBBfAbaZaKJOqhujP7krc1YnI)
    ├── 2026-06-17_1946_skeleton.md      VALID (schema v1, inaugural run)
    ├── 2026-06-19_2015_skeleton.md      VALID (schema v2)
    ├── 2026-06-20_0900_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-21_1000_skeleton.md      VALID (schema v2, quiet — all confirmed)
    ├── 2026-06-22_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-23_1000_skeleton.md      VALID (schema v2, data_incomplete)
    ├── 2026-06-24_1000_skeleton.md      VALID (schema v2, data_incomplete)
    └── 2026-06-24_1200_skeleton.md      VALID (schema v2, data_incomplete — VIX streak resolved)
```

**Drive connector is create-only** — no update, no delete. Every log file is
immutable once written.

---

## 5. Log file validity table (as of 2026-06-24 second run)

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
| 2026-06-24_1200_skeleton.md | v2 | data_incomplete | YES |

Last fully clean `quiet` run: **2026-06-21**.

VIX data_incomplete streak (Jun 22 / Jun 23 / Jun 24 10:00): **RESOLVED** in the
Jun 24 12:00 run. Root cause was VIX prior-session close not confirmable to ≥2
sources at 10:00 AM BST via generic queries. Fix: use TheStreet/Yahoo recap-
article queries — these confirmed Jun 23 VIX close at 19.49 to ≥2 sources.
CBOE CSV endpoint (proposed fix in prior HANDOVER) returned HTTP 403 — blocked.
See §7 for full details.

New open issue: FTSE 100 intraday data conflicts. See §7.

---

## 6. Current market context (as of 2026-06-24 12:00 run)

All figures are the most recently confirmed values. Fetch fresh on each run.

| Figure | Value | Date confirmed | Notes |
|---|---|---|---|
| S&P 500 | 7,365.46 | Jun 23 close | −1.44%; tech/semi selloff (Micron −11.4%, SMH −6.5%) |
| S&P 500 3-month high | 7,609.78 | Jun 2 | ≥3 sources; within Mar 25–Jun 24 window |
| S&P 500 trigger floor | 6,848.80 | — | 7,609.78 × 0.90; S&P currently 7.5% above floor |
| FTSE 100 | 10,428.85 | Jun 23 close | −0.09%; last confirmed figure (Jun 24 intraday conflicted) |
| FTSE 100 3-month high | 10,504 | Jun 17 | confirmed across prior runs; possible 10,570.09 unconfirmed |
| FTSE 100 trigger floor | 9,453.60 | — | 10,504 × 0.90; FTSE currently ~10.3% above floor |
| VIX | 19.49 | Jun 23 close | CONFIRMED ≥2 sources (TheStreet 19.49 / Yahoo 19.50) |
| index_leg | false | — | both sub-legs independently false at wide margins |
| vix_leg | false | — | 19.49 << 28; definitively false |
| macro_leg_live | false | — | |

Macro backdrop: Jun 23 tech/semi rout (BofA rate-hike note + South Korean KOSPI
−9.99%) drove S&P −1.44%, Nasdaq −2.21%. Not a systemic crash. Both trigger floors
remain very distant. VIX Jun 23 close 19.49, well below 28 trigger.

---

## 7. Data source notes (hard-won)

### RESOLVED — VIX data_incomplete streak

Root cause: generic VIX queries at 10:00 AM BST often returned only 1 named
source. Fix confirmed: use recap-article queries targeting TheStreet or Yahoo
Finance "stock market today" articles, which publish by ~08:00 BST and contain
explicit VIX close levels.

**VIX Jun 23 close confirmed via:**
1. TheStreet "Stock Market Today (June 23, 2026)" — VIX rose to 19.49, +12.79%
2. Yahoo Finance "Stock Market News for Jun 23, 2026" — VIX 19.50, +2.22 pts (+12.85%)
Both internally consistent with Jun 22 confirmed close of 17.28.

### CONFIRMED BLOCKED — CBOE CSV endpoint

```
WebFetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv")
```
**Returns HTTP 403 Forbidden via this proxy.** Do NOT use as Source 1 for VIX
in future runs — it will not succeed. Tested 2026-06-24 12:00 run.

### OPEN ISSUE — FTSE 100 Jun 24 intraday conflicting data

Three searches for FTSE Jun 24 intraday returned materially inconsistent figures:
- 10,364.05 (down 0.71%) from one search
- "intraday range 10,406–10,441, near 10,430 at mid-morning" from another
- "fell about 0.6%" (no specific figure) from a third

These cannot all be simultaneously true; different providers appear to be
returning data from different timepoints. Recommendation for next run: run two
explicit separate WebSearch calls with different phrasing and check whether they
return the same specific figure. If both agree on the same level = ≥2 confirmed.
If they conflict materially, fetch a third and discard the outlier. If all three
conflict, declare data_incomplete for FTSE.

### Unconfirmed FTSE 3-month high discrepancy

Multiple runs (Jun 20, Jun 22, Jun 24) found a "30-day period high" of ~10,570
(varying: 10,566.68 / 10,570.09) from what appears to be the same underlying
data provider. This has never been confirmed to ≥2 independent sources and no
specific date has been identified. If the true 3-month high is 10,570.09, trigger
floor rises from 9,453.60 to 9,513.08 — immaterial to the current conclusion
but worth resolving. Recommended: search specifically for the date of this
reading, e.g. "FTSE 100 record close May 2026" or "FTSE 100 highest close
March April May June 2026" to identify the exact date and confirm or deny.

### Works reliably

- **WebSearch with recap-article queries** — best for VIX and US indices:
  `"stock market today [full date] Dow S&P 500 Nasdaq VIX"` → TheStreet and
  Yahoo Finance recap articles. Published by ~08:00 BST. Contain explicit VIX,
  S&P 500, Nasdaq levels. **This is now the proven VIX Source 1.**
- **Yahoo Finance** market news articles — good for FTSE (UK/intl recaps), VIX, US closes.
- **Trading Economics / IG / Reuters** via search — good for FTSE intraday.
- **Schwab market update** — good for US daily recap.

### Does NOT work

- **WebFetch on financial HTML pages** (CNBC, Yahoo Finance, macrotrends, IG,
  FRED, streetstats, LSE) — returns HTTP 403. Use WebSearch only.
- **CBOE CSV endpoint** — HTTP 403 (confirmed 2026-06-24). Do not retry.
- **Generic VIX queries** (`"VIX current level [date]"`) — often return only
  1 named source at 10:00 AM BST. Use recap-article queries instead.

### Known hallucination pitfalls

- Search AI summaries can swap S&P 500 and Nasdaq levels. S&P is ~7,000–8,000;
  Nasdaq is ~23,000–27,000. Use magnitude to sanity-check.
- Single result summaries can fabricate specific levels. Always cross-check
  with Dow direction and percentage for internal consistency.
- FTSE intraday searches sometimes mix data from different timepoints into a
  single synthesis, making the result internally inconsistent. Run two separate
  searches and look for agreement on the same specific number.

### Source priority order by figure

**VIX (prior-session close — at 10:00 AM BST, NYSE closed):**
1. `WebSearch("stock market today [full date] Dow S&P 500 Nasdaq VIX")` → TheStreet/Yahoo recap article
2. `WebSearch("VIX close [date] CBOE fear gauge market")`
→ Sources 1 + 2 returning the same figure = ≥2 confirmed.

_Note: CBOE CSV was the prior Source 1 candidate but is confirmed HTTP 403 —
removed. The recap-article approach is now the proven primary path._

**FTSE 100 (intraday at ~10:00 BST — LSE open since 08:00):**
1. First search: `WebSearch("FTSE 100 [date] level points")`
2. Second search (different phrasing): `WebSearch("London stock exchange FTSE 100 today [date]")`
→ If both return the same specific figure = ≥2 confirmed.
→ If they conflict materially: fetch a third, discard the outlier.
→ If all three conflict: data_incomplete for FTSE.

_Note: LSE WebFetch also returns 403. Search only for FTSE._

**S&P 500 (prior-session close):**
```
WebSearch("S&P 500 close [date]")
WebSearch("[TheStreet/CNBC] stock market [date] recap S&P")
```
Two searches returning the same figure = ≥2 confirmed. Works reliably.

**3-month highs (both indices):**
Fetch fresh every run — do NOT copy from prior log or dashboard.
```
WebSearch("S&P 500 record high [month] [year]")
WebSearch("FTSE 100 high [month] [year]")
```
Confirmed current values (as of Jun 24 2026 — re-derive fresh but these are the floors):
- S&P 500: **7,609.78** (Jun 2 2026) — trigger floor **6,848.80**
- FTSE 100: **10,504** (Jun 17 2026) — trigger floor **9,453.60**
  (unconfirmed possible higher value ~10,570 — see §7 above)

Trailing window for a Jun 25+ run: run_date − 91 days. The FTSE Feb 25 2026
all-time high (~10,750) is outside the window and must NOT be used.

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
2. **For VIX:** use the recap-article query as Source 1 — `"stock market today
   [full date] Dow S&P 500 Nasdaq VIX"` → TheStreet/Yahoo. Do NOT attempt the
   CBOE CSV (confirmed 403).
3. **For FTSE intraday:** run two separate searches with different phrasing and
   look for agreement on the same specific figure. If they conflict, fetch a third.
4. **Optionally resolve the FTSE 3-month high discrepancy** (10,504 confirmed vs
   ~10,570 seen but unconfirmed in multiple runs). Search for the specific date
   and confirm or deny with a second source.
5. Run the skeleton normally per the runbook and write the log to Drive.
6. Write a new `HANDOVER_YYYY-MM-DD.md` to Drive if anything material changes.
