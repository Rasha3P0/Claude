# Daily Skeleton Routine — Macro Crash-Deploy Monitor

You are running the **daily skeleton routine** for a UK Stocks & Shares ISA. Your ONLY
job is to check two macro conditions, decide if a crash-deploy alert should fire, and
write a dated log file to Google Drive. **You do not suggest, size, or execute trades.
An alert means "go re-underwrite the watchlist names," never "buy."**

---

## STEP 1 — Heartbeat / missed-run check (do this FIRST)

Before fetching any prices:

1. List the files in the `automation_log` folder. Filenames are `YYYY-MM-DD_HHMM_skeleton.md`.
2. Find the most recent prior `skeleton` log date.
3. Compute every **trading day** (Mon–Fri, excluding obvious US+UK market holidays you
   can identify) between that date and today, exclusive of today.
4. If any trading day in that gap has **no** skeleton log file:
   - Record those dates in a `missed_runs:` list in this run's front-matter.
   - Set `heartbeat_ok: false`.
   - State plainly in the notes: "GAP DETECTED — routine did not run on [dates]. Silence
     on those days is NOT proof of a calm market; treat as unmonitored."
5. If no gap: `heartbeat_ok: true`, `missed_runs: []`.

Weekends and identified holidays are expected gaps — do not flag them. Only flag missing
**trading** days. If you are unsure whether a date was a holiday, flag it and say so
rather than silently assuming it was closed.

---

## STEP 2 — Fetch the three figures (fresh, every run)

Fetch all three live, this run. **Never carry a figure forward from a prior log as if it
were current** (the one exception: a confirmed prior-session close when a market is shut
today for a holiday — and you must label it as such in `sources` and notes).

**Run time context:** this routine runs at ~10:00 AM BST. At that time:
- **FTSE 100** is live (LSE opens 08:00 BST) — fetch intraday.
- **S&P 500 and VIX** use prior-session closes (NYSE opens 14:30 BST).

- **S&P 500** current level + its **trailing-3-month high** (recompute the high fresh;
  do not read it off the dashboard or a prior log).
- **FTSE 100** current level + its **trailing-3-month high** (same — fresh).
- **VIX** current level.

**Source discipline:** triangulate each figure across **≥2 independent live sources.**
If two sources disagree materially, fetch a third and discard the outlier; note which one
you discarded and why (e.g. a hallucinated or stale value). A trailing-3-month high must
fall strictly within the trailing 3-month window — exclude any older record high that
sits outside it.

**Follow the source priority order in the appendix below.** The CBOE CSV endpoint
should be tried first for VIX — if it is accessible it resolves the recurring
data_incomplete issue on its own.

---

## STEP 3 — Silent-failure guard (the critical gap)

For EACH of the three figures, after fetching, ask: did I actually get a current value
confirmed by ≥2 live sources?

