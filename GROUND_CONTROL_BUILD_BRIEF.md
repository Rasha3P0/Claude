# Ground Control — Master Build Brief
**Version 3.0 — June 2026** (supersedes v2.0)

This is the single hand-off document for Ground Control. Give it to a new
Claude Code session and it has everything needed to build further: current
state, the **repo and branch to work on**, the architecture, the data model,
how to run/verify in the sandbox, and what is still pending.

> **The app already exists and is live.** Do **not** rebuild from scratch.
> Read "Current state" and "Architecture", then extend. v2.0 (the original
> one-shot spec, pasted into a claude.ai Fable chat) is preserved below as the
> module reference and source-of-truth seed data — every module in it is
> already implemented.

---

## 0. START HERE (new session quick-orient)

| Thing | Value |
|-------|-------|
| **GitHub repo** | `Rasha3P0/Claude` (a.k.a. `rasha3p0/claude`) — repo description "Fable maxxing" |
| **Canonical branch** | **`main`** — branch off it for all new work. Current `main` tip: PR #8 (`Add wins tracking, experiments, personal events, and streak milestones`). |
| **What it is** | A single-file React 18 PWA. No build step. `index.html` (~2.8k lines) holds the whole app; React + Babel load from CDN. |
| **Deploy** | Static. Vercel (`vercel.json`) or Netlify (`netlify.toml`). Deploy repo root as-is. Vercel auto-deploys PRs (status check "Vercel"). |
| **Storage** | Everything in `localStorage`. No backend. |
| **Tone / rules** | Peer-level, analytical, direct. **No motivational language. No exclamation marks.** ADHD rules are non-negotiable (see §3). |
| **GitHub access** | Via `mcp__github__*` MCP tools, scoped to this repo. No `gh` CLI. |

**Workflow for a change:**
1. `git checkout main && git pull origin main`
2. Create a feature branch off `main` (e.g. `git checkout -b claude/<topic>`).
3. Build → commit → `git push -u origin <branch>`.
4. Open a PR (only when asked) **with base = `main`** — see the gotcha in §2.
5. Squash-merge to `main` (the repo convention is a squash commit titled `… (#N)`).

---

## 1. What this is

Ground Control is a **persistent second brain** for an ADHD adult managing
interlocking systems:

1. **Life systems** — fitness volume, diet adherence, work stress, daily energy.
2. **Trading portfolio** — milestone alerts, DCA reminders, time-critical actions.
3. **Notification layer** — client-side scheduled push for time/event triggers.
4. **Drive sync** — copy/paste markdown write-back on action confirmation (OAuth is phase 2).
5. **Wins + life-load layer** (added in PR #8) — capture completed reality, and
   model personal life-stress alongside work-stress.

The app **orients before it asks**. Every screen opens with context. It never
shows a blank form. The user should never have to remember anything to use it.

**Tone:** peer-level, analytical, direct. Like a well-organised colleague who
has read all your notes. No motivational language, no exclamation marks anywhere.

---

## 2. Working in this environment (hard-won notes)

These are sandbox realities a new session **will** hit. Save yourself the rediscovery.

- **The React/Babel CDN is blocked.** `index.html` loads React, ReactDOM and
  `@babel/standalone` from `unpkg.com`. In the Claude Code web sandbox, outbound
  HTTPS to unpkg/jsdelivr/cdnjs is intercepted and returns **403 / cert errors**,
  so the app will not render in a headless browser as-is. **Do not "fix" this by
  changing the committed `<script src>` tags — production needs the CDN.**
  - **`registry.npmjs.org` IS reachable.** To test locally, vendor the libs:
    ```
    cd /tmp && mkdir v && cd v && npm init -y && \
      npm install react@18.2.0 react-dom@18.2.0 @babel/standalone@7.24.7
    ```
    Then copy `index.html` to a throwaway file, rewrite only the three CDN
    `<script src>` URLs to the local `node_modules` paths, serve, and test.
    **Never commit that rewritten copy.**
- **Headless browser:** Playwright is installed globally; a Chromium binary is at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (launch with `--no-sandbox`).
  `http-server` is global for serving. Drive the real UI to catch runtime errors
  the way real users hit them (e.g. set the Log date into a future week to verify
  effective week-type).
- **Syntax check without a browser:** `npx prettier --parser babel <file>` parses
  the extracted Babel/JSX block and exits non-zero on a syntax error. Fast sanity gate.
  `prettier`, `eslint`, `typescript` are all installed globally.
- **Git proxy quirks:**
  - `git push --force-with-lease` works (needed after a rebase).
  - **Branch deletion is blocked** — `git push origin --delete <branch>` returns
    **HTTP 403**. Delete merged branches from the GitHub PR/branches UI instead.
    (The MCP toolset has no delete-branch operation either.)
- **PR base gotcha (important):** when a PR is created from the Claude Code UI it
  may be **based on the working branch's parent, not `main`**. Before merging to
  `main`: retarget the PR base to `main` (`mcp__github__update_pull_request` with
  `base: "main"`). Because earlier PRs were **squash-merged**, `main` and a feature
  branch can carry the *same content as different commits*; retargeting may then show
  `mergeable_state: "dirty"`. Fix by rebasing your real commit(s) onto `main` and
  force-pushing:
  ```
  git fetch origin main
  git rebase --onto origin/main <old-base-sha> <your-branch>   # drops the redundant commit
  git push --force-with-lease origin <your-branch>
  ```
  This is safe when the feature branch's parent tree is identical to `main` (verify
  with `git diff --quiet origin/main <branch-tip>` → identical means nothing is lost).

