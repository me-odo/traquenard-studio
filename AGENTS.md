# Agent operating contract

Preserve these invariants: published artifacts are immutable; the server owns outcomes; engine semantics use injected RNG and logical time only; audience filtering happens server-side; visual layout never defines runtime semantics; authoring may depend on IR, while runtime never depends on authoring or UI.

Before adding semantics, inspect the axiom registry, domain primitives, and composites. Prefer an existing composite, then a new composite, then a domain primitive; add an engine axiom only after the Axiom Design Review in `skills/axiom-design-review/SKILL.md`. Keep the registry, compiler, runtime, UI, tests, generated docs, and migration story coherent.

Before considering a change complete, run `pnpm verify`; run `pnpm test:e2e` for user-visible, server, protocol, or runtime changes. Never weaken an invariant or test to make CI green.

Architecture starts at `ARCHITECTURE.md`. Durable decisions live in `docs/adr`; unfinished work belongs in GitHub Issues, never local backlog files. Before creating an issue, follow `skills/github-issue-triage/SKILL.md` and search open and closed issues using several concepts.

Reusable version-controlled skill sources live under `skills/`. Install them with `pnpm skills:install` because this environment reserves `.agents`; more specific nested `AGENTS.md` files override this map for their directory.
