# Engine purity

This package is pure deterministic semantics. Never import browser, React, network, database, filesystem, process environment, or authoring modules. Do not call `Math.random`, `Date.now`, timers, or a system clock. Random state and logical time are explicit inputs/outputs. Avoid mutable module-level semantic state.

Changing an operation requires the Axiom Design Review, focused contract tests, replay/determinism coverage, and regenerated axiom docs.
