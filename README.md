# Traquenard Studio

A typed, deterministic party-game creation and execution platform. The initial vertical slice includes a constrained visual editor, immutable publishing, an authoritative session API, three executable reference games, headless simulation, private audience filtering, logical timers, and runtime-level disconnect pause/resume semantics.

## Quick start

On macOS, the idempotent bootstrap activates the pinned Node release through nvm, enables the pinned pnpm through Corepack, installs dependencies, Chromium, and project Skills, diagnoses optional integrations, and runs the full local verification:

```bash
./scripts/setup-local.sh
pnpm dev
```

Use `./scripts/setup-local.sh --with-docker` to also start PostgreSQL, apply migrations, and run the database adapter integration contract. The script never invokes Homebrew, edits shell profiles, or removes or upgrades unrelated tooling. GitHub CLI authentication and Docker remain optional for the zero-infrastructure loop.

Open <http://localhost:5173>. The API listens on <http://localhost:3000>.

The web routes have explicit responsibilities:

- `/` is the current integrated authoring baseline.
- `/runtime-proof` preserves the executable immutable-publish and authoritative-session proof.
- `/lab` lists registered Visual Lab experiments.
- `/lab/authoring`, `/lab/parallel`, and `/lab/references` use the standard Lab Harness around the shared baseline.

See [`docs/product/authoring-ui-baseline.md`](docs/product/authoring-ui-baseline.md) for the baseline/override contract and decision-propagation workflow.

## Commands

| Command                             | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                          | Run web and server development processes               |
| `pnpm run doctor`                   | Diagnose local prerequisites and optional integrations |
| `pnpm test` / `pnpm test:watch`     | Unit tests / watch mode                                |
| `pnpm test:property`                | Property-based tests                                   |
| `pnpm test:integration`             | HTTP and package integration tests                     |
| `pnpm test:e2e`                     | Playwright browser path                                |
| `pnpm coverage`                     | Coverage with foundational thresholds                  |
| `pnpm fix`                          | Apply safe ESLint fixes, then format with Prettier     |
| `pnpm lint` / `pnpm format:check`   | Code and architecture / formatting checks              |
| `pnpm typecheck` / `pnpm build`     | Strict types / production builds                       |
| `pnpm check`                        | Complete checks without launching a browser            |
| `pnpm verify`                       | Full CI-equivalent checks, including Chromium E2E      |
| `pnpm infra:up` / `pnpm infra:down` | Start/stop PostgreSQL                                  |
| `pnpm db:migrate` / `pnpm db:reset` | Apply migration / reset local schema                   |
| `pnpm clean`                        | Remove generated build and test output                 |

During development, run `pnpm fix`, `pnpm typecheck`, and targeted tests. Before committing or
pushing, run local `pnpm verify`; use CI only as independent confirmation.

VS Code users should install the recommended ESLint and Prettier extensions. The version-controlled
workspace settings format and apply safe ESLint fixes on save, and use the repository's TypeScript
version for editor diagnostics.

The server defaults to an in-memory repository for a zero-infrastructure loop. PostgreSQL is the durable adapter target and its initial migration lives in `apps/server/migrations`; set `DATABASE_URL` after starting infrastructure. Both adapters reject different content for an existing `(gameId, gameVersion)` and accept identical retries. Never use production data with `db:reset`.

Disconnect/reconnect pause behavior and timer freezing currently exist at the pure runtime level and in deterministic tests. The WebSocket adapter does not yet translate real connection lifecycle into trusted system inputs, and the server does not yet run a logical-time scheduler; that integration is tracked in [issue #3](https://github.com/me-odo/traquenard-studio/issues/3).

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`AGENTS.md`](AGENTS.md) before semantic changes.
