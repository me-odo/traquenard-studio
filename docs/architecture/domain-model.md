# Domain model

The hierarchy is `Engine Axiom → Domain Primitive → Composite → Game Artifact → Game Session`. Entities/values/resources are typed data rather than behavior. The initial card pack proves that decks and cards remain data while shuffle/draw are operations.

Package ownership:

- `game-ir`: canonical values, expressions, operations, composites, artifacts, serialization.
- `game-validator`: type/control/reference validation before publishing or execution.
- `engine-core`: pure evaluation, RNG, axiom registry, and execution reduction.
- `engine-runtime`: sessions, external commands, event log, pause/reconnect, audience projection.
- `authoring-domain`: mutable drafts, layout, palette compatibility, compilation/publishing.
- `multiplayer-protocol`: validated versioned wire commands.
- `game-simulator`: reference games, fake clock, deterministic automated participants.

The initial registry is generated at [`docs/generated/axioms.md`](../generated/axioms.md). New semantics require the project Axiom Design Review skill.
