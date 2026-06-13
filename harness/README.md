# /harness — adversarial review harness working directory

This directory holds the file-based checkpoints for the Ground Control
OAuth/Push build, run under the adversarial review harness (generator →
blind reviewers → adjudicator → revise loop). It exists so the work is
**resumable across sessions**: if a session is interrupted (e.g. usage cap),
the next one reads `STATUS.md` and continues from the last completed stage.

It is process scaffolding, not part of the shipped PWA. The actual feature
code lands in `index.html`, `sw.js`, and `push-server/`. This folder can be
deleted before opening a PR if a clean diff is wanted.

## Layout
```
STATUS.md               current stage/iteration (read first on resume)
artifact_v{N}/          reviewable snapshot of iteration N (overview + diff)
decision_log_v{N}.md    generator's assumptions + honest weak points (adjudicator-only)
review_{remit}.md       one per blind reviewer (correctness / adversary / maintainability)
change_list_v{N}.md     adjudicator's ordered must-fix list (if ITERATE)
final_notes.md          adjudicator's summary + deferred items (if CONVERGED)
```

## The loop
GENERATOR → artefact + decision log → (decision log stripped) → 3 REVIEWERS
(blind to each other, reading only `artifact_v{N}/`) → ADJUDICATOR
(ACCEPT/REJECT/DEFER, resolve conflicts) → CONVERGED (ship) or ITERATE
(emit change list, back to generator). Cap: 3 loops.
