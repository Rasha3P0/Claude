# Runbook — Daily Skeleton Monitor

**Cadence:** once per UK trading day (suggested 07:30 Europe/London — captures the
prior US close + VIX, before the UK open). Read-only macro tripwire.

**What it is:** a DRAFT-and-SURFACE alarm for a broad risk-off event. It is
**never** a buy signal, **never** sizes, **never** executes. On quiet days it
stays silent and logs one line.

---

## Inputs
- `automation/data/framework_params.json` → `skeleton` block (thresholds, candidates).
- Live data, fetched fresh this run (NON-NEGOTIABLE rule 2 — never cache):
  - S&P 500 current level **and** its trailing 3-month high.
  - FTSE 100 current level **and** its trailing 3-month high.
  - VIX current level.

## Steps

1. **Fetch fresh, triangulate.** Pull each figure from live sources. US data
   during UK morning: use **>= 2 live sources** and **discard stale outliers**
   (the dashboard's logged trap: caches near a level's old highs). Good channels:
   WebSearch (works here), and WebFetch on permissive hosts (FRED `VIXCLS` for VIX,
   Yahoo/Investing for index levels). Stooq's CSV endpoint returned 403 here — do
   not rely on it. Record which sources you used.

2. **Compute** for each index: `pct_from_high = (level / trailing_3mo_high - 1) * 100`
   (a negative number). Trailing 3-month high = the highest level over the last ~63
   trading days; if you can only get a clean ~3-month chart high, use that and say so.

3. **Evaluate the two legs** (both must hold):
   - `index_leg` = (S&P 500 `pct_from_high` <= -10) **OR** (FTSE 100 `pct_from_high` <= -10).
   - `vix_leg`   = (VIX >= 28).
   - `macro_leg_live` = `index_leg` **AND** `vix_leg`.

4. **If NOT live (the normal case):** write ONE `skeleton` entry file to
   `automation_log/` with `status: quiet`, `alert_sent: []`, and a single dated
   status line in the body. **Do not** push, **do not** email. Stop.

5. **If live:** write a `skeleton` entry with `status: TRIGGERED`. Then alert
   (user setting = log + push + email):
   - **Push** (PushNotification): one line, e.g.
     `Skeleton macro leg LIVE: <index> -X% off 3-mo high, VIX YY. Re-underwrite KO/GSK/LSEG — not a buy.`
   - **Gmail draft** to `nirbras@gmail.com`, subject
     `[Ground Control] Skeleton macro leg LIVE — re-underwrite`, body = the entry.
   - Set `alert_sent: [push, email]`.

6. **The triggered message must say, explicitly:**
   - The macro leg is live — it is time to **RE-UNDERWRITE** the candidate names
     (KO / GSK / LSEG; optional Halma / Spirax-Sarco / Croda; DGE excluded).
   - This is **NOT a buy signal.** No sizing. No execution.
   - A buy would still require: **name in its target zone** AND a **passing
     re-underwrite** (fundamentals intact, weakness is market-driven).
   - **Target zones are still OPEN** — flag that they need setting with fresh
     prices before any buy could even be evaluated.

## Hard rules
- Never place/modify/cancel an order.
- Never suggest sizing or execution, even when triggered.
- Calibration sanity check: a pure sector rout is not a trigger (5 Jun 2026:
  SOX -10.3% but S&P only -2.6%, VIX ~21 → correctly does NOT activate).
- Output strictly per `DRIVE_OUTPUT_FORMAT.md` §3.1.
