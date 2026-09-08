# Architecture map

Traquenard Studio is a modular TypeScript monolith with extraction-ready authoring and runtime boundaries.

- [`docs/product/vision.md`](docs/product/vision.md) — product scope and non-goals
- [`docs/product/glossary.md`](docs/product/glossary.md) — canonical vocabulary
- [`docs/product/ux-principles.md`](docs/product/ux-principles.md) — durable editor/gameplay principles
- [`docs/product/authoring-ui-baseline.md`](docs/product/authoring-ui-baseline.md) — current shared editor and Visual Lab propagation contract
- [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md) — hierarchy and package ownership
- [`docs/architecture/game-ir.md`](docs/architecture/game-ir.md) — canonical IR and extension rules
- [`docs/architecture/runtime-semantics.md`](docs/architecture/runtime-semantics.md) — determinism, events, pause, visibility
- [`docs/architecture/authoring-runtime-boundary.md`](docs/architecture/authoring-runtime-boundary.md) — dependency direction
- [`docs/architecture/asset-system.md`](docs/architecture/asset-system.md) — immutable declarative packs
- [`docs/architecture/testing-strategy.md`](docs/architecture/testing-strategy.md) — regression strategy
- [`docs/adr`](docs/adr) — durable decisions

Executable semantics are in `packages/game-ir`, `engine-core`, `engine-runtime`, and `game-validator`. `authoring-domain` compiles mutable drafts to IR; `game-simulator` owns reference artifacts and automated play. `apps/server` is the authoritative adapter/composition root. `apps/web` is a replaceable projection of authoring and gameplay state.
