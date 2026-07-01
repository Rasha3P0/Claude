# Drive Output Format — the stable contract (v1)

This defines, **once**, how the automation writes results to Google Drive so the
Claude project can parse them next open without ambiguity. **Do not change the
schema casually** — bump `schema_version` and note it here if you ever must.

A copy of this file is mirrored into the Drive folder as `README_FORMAT.md`.

---

## 0. Why a folder of files, not one growing `automation_log.md`

The Drive connector available to the automation is **create-only**: it can
create and read files, but there is **no update-in-place and no delete** (probed
and confirmed 17 Jun 2026 — re-creating a file with the same name produces a
*second* file with a new ID, not a replacement).

A single growing `automation_log.md` is therefore impossible to maintain cleanly
(every append would orphan an undeletable duplicate). So the append-only log is a
**folder of immutable, dated entry files**. This is a deliberate, logged
deviation from the original "single `automation_log.md`" suggestion — forced by
the toolset, and a better append-only design regardless.

---

## 1. Folder layout (Google Drive)

```
Ground Control - Portfolio Automation/        <- folder id 18Pa5lk7mlY-hywSwAMo4cPqjAd5DiICo
├── README_FORMAT.md                           <- mirror of this contract
├── portfolio_dashboard_v29.md                 <- CANONICAL baseline (source of truth)
├── portfolio_dashboard_v30_DRAFT.md           <- reconcile DRAFT (user reviews -> promotes)
├── portfolio_dashboard_v31_DRAFT.md           <- ... one per reconcile, immutable
└── automation_log/                            <- append-only log = one file per run
    ├── 2026-06-17_1840_skeleton.md
    ├── 2026-07-01_0800_checkin.md
    ├── 2026-07-01_0800_reconcile.md
    └── ...
```

**To read "the log":** list everything in `automation_log/` and sort by
filename — the names sort chronologically. Each file is one run, never rewritten.

**To read "the current dashboard":** take the highest-numbered
`portfolio_dashboard_vNN.md` **without** a `_DRAFT` suffix. `_DRAFT` files are
proposals awaiting the user's review; they are NOT canonical until the user
promotes them.

---

## 2. Entry-file naming

```
automation_log/<RUN_DATE>_<HHMM>_<ROUTINE>.md
```
- `RUN_DATE` = `YYYY-MM-DD` (Europe/London).
- `HHMM`     = 24-hour Europe/London time, e.g. `0800`, `1840`.
- `ROUTINE`  = one of `skeleton` | `checkin` | `reconcile`.
- Collision (same routine, same minute): append `_2`, `_3`, …

---

## 3. Entry-file structure

Every entry file is Markdown with a **YAML front-matter block** (machine-parseable,
fixed keys) followed by a short **human body**. Parse the front-matter; the body
is prose for a human skimming Drive.

Numbers are plain (no `£`, no `%` inside values). Currency is GBP. Percentages
are numbers (e.g. `8.6` means 8.6%). Booleans are `true`/`false`. Missing/unknown
= `null`. Lists use `[a, b]`.

### 3.1 `skeleton` entry

```yaml
---
schema_version: 1
routine: skeleton
run_timestamp: 2026-06-17T18:40:00+01:00
run_date: 2026-06-17
status: quiet            # quiet | TRIGGERED
sp500_level: 6731
sp500_3mo_high: 6740
sp500_pct_from_high: -0.1
ftse100_level: 9520
ftse100_3mo_high: 9540
ftse100_pct_from_high: -0.2
vix: 16.4
index_leg: false         # true if either index >= 10% below its 3-mo high
vix_leg: false           # true if VIX >= 28
macro_leg_live: false    # index_leg AND vix_leg
sources: [websearch, fred, yahoo]
alert_sent: []           # [] on quiet; [push, email] when TRIGGERED
---
```
Body when `quiet`: a single dated line, e.g.
`2026-06-17 — Skeleton quiet. VIX 16.4 (<28); S&P -0.1% / FTSE -0.2% off 3-mo high. No action.`

Body when `TRIGGERED`: state that the **macro leg is LIVE** and it is time to
**RE-UNDERWRITE** KO / GSK / LSEG — **not a buy signal**, no sizing, no execution.
Note that target zones are still OPEN and a buy would also require name-in-zone +
a passing re-underwrite.

### 3.2 `checkin` entry  (monthly; DRAFT only)