---

## 3. ADHD accommodation rules (non-negotiable throughout)

- **Dashboard-first:** context before input, always.
- **Maximum 3 taps** to complete any action.
- **Pre-filled defaults everywhere.** No blank forms, ever.
- **Visible progress is the motivator** — not encouragement text.
- No emojis except tab icons and the reward/streak moments. No exclamation marks.
- Don't let any count or target set an implicit bar that triggers shame.

### User context
- ADHD adult, late-diagnosed, on **Elvanse**. Executive-function deficits are structural.
- On **Estrodot** (estradiol patch) — adjustment window: daytime tiredness is physiological.
- Two school-age children; partner **Joy** shares logistics.
- **Job:** Test & Release Manager, SAP/Blue Yonder programme.
- Body weight 66 kg. Equipment: resistance band #5, 2×4 kg dumbbells, 8 kg kettlebell.
- Weekly protein target 1180 g (scales by week type). Water minimum 3 L/day.
- **Phone-only user** — everything is used on a mobile browser at ~390 px.

> **Date anchoring:** all seed data and the stress calendar are anchored to
> **mid-2026** (the app treats `new Date()` as "today"; this session's "today" is
> **2026-06-13**, a HIGH work week). If you build much later than mid-2026, the
> seeded calendar/milestones/events will be in the past — refresh them or expect
> "today" to fall outside the seeded ranges (the app degrades gracefully to LOW).

---

## 4. Current state — what is already built (PRs #1–#8)

`main` history (each a squash-merged PR):

| PR | Summary |
|----|---------|
| #1 | Ground Control PWA shell (manifest, service worker, nav, storage). |
| #2 | Dopamine-maxxing visual redesign + reward layer (confetti, haptics, `celebrate`). |
| #3 | Skins (5 themes), more pink, historical day logging. |
| #4 | Log tab pre-fills exercises from the volume map. |
| #5 | Per-set logging (`sets:[{weight,reps}]`) for progressive load. |
| #6 | Today tab ADHD pass: one-tap logging, urgency, novelty (rotating insight). |
| #7 | Editable focus, alert advance/retire fix, exercise reorder, dopamine tab bar. |
| #8 | **Wins, experiments, personal events, streak milestones, editable lists, per-exercise notes** (the six items in §8). |

All six modules of the v2.0 spec (§7) are implemented. The §8 additions are
implemented and verified in a headless browser at 390 px.

### Files in the repo
| File | Purpose |
|------|---------|
| `index.html` | The entire React app (React 18 + Babel standalone via CDN, no build step). |
| `manifest.json` | PWA install manifest. |
| `sw.js` | Service worker — app-shell cache, offline, push + scheduled notifications. |
| `vercel.json` / `netlify.toml` | Deploy configs (headers, SPA fallback, SW headers). |
| `icons/` | 192/512 + maskable + 180 apple-touch icons. |
| `make_icons.py` | Pure-stdlib icon generator (re-run to regenerate). |
| `README.md` | Short deploy + how-it-works doc (kept in sync with features). |
| `GROUND_CONTROL_BUILD_BRIEF.md` | **This file.** |

