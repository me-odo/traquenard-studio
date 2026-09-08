---
name: experiment-closure
description: Close an adopted, rejected, or inconclusive UX experiment or technical spike while preserving durable decisions and removing disposable evidence surfaces.
---

# Experiment Closure

An experiment is not complete when it reaches a recommendation. Before closing its source issue, apply every relevant gate:

1. **Review:** Verify the evidence, obtain required human or architecture review, and classify the outcome as `ADOPT`, `REJECT`, or `INCONCLUSIVE`.
2. **Durable decision:** For an adopted durable direction, update the ADR or current-truth documentation. Record a rejected direction only when it prevents likely repetition. Never promote provisional observations into architecture contracts.
3. **Harvest:** Keep reusable code only when it has a continuing owner and use. Remove disposable routes, fixtures, styles, tests, debug UI, and dependencies so a comparison lab does not become accidental product surface.
4. **Propagate:** Identify affected open issues and experiments, then add inherited constraints and cross-links. Change exit criteria only when the decision materially changes them, and do not close dependent issues merely because one dependency was resolved.
5. **Product surfaces:** Remove stale experiment navigation and refresh root, Visual Lab, or status indicators so the current experiment is obvious.
6. **Verify:** Run targeted tests, typecheck, the repository's full `pnpm verify`, and independent CI after push.
7. **Close:** After all applicable gates pass, add a final comment with the decision, durable record, cleanup, propagation matrix, verification, and exact commits; then close the source issue. Identify external continuity systems that still need synchronization in the handoff, without making any such system a build dependency.

Classify the decision scope before applying these gates:

- **Global baseline decision:** migrate the shared baseline implementation, remove or update every affected experimental override, verify `/` and every active dependent lab, and update the authoring baseline current-truth document before closure.
- **Local decision:** propagate only to the relevant shared component or experiment and its dependents.
- **Rejected or inconclusive:** keep the direction out of the shared baseline and remove disposable evidence when appropriate.

GitHub comments and documentation alone do not count as implementation propagation when active code surfaces are affected.
