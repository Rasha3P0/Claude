# Runbook — Read-only Reconcile / Mark-to-Market

**Cadence:** on demand + monthly (same day as the check-in). **Read-only.**
Produces a DRAFT next-version dashboard the user reviews and commits.

---

## Inputs
- Canonical dashboard: highest `portfolio_dashboard_vNN.md` (no `_DRAFT`) in Drive.
- `automation/data/holdings_registry.json` (identity + classification + v29 shares),
  `automation/data/framework_params.json` (bands/ceilings/flags).
- Live prices + live FX, fetched fresh this run.
- Optional: a broker total / figures the user provides this run (for drift).

## Steps

1. **Re-verify tickers (rule 3).** For every holding, confirm ticker → fund name →
   underlying index/holdings. For funds, re-check the underlying/ISIN against the
   registry (e.g. ARCG ISIN IE000O5M6XO1; VFEM = FTSE Emerging, CORE not spec;
   SMGB = VanEck Semiconductor Acc; RBTX = iShares Automation & Robotics; BTEK =
   Nasdaq Biotech; GBSP = physical gold, hedge). Set `tickers_verified` accordingly;
   if any mismatch, flag it loudly in the body and do not guess.

2. **Fetch live prices for EVERY holding** (fresh — never cache, never trust the
   dashboard's figures). For US lines (UNH, KO, ACHR, OKLO, CING, NTR) during UK
   morning: **>= 2 live sources, discard stale outliers.** Get **live USD→GBP FX**
   for US lines. EVR is suspended/dead — cannot fetch; carry last/nominal and flag.

3. **Recompute** each line value (shares × price, × FX for USD lines), then:
   - bucket totals: equities, gilt (T-bill), cash;
   - quality+div = equities − spec_total − (GBSP + NTR + EVR);
   - spec sub-pots: sensible (BTEK+SMGB+RBTX+ARCG), risky (ACHR+CING+OKLO);
   - ISA total = equities + gilt + cash.
   Note: the FX fee (0.99% Basic) is a **trade cost**, not part of valuation — use
   spot FX for marks.

4. **Flag drift + breaches.**
   - If the user provided a broker total, set `drift_gbp = computed − broker` and
     flag anything material.
   - Apply the §5 breach keys. Keep the standing caveats verbatim (sensible < 9%
     BY DESIGN; withdrawable cash > 5% covered by external cash).

5. **Produce the DRAFT next-version dashboard** `portfolio_dashboard_v<NN+1>_DRAFT.md`:
   - Full mark-to-market; holdings table **re-ranked by value** and renumbered.
   - New **CHANGELOG** entry at top: date/time, "full m2m refresh", the recompute,
     buckets vs target, spec sub-pots vs ceiling, day's movers, sources.
   - **PRESERVE every caveat and logged deviation VERBATIM** (cash 3–5% supersedes
     10%; Option B partial reversal; risky-pot gating retired → £-ceiling-only;
     spec-sensible "room to add not instruction to add"; the post-hoc
     trade-confirmation pattern). **Never** rewrite a deviation into a clean rule.
   - **Leave stale sections intact and still flagged stale** (the geography / sector
     / style / concentration breakdown tables) — do not refresh-by-guess, do not delete.
   - It is a **DRAFT**. Do not overwrite canonical. The user promotes it by saving
     as `portfolio_dashboard_v<NN+1>.md`.

6. **Write** one `reconcile` entry file per `DRIVE_OUTPUT_FORMAT.md` §3.3, with a
   pointer to the DRAFT dashboard file.

7. **Alerts:** non-empty `breaches` → push + Gmail draft (§6), `alert_sent:
   [push, email]`. Clean → log only.

## Hard rules
- Read-only: never place/modify/cancel orders; never promote a draft to canonical.
- Fresh prices + FX every run; triangulate US-in-UK-morning; record `sources`.
- Verify tickers before referencing funds.
- Preserve caveats/deviations verbatim; changelog every change.
