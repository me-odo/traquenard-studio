# Testing strategy

Focused unit tests cover every initial axiom through registry/engine behavior. Property tests cover IR serialization, seeded determinism, validation rejection, generated safe games, and audience non-leakage. Reference games are language regression fixtures executed by the headless simulator. Integration tests cover Fastify boundaries and session behavior. Playwright covers authoring → validation/publish → host → second participant join.

Foundational coverage thresholds start at 75% lines/functions/statements and 70% branches. The percentage is a guardrail; explicit determinism, replay, pause/frozen timers, and privacy assertions are release invariants. `pnpm check` runs all non-browser checks; `pnpm verify` adds the Chromium E2E path and is the local CI equivalent.