---

## 5. Architecture & code map (`index.html`)

One file. `<style>` block at the top (design tokens, skins, components), then a
single `<script type="text/babel">` with the whole app. Approx. line anchors
(as of PR #8 — they drift as the file grows, use them as a starting point):

| Section | ~Line | Notes |
|---------|------:|-------|
| `store` (localStorage wrapper) | 469 | `get/set/del/keys`, all JSON. |
| Seed constants | 484 | volume map, calendar, milestones, seed logs, settings, skins, friction types. |
| `DEFAULT_SETTINGS` | 543 | includes `focusOptions`, `winCategories`, `lastWinCategory`. |
| `EXPERIMENTS` / `SEED_WINS` / `SEED_EVENTS` | 570 / 586 / 611 | item 3 / 5 / 6 seeds. |
| Date + domain helpers | 618 | `isoDate`, `parseISO`, `mondayOf`, `weekTypeFor`, `weeklyTargets`, milestone next-fire logic. |
| **Life-stress layer** | 657 | `SEV`, `maxType`, `lifeStressForWeek`, `effectiveWeekFor`, `heavyClusters`, `clusterDateRange`. |
| **Wins helpers** | 712 | `makeWin`, `getWins`, `normWin`, `winTime`, `experimentFor`. |
| Coach message rules | 801 | `coachMessage(ctx)` — ordered rules, personal-HIGH condition before default. |
| `emptyLog`, `dayCounts`, `computeStreak`, `STREAK_MILESTONES`, `milestoneSub` | ~820–910 | streak counts wins; milestone tiers. |
| Seed on first launch + migration | 937 | `seedIfNeeded()` — seeds fresh; **non-destructively migrates** older installs (adds `gc_events`, `focusOptions`, `winCategories`, `lastWinCategory`). |
| UI primitives + dopamine layer | 1010 | `ProgressBar`, `Segment`, `Ring`, `useCountUp`, `Reward` (has a `big` milestone variant). |
| `App` (root) | 1156 | state, effective `week`, scheduling, streak-milestone effect, renders tabs + reward overlays. |
| Today tab | 1378 | `FocusCard`, `WinsCard`, `WinsHistorySheet`, `ExperimentCard`, `UpcomingCard`, `UpcomingEventsSheet`, `TodayTab`, `QuickSetSheet`. |
| Alerts tab | 1824 | `AlertsTab`, `AlertScreen` (Confirm/Snooze/Dismiss + Drive markdown). |
| Log tab | 2008 | `LogTab`, `DayEditor` (per-set + per-exercise notes; preserves focus/wins/experiment on save). |
| Patterns tab | 2328 | month summary, week table (effective type), correlations, **experiments correlation**, export. |
| `StringListEditor` | 2512 | reusable add/remove/reorder for string lists (focus options, win categories). |
| Settings tab | 2549 | targets, skins, exercises, **focus list**, **win categories**, stress calendar, **personal events**, milestones, data export/import/clear. |
| Boot | end | `seedIfNeeded(); ReactDOM.createRoot(...).render(<App/>)`. |

**Reward layer (reuse it — do not bolt on parallel celebrations):**
`celebrate(r)` → small per-day `Reward`. Streak milestones set a separate
`milestoneReward` rendered as `<Reward big …>` (bigger, layered on top, ~1.5 s
after the small one). `computeStreak` + `dayCounts` drive both; `gc_milestone_seen`
prevents re-firing.

---

## 6. Data storage (localStorage)

| Key | Value |
|-----|-------|
| `gc_settings` | settings object (see below). |
| `gc_seeded` | boolean — don't re-seed. |
| `gc_events` | **array of personal events** `{ id, date, label, load:"heavy"\|"light", note }`. |
| `gc_milestone_seen` | `{ [streakValue]: "YYYY-MM-DD" }` — milestones already celebrated. |
| `log_YYYY-MM-DD` | daily log entry (see shape below). |
| `milestone_[id]` | milestone config. |
| `alert_log_[id]_[ts]` | alert response record `{ id, name, project, response, note, timestamp }`. |
| `push_subscription` | Web Push subscription object (phase-2). |

**`gc_settings` shape:**
```js
{
  bodyWeight: 66, proteinWeekly: 1180, waterDaily: 3,
  volumeMap: { ... },            // exercise → kg/rep
  stressCalendar: [ ... ],       // work-stress week ranges
  focusOptions: [ ... ],         // editable Today's-focus quick wins (item 1)
  winCategories: [ ... ],        // editable win categories (item 5)
  lastWinCategory: "General",    // pre-selected chip on the Wins quick-add
  notifPermission, notifAsked, theme
}
```

**Daily log shape (legacy-safe — treat any missing key as empty):**
```js
{
  date, energy, water_hit, elvanse_taken, estrodot_on, sunlight,
  workout: { exercises: [ { name, sets:[{weight,reps}], reps, volume_kg, note? } ],
             life_volume: [ { name, weight_kg, reps, volume_kg } ], total_kg },
  diet: { protein_estimate_g, friction_hit, friction_type },
  work: { stress_felt, note },
  focus, focus_done,                       // Today's focus (item 1 / PR #7)
  wins: [ { id, text, category, ts, source? } ],   // item 5; source: manual|focus|workout|seed
  experiment: { id, text, tried }          // item 3 — recorded for correlation
}
```
**Backward-compatibility contract:** `getWins(log)` returns `[]` when `wins` is
missing; `experiment`, `focus`, and `exercises[].note` are optional. `DayEditor`
spreads the existing log before rebuilding it so Log-tab saves never wipe
`focus`/`wins`/`experiment`. `emptyLog()` initialises `wins: []`.

---

## 7. Module reference (v2.0 spec — IMPLEMENTED; canonical seed data)

> Everything in this section is already built. Keep it as the source of truth for
> seed data and behavioural rules when extending.

### Module 1 — PWA shell + push (`sw.js`, `manifest.json`)
App-shell cache + offline; Web Push registration; `push` and `notificationclick`
handlers (deep-link with milestone id in the URL `?alert=<id>`). Permission flow on
first load (one-sentence why → request → store state; banner if denied).
**Scheduling is client-side** (`setTimeout` → SW `showNotification`), recomputed
on every app open. **Limitation (documented in code):** only fires while the
PWA is open/backgrounded; true closed-app push needs a backend (phase 2) — remind
the user to open weekly.

### Module 2 — Trading alerts + Drive write-back
Full-screen `AlertScreen`: project badge, name, action text, one context fact,
and **[✓ Confirm] / [⏰ Snooze 24h] / [✗ Dismiss]**. Confirm/Dismiss generates a
markdown block and offers **[Copy log entry]** + **[Open Drive]** (OAuth append is
phase-2 TODO). Per-project action history with last-30-days / all-time filter.

**Allocation context:** ISA ~£13,661 (10 Jun 2026), Freetrade Basic. Cash 3–5%,
Gilts ~20%, Quality+div 55–60%, Spec sleeve 10–15% (sensible 9–11%, risky 4–6%).

**Pre-loaded milestones (`DEFAULT_MILESTONES`):**
```json
[
 {"id":"smgb_jul","project":"Trading","name":"SMGB DCA — July tranche","type":"recurring_monthly","trigger":"last_trading_day_of_month","months":["2026-07","2026-08","2026-09","2026-10","2026-11","2026-12","2027-01","2027-02","2027-03"],"action":"Buy 1 share SMGB at market price on Freetrade. No limit order, no timing within month. Log purchase price and cumulative shares.","next_fire":"2026-07-31","drive_file":"portfolio_dashboard"},
 {"id":"soun_reassess","project":"Trading","name":"SOUN limit sell reassessment","type":"date","trigger":"2026-06-30","action":"Check if $7.90 limit sell on 40 SOUN shares has filled. If unfilled: exit at market to clean up framework violation. SOUN has no thesis — it was an accidental purchase. Log decision.","drive_file":"portfolio_dashboard"},
 {"id":"tbill_roll","project":"Trading","name":"T-bill maturity — confirm 100% roll","type":"date","trigger":"2026-07-01","action":"T-bill matures ~3 Jul. Confirm Freetrade has auto-rolled 100% as instructed. Check the rolled amount matches the ~£2,415 gilt allocation. No action needed if rolled correctly — log confirmation.","drive_file":"portfolio_dashboard"},
 {"id":"unh_q2","project":"Trading","name":"UNH Q2 results — MCR data review","type":"date","trigger":"2026-07-10","action":"UNH Q2 results expected ~10–28 Jul (verify via UNH IR). Key data point: Medical Cost Ratio. Review against hold thesis. Decision: continue hold or exit. Log outcome.","drive_file":"portfolio_dashboard"},
 {"id":"riol_vfem_rotation","project":"Trading","name":"RIOL → VFEM rotation","type":"date","trigger":"2026-07-25","action":"Execute planned rotation: sell RIOL (£406 approx), buy VFEM same day. Both LSE-listed UCITS — no FX, no stamp. VFEM reclassifies to core sleeve (not spec). Check spec sleeve stays under 15% ceiling post-trade. Do alongside next SMGB tranche if possible.","drive_file":"portfolio_dashboard"},
 {"id":"anic_reassess","project":"Trading","name":"ANIC limit sell expiry check","type":"date","trigger":"2026-09-01","action":"ANIC limit sell (663 sh @ 0.08p = ~£53) expires 6 Sep. Check fill status. If unfilled and no thesis improvement: let expire and review whether to requeue or exit at market. Log decision.","drive_file":"portfolio_dashboard"},
 {"id":"spec_monthly_check","project":"Trading","name":"Spec sleeve monthly check","type":"recurring_monthly","trigger":"1st_of_month","months":["2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"],"action":"Check spec sleeve allocation: total must be ≤15% ISA value. Sensible sub-pot target 10% (band 9–11%). Risky sub-pot target 5% (band 4–6%). If any band breached: trim to target, cut in conviction order (SOUN first → ANIC → gains on spikes → lowest conviction). Log current percentages and any action taken.","next_fire":"2026-07-01","drive_file":"portfolio_dashboard"},
 {"id":"cing_quarterly","project":"Trading","name":"CING conviction hold quarterly check","type":"recurring_quarterly","trigger":"quarterly","next_fire":"2026-09-02","action":"Review CING position (30 shares, conviction hold post-CRL). Check resubmission progress, cash runway into 2027, dilution, management stability. Only exit on hard triggers. Log quarterly review.","drive_file":"portfolio_dashboard"}
]
```
(In code each milestone also carries a short `context` string for the alert card.)

### Module 3 — Today tab (life coach dashboard)
Orientation block: week-type badge, week note, date, target pills
(Volume/Protein/Water), next-trading-alert row, single next-best CTA. Today's
progress rings. Quick log (energy/water/Elvanse/Estrodot). Coach message.

**Work stress calendar (`DEFAULT_CALENDAR`):**
```json
[
 {"start":"2026-06-10","end":"2026-06-15","type":"HIGH","note":"Survey close + GPT testing + distribution"},
 {"start":"2026-06-17","end":"2026-06-22","type":"HIGH","note":"SNOW synthesis + two decisions due Friday"},
 {"start":"2026-06-24","end":"2026-07-12","type":"LOW","note":"Decision phase clear, single-threaded"},
 {"start":"2026-07-13","end":"2026-07-27","type":"MEDIUM","note":"Royalties + ONIX extract builds"},
 {"start":"2026-08-01","end":"2026-08-16","type":"LOW","note":"Pre-consult, mostly waiting"},
 {"start":"2026-08-17","end":"2026-08-31","type":"MEDIUM","note":"ONIX + consult materials"},
 {"start":"2026-09-01","end":"2026-09-13","type":"MEDIUM","note":"Townhall outline + visuals"},
 {"start":"2026-09-14","end":"2026-09-21","type":"HIGH","note":"Townhall delivery week"},
 {"start":"2026-09-22","end":"2026-09-30","type":"LOW","note":"Post-delivery recovery bounce"}
]
```
**Week-type targets:** HIGH = 1120 kg / 900 g · MEDIUM = 1820 kg / 1050 g ·
LOW = 2800 kg / 1180 g (baseline 2800 kg/wk; daily = weekly ÷ 7).

**Coach rules** (evaluated in order; analytical, ≤3 sentences): Estrodot+energy≤2 →
physiological; HIGH+no workout+after 17:00 → one 15-min session counts;
HIGH+workout → adjusted target met; water not hit+after 14:00 → dehydration;
LOW+workout → catch-up window; MEDIUM+energy≤2 → one shorter session; LOW+energy≥4+no
workout → push volume; **[item 6] personal-HIGH window within 7 days → overrides a
quiet work week, plan as HIGH**; default → "Log energy and water to get a read on today."

### Module 4 — Log tab (workout + diet)
**Volume map (`DEFAULT_VOLUME_MAP`, kg/rep):** `Deadlifts 54, OH Press 8, Squats 66,
Push-ups 33, KB Swings 8, Squat+OP Combo 74` (push-ups = 50% body weight).
Top-5 pre-fill the workout; per-set weight×reps; body-weight chip; life-volume
presets (Vacuum 7.5, Groceries ~15, Kid 20, Kid 34, Stairs carry); diet check-in
(protein estimate + friction type); daily context; **per-exercise rest/notes (item 2)**.
`[Save Day]` returns to Today.

**Seed logs (`SEED_LOGS`) — 3 sessions:** 2026-06-02 (1441 kg), 06-03 (2032 kg),
06-05 (1704 kg). (See git history / code for exact per-exercise breakdown.)

### Module 5 — Patterns tab
Month summary; week-by-week table (Week · Type · Vol · vs% · Prot · Fr · Energy;
green ≥90 / amber 60–89 / red <60); text correlations after 4+ weeks; **experiments
correlation (item 3)**; export (full JSON + weekly-summary markdown). **Week type in
the table uses the effective (max work,life) type.**

### Module 6 — Settings tab
Body weight / protein / water targets; skins; exercise volume map (reorder/add/remove);
**focus list (item 1)**; **win categories (item 5)**; stress calendar; **personal events
(item 6)**; milestones; export / import / clear-all (type DELETE).

### Optional API coach layer
A `getCoachMessageAPI` block exists but is **disabled** — browser calls to the model
API need a key-bearing proxy (CORS + key safety). Static rules ship by default; fall
through to them on null and cache ~30 min if enabled. **When enabling, use the latest
available Claude model.** (Do not hard-code internal model identifiers in commits.)

---

## 8. PR #8 additions (the six small-batch items — IMPLEMENTED)

1. **Editable focus quick-win list.** `settings.focusOptions` drives the Today's-focus
   picker; add/remove/reorder via `StringListEditor` in Settings.
2. **Per-exercise rest/notes in the Log.** Optional `exercises[].note`, collapsed behind
   a `+ rest / notes` toggle, only persisted when non-empty (legacy-safe).
3. **Rotating "today's experiment."** `EXPERIMENTS` (10 ADHD prompts); `experimentFor(date)`
   rotates one deterministically by day-of-year; a "tried" toggle records
   `log.experiment = {id,text,tried}`. Patterns shows a basic tried-vs-other correlation
   (avg volume + focus-done rate).
4. **Streak milestone celebrations.** `STREAK_MILESTONES = [3,7,14,21,30,50,75,100]`. Reuses
   the existing reward layer as a larger `<Reward big>` moment, layered on top of the
   unchanged per-day moment; fires once per milestone **only on the completing day**
   (`gc_milestone_seen` guards re-firing; a reset + re-climb celebrates again).
5. **Wins log.** `WinsCard` below the focus list: large count, newest-first day list,
   ≤3-tap quick-add (text + category chip pre-set to last-used), editable categories,
   history bottom-sheet. Stored as `log.wins[]`. **Auto-capture** from focus completion
   and workout save (deduped by `source`/normalised text). **Wins count toward the
   streak** (`dayCounts` includes them) and feed the **existing** reward layer (first win
   of the day fires the per-day moment) — no new celebration type. Seeded with 16 wins
   for 2026-06-13 (a high-water-mark day — explicitly **not** a daily bar).
   - Categories: `Tech · Household · People & Work · Planning Ahead · General` (default General).
6. **Personal events / life-stress layer.** `gc_events` (own key). `effectiveWeekFor` =
   `max(work-stress, life-stress)`, used **everywhere** (badge, targets, nav colour, coach,
   Patterns). Cluster rule (v1): **2+ heavy events within a 4-day window → HIGH**, 1+ heavy →
   MEDIUM, else LOW. Today shows both when they differ ("Work: LOW · Life: HIGH → plan as
   HIGH"), an **Upcoming** card (next 1–2 events + days-away; explicit callout if a personal-HIGH
   cluster is within 10 days), and a coach condition (personal-HIGH within 7 days). Seeded
   with the **Jul 2/4/5** heavy cluster — the canonical `max(work,life)` test: that week is
   LOW for work but must present as **HIGH**.
   - Event shape: `{ id, date, label, load:"heavy"|"light", note }`.

---

## 9. Design tokens

The shipped palette is darker/more saturated than v2.0, with 5 selectable skins
(default "Hot Pink"). Reference values (see the `:root` and `.app[data-skin=…]`
blocks in `index.html` for the live set):
```
--bg #090c12  --surface #151b24  --border #2a3340
--text-primary #f1f5fa  --text-secondary #8b96a6
--high #ff5d54  --medium #ffb224  --low #3fe07a
--blue #5cb6ff (life volume)  --purple #c792ff (health)  --amber #ffb224 (warnings)
--accent-1/2/3 + gradients are skin-driven.
```
Layout: max-width **430 px** centred, fixed bottom nav (60 px), content scrolls,
safe-area padding. **All tap targets ≥44 px.** Motion: 100 ms tab fade, ring/bar
ease on mount, reward pop/confetti. **Active nav colour = effective week type.**
**No `<form>` tags** — `onClick`/`onChange` only.

---

## 10. Success criteria (carry-over + PR #8)

**Core (v2.0):** PWA installs; permission requested on first load; SMGB July DCA fires;
alert card shows action + three buttons; Confirm copies a Drive log; Today shows the
correct week badge/note for the current day; 3 seed sessions visible; live volume calc;
energy/water persist across tabs; Patterns week table renders; export copies correct
text; data survives refresh; tap targets ≥44 px at 390 px; **no `<form>` tags**.

**PR #8:** focus list / win categories editable; missing `wins` on old entries → `[]`
(no crash); completing a focus logs a win without double-firing; wins feed the existing
streak/reward layer (no new celebration type); seed wins for 2026-06-13 visible;
`gc_events` seeded and Jul 2/4/5 in Upcoming; week of Jun 29–Jul 5 presents as effective
**HIGH** (Work LOW · Life HIGH) with the mismatch shown and the coach condition firing
within 7 days; nav colour + targets + badge follow the effective (max) week type.

---

## 11. Pending / future modules (not yet built)

Add these as elicitation prompts are completed; re-prioritise on request.

- **Driving theory revision tool** — targeted quiz, Alertness + Attitude focus, spaced repetition.
- **ND menopause app** — GP appointment prep, symptom articulation, beta cohort flow.
- **Diet management module** — PT plan integration, grocery→protein flow, friction removal.
- **Career positioning tracker** — evidence bank, PM/SA track, interview prep.

Likely near-term polish on the existing app (candidate backlog, not committed):
- Optional push reminder 3 days before a heavy personal event (infra exists; display-first today).
- Google Drive OAuth write-back (phase 2; currently copy/paste).
- Enable the API coach layer behind a proxy.
- Refresh seed calendar/milestones/events when the real date moves past mid-2026.

---

## 12. Changelog
- **v3.0 (Jun 2026)** — Rewritten as a stateful hand-off: repo/branch/workflow,
  sandbox build-and-verify notes, full data model, code map, and PR #1–#8 state.
  Documents the wins, experiments, personal-events/life-stress, streak-milestone,
  editable-list, and per-exercise-notes additions (PR #8).
- **v2.0 (Jun 2026)** — Original one-shot PWA spec (Modules 1–6), preserved above
  as the implemented module reference and canonical seed data.

*Next update: paste a completed elicitation block from any pending project, or a new
small-batch spec, and request re-prioritisation.*
