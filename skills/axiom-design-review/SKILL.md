---
name: axiom-design-review
description: Review proposed game semantics before adding or changing an Engine Axiom, Domain Primitive, Composite, or fundamental IR/runtime behavior.
---

# Axiom Design Review

Inventory `axiomRegistry`, domain helpers, and artifact composites before editing. Prefer, in order: existing composite, new composite, domain primitive, then engine axiom.

If composition is insufficient, state the smallest missing domain-independent capability and what it deliberately excludes. Define its stable identifier/version, typed inputs/outputs, effects, determinism, serialization, execution, and errors. Check whether it makes an existing construct redundant; simplify safe local overlap now and put genuinely deferred work in a deduplicated GitHub Issue.

Update the IR schema, validator, interpreter dispatch, authoring projection when exposed, registry contract tests, serialization/property tests, reference games, generated docs, and migration story as applicable. Persisted discriminator changes require a versioned compatibility reader. Run targeted tests locally, regenerate with `pnpm docs:axioms`, then run the complete local `pnpm verify` before committing or pushing.