```yaml
---
schema_version: 1
routine: checkin
run_timestamp: 2026-07-01T08:00:00+01:00
run_date: 2026-07-01
status: drafted
isa_value_gbp: 13838.06          # recomputed live, never cached
spec_ceiling_gbp: 2075.71        # 15% of ISA
spec_sensible_target_gbp: 1383.81 # 10%
spec_sensible_band_gbp: [1245.43, 1522.19]   # 9%-11%
spec_risky_target_gbp: 691.90    # 5%
spec_risky_band_gbp: [553.52, 830.28]        # 4%-6%
buckets_pct: {cash_withdrawable: 6.4, cash_total: 8.6, gilt: 17.5, quality_div: 59.0, spec_total: 11.9}
spec_subpots_pct: {sensible: 7.6, risky: 4.3}
breaches: [cash_withdrawable_over_5]          # [] if none; see breach keys in §5
boe_base_rate: 3.75
boe_last_decision: "2026-06-18 held 8-1"
uk_cpi_latest: "May 2026, x.x% YoY"
next_mpc_date: 2026-08-06
months_to_renewal: 48
btl_note: "Renters' Rights Act bedded in (S21 gone May 2026); higher-for-longer pressures financing; ISA not the funding source."
draft_changelog_stub_file: null   # checkin writes its stub into the body; reconcile writes the DRAFT dashboard
alert_sent: [push, email]         # only if breaches non-empty; else []
---
```
Body: the arithmetic (show the cap maths), the four-bucket split with band-breach
flags, the macro pull (BoE rate + latest decision, latest CPI print, next MPC),
the renewal countdown + BTL note, and a **CHANGELOG STUB** the user can paste —
clearly marked *DRAFT, not committed*.

### 3.3 `reconcile` entry  (on demand + monthly; produces a DRAFT dashboard)

```yaml
---
schema_version: 1
routine: reconcile
run_timestamp: 2026-07-01T08:05:00+01:00
run_date: 2026-07-01
status: clean                      # clean | FLAGS
fx_usd_gbp: 0.78
isa_value_gbp_computed: 13838.06
broker_total_gbp: null             # fill if the user provides a broker figure
drift_gbp: null                    # computed - broker; null if no broker figure
equities_gbp: 10232.49
gilt_gbp: 2417.86
cash_gbp: 1187.24
buckets_pct: {cash_withdrawable: 6.4, gilt: 17.5, quality_div: 59.0, spec_total: 11.9}
spec_subpots_pct: {sensible: 7.6, risky: 4.3}
breaches: []                       # see §5
draft_dashboard_file: portfolio_dashboard_v30_DRAFT.md
tickers_verified: true             # all ticker->fund->underlying re-checked this run
alert_sent: []                     # [push, email] if breaches non-empty
---
```
Body: per-line marks (ticker, shares, live price, source(s), GBP value), bucket
totals, spec sub-pots, any drift vs broker, any breach, and a pointer to the
DRAFT dashboard file written this run.

---

## 4. Draft dashboard files

- Named `portfolio_dashboard_v<NN+1>_DRAFT.md`, where `NN` is the current
  canonical version.
- A **full** next-version dashboard: full mark-to-market, holdings **re-ranked by
  value**, with a new **CHANGELOG** entry at the top describing the run.
- **PRESERVE every honest caveat and logged deviation VERBATIM.** Never rewrite a
  deviation into a clean rule. Never silently drop a caveat.
- The draft is a **proposal**. The user reviews it and, to promote it, saves it as
  `portfolio_dashboard_v<NN+1>.md` (canonical). The automation never promotes.
- Stale sections the run did not refresh (e.g. the geography/sector/style/
  concentration breakdown tables) must be **left intact and still flagged stale** —
  do not delete them, do not pretend they are fresh.

---

## 5. Breach keys (stable vocabulary)

Use exactly these strings in `breaches` / `flags`:
- `quality_div_over_60`        — quality+div > 60%
- `spec_total_over_15`         — total spec > 15% (hard ceiling)
- `spec_sensible_below_9`      — sensible < 9% (NOTE: as of v29 this is BY DESIGN — report, do not action)
- `spec_sensible_above_11`     — sensible > 11%
- `spec_risky_below_4`         — risky < 4%
- `spec_risky_above_6`         — risky > 6%
- `cash_withdrawable_over_5`   — withdrawable cash > 5%

---

## 6. Alerts (user setting: log + push + email)

- **Quiet runs stay silent** — log entry only, `alert_sent: []`.
- **On a skeleton TRIGGER or any non-empty `breaches`:** also send a phone
  **push** (PushNotification) and create a **Gmail draft** addressed to the user
  (`nirbras@gmail.com`). The Gmail connector can only *draft*, not send — so the
  draft is a durable written alert in the user's Drafts; the push is the live ping.
  Record `alert_sent: [push, email]`.
- Alerts **never** contain sizing or execution instructions. Skeleton alerts say
  "re-underwrite", never "buy".

---

## 7. Invariants (every run, no exceptions)

1. **Never** place/modify/cancel an order. Draft and surface only.
2. **Fetch prices fresh** every run. For US equities in UK morning, triangulate
   >= 2 live sources and discard stale outliers. Record `sources`.
3. **Verify** ticker -> fund -> underlying before referencing any fund.
4. Dashboard changes are **drafts**; the user reviews and commits. Preserve
   caveats/deviations verbatim; append a changelog entry for every change.
5. Write outputs **only** in this format, to the folder in §1.
