---
name: feature-change
description: Implement a product feature across Traquenard Studio while preserving its IR, determinism, authority, privacy, and package-boundary invariants.
---

# Feature Change

Read `ARCHITECTURE.md` and the closest package tests. Trace the requirement from authoring model through validation, artifact, runtime/protocol, server projection, and UI; explicitly mark unaffected layers. Search for reusable axioms, primitives, and composites before creating semantics, invoking the Axiom Design Review when necessary.

Implement the smallest coherent vertical change with boundary validation. Add focused unit/property/integration tests and a small E2E case when a user path changes. Update durable documentation only when the current contract changed; unfinished work belongs in a deduplicated GitHub Issue. Run `pnpm verify` plus relevant E2E, then create a focused Conventional Commit only when authorized and Git identity is configured.
