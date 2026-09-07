# Agent operating contract

Preserve these invariants: published artifacts are immutable; the server owns outcomes; engine semantics use injected RNG and logical time only; audience filtering happens server-side; visual layout never defines runtime semantics; authoring may depend on IR, while runtime never depends on authoring or UI.

Before adding semantics, inspect the axiom registry, domain primitives, and composites. Prefer an existing composite, then a new composite, then a domain primitive; add an engine axiom only after the Axiom Design Review in `skills/axiom-design-review/SKILL.md`. Keep the registry, compiler, runtime, UI, tests, generated docs, and migration story coherent.

Use a local-first loop: run targeted local tests while implementing, then a complete local `pnpm verify`, then create coherent local commits, and normally push them together once at the end. Never push to discover whether tests pass or use GitHub Actions as a substitute test machine. Before any push, `pnpm verify` must pass locally unless a genuine environment blocker is reported after attempting to provision it. CI remains an independent confirmation and safety net on main. Never weaken an invariant or test to make CI green.

Architecture starts at `ARCHITECTURE.md`. Durable decisions live in `docs/adr`; unfinished work belongs in GitHub Issues, never local backlog files. Before creating an issue, follow `skills/github-issue-triage/SKILL.md` and search open and closed issues using several concepts.

Reusable version-controlled skill sources live under `skills/`. Install them with `pnpm skills:install` because this environment reserves `.agents`; more specific nested `AGENTS.md` files override this map for their directory.
