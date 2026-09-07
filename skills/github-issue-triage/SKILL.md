---
name: github-issue-triage
description: Create, update, reopen, or link a Traquenard Studio GitHub Issue without duplicating existing open or closed work.
---

# GitHub Issue Triage

First verify `origin`, `gh` availability, and authenticated access. If unavailable, do not invent a repository or local backlog; report the deferred item in the handoff.

Search both open and closed issues with at least three meaningful concepts, not only the proposed title. Inspect plausible bodies and any closed rejection rationale. Choose among commenting/updating, reopening, linking, or genuinely creating. Reuse the small existing label taxonomy before adding a label. Do not open an issue for work reasonably finishable in the current change.

When investigation yields a durable decision, record it in architecture documentation/ADR and close the corresponding issue. Never perform destructive external actions or push without authorization. When a push is authorized, first require a complete local `pnpm verify` and normally batch coherent commits into one final push; do not push to ask CI whether the work passes.
