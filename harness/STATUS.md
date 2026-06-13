# HARNESS STATUS — Ground Control OAuth/Push build

> Resumability anchor. A resumed session reads THIS FILE FIRST, then continues
> from the last completed stage using only files on disk (per adversarial
> harness v2, §11). Completed stages (file exists + confirmed here) are not redone.

- **Branch:** `claude/ecstatic-noether-9tpfxz` (off `main` @ PR #9)
- **Harness mode:** Mode A (single Opus context plays generator + adjudicator)
  with reviewer fan-out delegated to 3 blind Sonnet subagents reading only the
  artifact on disk. File-based checkpoints per v2 §11.
- **Build target:** (a) Google Drive OAuth write-back for trading alerts;
  (b) background push via VAPID wired into the existing service worker.
- **Iteration cap:** 3 loops (per the OAuth/push harness brief).

---

## CURRENT STATE

**Stage:** 1 — GENERATOR
**Iteration:** v1
**One-line state:** Harness scaffold committed. Beginning Stage 1 implementation.

---

## STAGE LEDGER

| Stage | File(s) | Status |
|-------|---------|--------|
| Scaffold | `harness/STATUS.md`, `harness/README.md` | DONE |
| 1 · Generator (v1) | `harness/artifact_v1/`, `harness/decision_log_v1.md` | IN PROGRESS |
| 2 · Reviewers (v1) | `harness/review_correctness.md`, `review_adversary.md`, `review_maintainability.md` | pending |
| 3 · Adjudicator (v1) | `harness/change_list_v1.md` OR `harness/final_notes.md` | pending |
| 1 · Generator (v2) | `harness/artifact_v2/`, `harness/decision_log_v2.md` | (only if ITERATE) |
| 2 · Reviewers (v2) | … | (only if ITERATE) |
| 3 · Adjudicator (v2) | … | (only if ITERATE) |

---

## HOW TO RESUME

1. Read this file.
2. Read the newest `harness/decision_log_v{N}.md` and any `harness/change_list_v{N}.md`.
3. Continue from the first stage in the ledger not marked DONE. A resumed
   **generator** reads `change_list_v{N}.md` ONLY (cold separation) — not prior reasoning.
4. The live app changes are made directly in `index.html` / `sw.js` / `push-server/`;
   each iteration snapshots a reviewable diff into `harness/artifact_v{N}/`.

## NOTES LOG (append-only, newest last)
- v1 scaffold: created `harness/`, set Stage 1. Next: implement Drive OAuth + VAPID push.
