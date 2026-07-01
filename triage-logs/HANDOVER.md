# Inbox Triage — Handover Document

**Last updated:** 2026-07-01  
**Written by:** Claude Sonnet 5 (session ending)  
**For:** Next Claude session picking up this routine

---

## What this routine does

Daily at 07:30 Europe/London, scan the Gmail inbox and split it into two piles:

- **`Triage/Look`** — things that need human eyes (school, DVSA, receipts, account activity, appointments, security codes)
- **`Triage/Archive?`** — safe-to-bin noise (recruiters, Groupon, Moonpig, LinkedIn notifications, newsletters)

Phase 1 (current): labels are applied but **nothing is removed from inbox**. The user reviews and can rescue anything from `Triage/Archive?` before a future phase graduates to auto-archiving.

---

## Current trust state

```yaml
phase: 1
auto_archive: false
clean_runs: 4          # consecutive runs where user rescued nothing from Archive? (held, see 2026-07-01 note below)
archive_proposals_seen: 152   # cumulative across all runs
```

**2026-07-01 note:** `label:Label_9` / `label:Label_10` searches return zero results even right after a successful `label_thread` call (verified the label WAS applied via direct `get_thread`). Rescue detection via `in:inbox -label:Triage/Archive?` is currently unreliable — label search appears to lag/not index custom labels in this environment. Until fixed, verify rescues via per-thread `get_thread` lookups (need thread IDs recorded in logs) rather than trusting `search_threads` label queries. Also: two consecutive missed weekday runs (29–30 Jun) before this one — worth checking whether the schedule is firing reliably.

**Graduation rule** (hard-coded, not vibes):  
Phase 3 (auto-archive) only when `clean_runs >= 3` AND `archive_proposals_seen >= 30`.  
`clean_runs` is reset to 0 any time the user moves something out of `Triage/Archive?` back to inbox.  
Auto-archive must be manually confirmed even once eligible — the routine never self-promotes.

---

## Gmail label IDs (don't re-create these)

| Display name | Gmail label ID |
|---|---|
| `Triage/Look` | `Label_9` |
| `Triage/Archive?` | `Label_10` |

The parent `Triage` label is auto-created. These IDs are stable — use them directly in `label_thread` calls without calling `create_label` again.

---

## What happened in this session (2026-06-19)

This was the **first ever run**. Key events:

1. **7-day backlog** scanned (`newer_than:7d`) — 84 threads, 2 pages.
2. **Gmail write access failed** on first attempt (token expired mid-session). Labels were applied on a second run after the token re-authorised.
3. **26 threads** → `Triage/Look`, **58 threads** → `Triage/Archive?`.
4. **4 time-sensitive items** flagged (see log `2026-06-19_0730_triage.md`):
   - Caterlink: Arinjoy Bhattacharjee's school meal credit low
   - Year 4 Givaudan trip cancelled (Mon 22 / Tue 23 Jun)
   - Enterprise Afternoon timing change (today, now past)
   - Year 1 Animal Experience — sign up via Arbor app (02 Jul)

---

## Routine steps (exact order, every run)

1. **Heartbeat** — `ls triage-logs/` for dated logs. Flag `missed_run` if a weekday has no log. Skip weekends.
2. **Gather** — `search_threads` with `in:inbox newer_than:1d` (first run: `newer_than:7d`), `pageSize:50`. Paginate if `nextPageToken` present.
3. **Classify** — KEEP / ARCHIVE-ELIGIBLE / BORDERLINE (always → KEEP).
4. **Verify dangerous direction** — re-check every ARCHIVE candidate against every KEEP rule and protected signal. One match = KEEP.
5. **Act (Phase 1)** — `label_thread` with `Label_9` (KEEP) or `Label_10` (ARCHIVE?). Do NOT remove `INBOX`.
6. **Measure trust** — search for threads that had `Triage/Archive?` (Label_10) but are now back in INBOX without it — those are rescues. Decrement `clean_runs` to 0 on any rescue; increment on zero.
7. **Log** — write `triage-logs/YYYY-MM-DD_HHMM_triage.md`. Never edit past logs.
8. **Notify** — only if `needs_attention`, `missed_run`, `eligible_to_automate`, or `error`. Silent on `quiet`.

---

## Classification rules

### KEEP — always surface
- **School:** any email from `willesborough-js.kent.sch.uk` or `willesborough-infant.kent.sch.uk` — newsletters, trips, event times, SENDCO letters, attendance. **User cares most about Year 1 and Year 4 specifically.**
- **DVSA / gov.uk:** theory test bookings, confirmations, codes, payments.
- **The AA:** driving lesson confirmations (`dsproduct@theaa.com`).
- **Freetrade ACCOUNT ACTIVITY only:** dividends, interest, statements, contract notes — from `hello@freetrade.io`. NOT from `marketing@marketing.freetrade.io`.
- **Payment receipts / invoices** addressed to user by name.

