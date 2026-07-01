# Runbook — Monthly Check-in Scaffold (DRAFT only)

**Cadence:** monthly, 1st of month (suggested 08:00 Europe/London), matching the
dashboard's `spec_monthly_check` ("1st_of_month"). **Drafts only — never commits.**

Pair this with a `reconcile` run the same day (the check-in needs live bucket
figures; the reconcile produces them and the DRAFT dashboard).

---

## Inputs
- Canonical dashboard: highest `portfolio_dashboard_vNN.md` (no `_DRAFT`) in Drive
  (or the repo's `automation/baseline/portfolio_dashboard_v29.md` if Drive has none yet).
- `automation/data/framework_params.json`, `automation/data/holdings_registry.json`.
- Live prices (fresh, this run) and live UK macro (fresh).

## Steps

1. **Recompute the spec £ caps off the CURRENT ISA value** (from the same-day
   reconcile, which marks everything to live prices — never cache). **Show the
   arithmetic** in the body:
   - `spec_ceiling = ISA * 0.15`   (total hard ceiling)
   - `sensible_target = ISA * 0.10`,  band `ISA * 0.09 .. ISA * 0.11`
   - `risky_target   = ISA * 0.05`,  band `ISA * 0.04 .. ISA * 0.06`
   - Worked example at ISA = £13,838.06: ceiling £2,075.71; sensible £1,383.81
     (band £1,245.43–£1,522.19); risky £691.90 (band £553.52–£830.28).

2. **Compute the current four-bucket split** (cash / gilt / quality+div / spec)
   and the **spec sub-pots** (sensible / risky) from live prices. Use
   `holdings_registry.json` for bucket/sub-pot classification:
   - quality+div = equities − spec_total − (GBSP + NTR + EVR).
   - sensible = BTEK + SMGB + RBTX + ARCG; risky = ACHR + CING + OKLO.
   - **Flag band breaches** with the §5 keys: quality+div > 60; spec total > 15;
     sensible out of 9–11; risky out of 4–6; withdrawable cash > 5.
   - **Carry the standing caveats verbatim:** sensible < 9% as of v29 is **BY
     DESIGN** ("room to add, NOT instruction to add"); withdrawable cash > 5% is a
     known standing item that external cash covers. Report, don't manufacture action.

3. **Pull current UK macro (fresh):**
   - BoE **base rate** + the **latest MPC decision** (date, vote split, direction).
   - **Latest UK CPI** print (month, YoY %).
   - **Next MPC date.**
   Triangulate from reputable sources (BoE, ONS, Reuters); cite them.

4. **Tick the property countdown:** months to the ~mid-2030 mortgage renewal
   (`months_to_renewal`). Note BTL-relevant macro: rates trajectory
   (higher-for-longer vs cuts), **Renters' Rights Act** status (S21 abolished since
   May 2026; database/ombudsman rollout), property/yield outlook. Reminder: the ISA
   is **not** the property funding source (home-equity draw is) — so macro shifts
   inform context, **not** an ISA trade.

5. **Draft a CHANGELOG STUB** for the user to review — in the entry body, clearly
   marked `DRAFT — not committed`. Use the dashboard's changelog voice (analytical,
   dated, `vNN` style). **Do not** write to the canonical dashboard. (The same-day
   `reconcile` writes the actual DRAFT dashboard file; this stub is the check-in's
   narrative the user can fold in.)

6. **Write** one `checkin` entry file per `DRIVE_OUTPUT_FORMAT.md` §3.2.

7. **Alerts:** if `breaches` is non-empty → push + Gmail draft (per §6) and set
   `alert_sent: [push, email]`. If clean → log only, `alert_sent: []`.

## Hard rules
- Drafts only. Never commit to canonical. Never place/modify/cancel orders.
- Fresh prices + fresh macro every run; cite sources.
- Preserve caveats/deviations verbatim; never tidy a deviation into a rule.