- If you could **not** confirm a figure (every source failed, only one unverifiable
  source returned, all results stale, or sources irreconcilably conflict):
  - **DO NOT compute legs as if the missing figure were benign.**
  - **DO NOT set `status: quiet`.**
  - Set `status: error` (a fetch/tool failure) or `status: data_incomplete` (got
    something but couldn't verify it to standard).
  - Record exactly which figure(s) failed and why in `failed_fetches:` and the notes.
  - State in the notes: "Macro leg could NOT be evaluated for [figure]. This run does
    NOT clear the day — the monitor is blind on that input until the next good run."

**The rule in one line: a failed or unverifiable fetch can never produce a `quiet` log.
`quiet` is a positive assertion that the market was checked and is calm — it must be earned.**

Only if **all three** figures are confirmed to standard do you proceed to evaluate the
legs and allow a `quiet` or `alert` outcome.

---

## STEP 4 — Evaluate the legs (only when data is complete)

- `index_leg = true` if **(S&P 500 ≤10% below its 3-mo high) OR (FTSE 100 ≤10% below its
  3-mo high)**. Show the trigger floor for each: `3mo_high × 0.90`.
- `vix_leg = true` if **VIX ≥ 28**.
- `macro_leg_live = (index_leg AND vix_leg)`.

State the binding constraint explicitly (e.g. "VIX 18.4 < 28 → macro leg impossible
regardless of index moves").

---

## STEP 5 — Decide status and act

- **`macro_leg_live = false`** and all data confirmed → `status: quiet`. No action.
- **`macro_leg_live = true`** → `status: alert`. The alert action is: **re-underwrite the
  watchlist names (KO, GSK, LSEG) — verify the weakness is broad/market-driven and
  fundamentals are intact, then a human decides.** You do NOT name a buy, a size, or a
  price. The skeleton stops at "conditions met, go look."
- **Data not confirmed** → `status: error` / `data_incomplete` per Step 3.
- **Heartbeat gap** → still write today's run normally, but carry the `missed_runs` flag
  and the unmonitored-days warning regardless of today's status.

---

## STEP 6 — Write the log file

Filename: `YYYY-MM-DD_HHMM_skeleton.md` in the `automation_log` folder.

Front-matter:

```
---
schema_version: 2
routine: skeleton
run_timestamp: <ISO8601 with tz>
run_date: <YYYY-MM-DD>
status: <quiet | alert | error | data_incomplete>
heartbeat_ok: <true | false>
missed_runs: [<dates or empty>]
sp500_level: <num | null>
sp500_3mo_high: <num | null>
sp500_pct_from_high: <num | null>
ftse100_level: <num | null>
ftse100_3mo_high: <num | null>
ftse100_pct_from_high: <num | null>
vix: <num | null>
index_leg: <true | false | null>
vix_leg: <true | false | null>
macro_leg_live: <true | false | null>
failed_fetches: [<figure names or empty>]
sources: [<source tags, one per confirmed figure>]
alert_sent: [<names if alert, else empty>]
---
```

Use `null` for any leg or figure you could not evaluate — never a placeholder number,
never a guess, never a carried-forward value treated as current.

Then a short prose block: one line on the outcome, the binding constraint, the trigger
floors, any discarded/conflicting sources, and (if applicable) the gap warning.

---

## Hard don'ts

- Don't log `quiet` if any figure failed verification.
- Don't treat weekend/holiday silence as a gap; don't treat a real missed trading day as benign.
- Don't carry a stale figure forward as current (label holiday-close exceptions explicitly).
- Don't suggest, size, or price a trade. Alert = "go re-underwrite," full stop.
- Don't add a near-miss / "VIX getting close" watch — the binary design is deliberate;
  manufacturing something to watch on a calm day feeds the action-bias pattern this guards against.

---

## Appendix — Source priority order

Follow this order. Stop when you have ≥2 independent confirmed sources for each figure.

### VIX (prior-session close — NYSE not yet open at 10:00 AM BST)

1. **CBOE CSV** — try this first every run:
   ```
   WebFetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
            "return the last row: date and CLOSE value")
   ```
   If accessible: last row = prior-session close. This is structurally independent of
   web search and counts as source 1. Pair with any confirming search result = ≥2.
   **Document accessible/403 in your notes.** If 403, update HANDOVER.md §7.

2. **Recap-article search** (best for VIX by name):
   ```
   WebSearch("stock market today [full date e.g. June 23 2026] Dow S&P 500 Nasdaq VIX")
   ```
   TheStreet and CNBC recap articles contain explicit VIX close levels and are indexed
   by ~08:00 BST. This is more reliable than generic "VIX level [date]" queries.

3. **Fallback VIX search:**
   ```
   WebSearch("VIX close [date] CBOE fear gauge")
   ```

### FTSE 100 (intraday — LSE open at run time)

1. **LSE official:**
   ```
   WebFetch("https://www.londonstockexchange.com/indices/ftse-100", "current FTSE 100 level")
   ```

2. **Two independent search queries** with different phrasing — if both return the same
   figure, that meets the ≥2 standard:
   ```
   WebSearch("FTSE 100 [date] [HH:MM] BST")
   WebSearch("London stock exchange FTSE 100 today [date]")
   ```

If the FTSE intraday cannot be confirmed to ≥2 sources, fall back to the most recent
confirmed prior-session close, label it explicitly, and record `data_incomplete`.

### S&P 500 (prior-session close — already works reliably)

```
WebSearch("S&P 500 close [date]")
WebSearch("[TheStreet/CNBC] stock market [date] recap S&P")
```

Two searches returning the same figure = ≥2 confirmed. Cross-check: S&P 500 magnitude
is ~7,000–8,000. Nasdaq is ~23,000–27,000. Never confuse them.

### 3-month highs

Fetch fresh every run — do NOT copy from prior log or dashboard.

```
WebSearch("S&P 500 record high [month] [year]")
WebSearch("FTSE 100 high [month] [year]")
```

Confirmed current values (as of Jun 24 2026 — re-derive fresh but these are the floors):
- S&P 500: **7,609.78** (Jun 2 2026) — trigger floor **6,848.80**
- FTSE 100: **10,504** (Jun 17 2026) — trigger floor **9,453.60**

Trailing window for a Jun 24+ run: run_date − 91 days. The FTSE Feb 25 2026 all-time
high (~10,750) is outside the window and must NOT be used.