### Protected signals — force KEEP regardless of sender
- Contains a child's name (known: **Arinjoy Bhattacharjee**)
- Contains: booking reference, appointment date/time, invoice/payment confirmation, deadline/expiry, security/verification code (while valid)

### ARCHIVE-ELIGIBLE — propose archiving
- LinkedIn job alerts (jobalerts-noreply, jobs-listings, updates-noreply) — seen: LSEG, RSHP, M&S, Stanton House, Arcus Search, Visa, Lloyds
- LinkedIn social noise (messages-noreply, notifications-noreply) — "popular in network", "new invitation", "add X"
- Groupon (`noreply@r.grouponmail.co.uk`) — sends 2–4/day; always noise
- Retail: Moonpig, AO, Homesense, Patisserie Valerie, Deliveroo, eBay, Spotify, Cartier, Pickle Barrel, BD Gift
- Travel: BestAtTravel, Yopa, Hunters, Pegasus
- Newsletters: The Rundown AI, HeyGen, TheSuccessSmith, Twinkl (marketing emails)
- Investment marketing: StockInvest, EquityZen, Freetrade marketing
- SaaS: Atlassian trial/upgrade emails

### Borderline — KEEP during review (get more examples before deciding)
- School-linked commercial promos (photo magnets from Magnetic Moments sent by the school) — seen twice from both schools. Likely the right call is to archive once confirmed as recurring fundraiser pattern.
- Supermarket delivery notifications (Iceland) — stale once delivered; not a payment receipt. Probably archive-eligible after first example.
- Uswitch energy comparison emails — contain real rate-change info but are promotional. Worth a KEEP rule clarification from user.

---

## School email structure

Two separate schools, two email domains:

| Domain | School | Years |
|---|---|---|
| `willesborough-js.kent.sch.uk` | Willesborough Junior School | Years 3–6 (ages 7–11) |
| `willesborough-infant.kent.sch.uk` | Willesborough Infant School | Years 1–2 (ages 5–7) |

**User's children of interest:** Year 1 (infant school) and Year 4 (junior school).  
**Known child:** Arinjoy Bhattacharjee (Caterlink, Student ID A317206621144).  
**Known family member:** Joy (joy_bhattacharjee014@yahoo.com) — chiropractic appointment forwarded to them.

---

## Newsletter PDF scanning — current limitation

School newsletters arrive as PDF attachments (e.g. `TWS Newsletter 25-26 T6W3.pdf`).  
The Gmail MCP (`get_thread`) returns the attachment ID but **has no download/read tool** — the PDF content cannot be accessed.

**Workaround options:**
1. User forwards newsletters to a Google Drive folder → Google Drive MCP (`read_file_content`) can read them.
2. Gmail MCP gains a `get_attachment` tool in a future update.

Until then: flag every newsletter in `Triage/Look` and note "PDF not scanned — check manually for Year 1 / Year 4 items."

---

## Log files

Location: `triage-logs/` in this repo.  
Format: `YYYY-MM-DD_HHMM_triage.md`  
Rule: **never edit a past log**. Corrections go in a new entry.

Current logs:
- `2026-06-19_0730_triage.md` — first run, 7-day backlog, 84 threads, labels applied on second attempt.

---

## How to detect rescues (Step 6)

Search for threads that were labelled `Triage/Archive?` last run but are no longer carrying it, AND are still in INBOX:

```
label_search: in:inbox -label:Triage/Archive?
```

Cross-reference against the previous log's archive list. Any thread that appeared there but is now missing the label = rescue. Each rescue resets `clean_runs` to 0.

Alternatively: `search_threads` with query `in:inbox has:nouserlabels` will catch threads the user manually cleaned — but is less precise. The label-absence method is more reliable.

---

## Infrastructure notes

- **Branch:** `claude/upbeat-hawking-s5gpdu` in `rasha3p0/Claude`
- **PushNotification tool:** not provisioned in this environment. Notification channel is the session transcript + GitHub commit. If a notification tool becomes available in future, use it for `needs_attention` runs.
- **Gmail MCP auth:** token expired once during this session. If `create_label` or `label_thread` returns 403 or "requires re-authorization", the session needs to be re-run after the user re-authenticates Gmail in Claude Code settings.
- **Pagination:** Gmail's `resultCountEstimate` is unreliable — always paginate until `nextPageToken` is absent.

---

## Status vocabulary (quick reference)

| Status | When to use |
|---|---|
| `quiet` | Fetch succeeded, KEEP list surfaced, nothing time-sensitive. Only if fetch was complete. |
| `needs_attention` | A KEEP item is genuinely time-sensitive. Name it. Triggers notification. |
| `eligible_to_automate` | `clean_runs >= 3` AND `archive_proposals_seen >= 30`. Surface to user; do not self-promote. |
| `missed_run` | Weekday gap detected in log history. |
| `error` / `data_incomplete` | Fetch failed or partial. Never downgrade to `quiet`. |
