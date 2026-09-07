# Traquenard Studio

A typed, deterministic party-game creation and execution platform. The initial vertical slice includes a constrained visual editor, immutable publishing, an authoritative session API, three executable reference games, headless simulation, private audience filtering, logical timers, and disconnect pause/resume.

## Quick start

Requires Node 24 LTS and pnpm 12.

```bash
corepack enable
pnpm install
pnpm run doctor
pnpm dev
```

Open <http://localhost:5173>. The API listens on <http://localhost:3000>.

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
| `pnpm lint` / `pnpm format:check`   | Code and architecture / formatting checks              |
| `pnpm typecheck` / `pnpm build`     | Strict types / production builds                       |
| `pnpm verify`                       | Closest local equivalent to CI (E2E is separate)       |
| `pnpm infra:up` / `pnpm infra:down` | Start/stop PostgreSQL                                  |
| `pnpm db:migrate` / `pnpm db:reset` | Apply migration / reset local schema                   |
| `pnpm clean`                        | Remove generated build and test output                 |

The server defaults to an in-memory repository for a zero-infrastructure loop. PostgreSQL is the durable adapter target and its initial migration lives in `apps/server/migrations`; set `DATABASE_URL` after starting infrastructure. Never use production data with `db:reset`.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`AGENTS.md`](AGENTS.md) before semantic changes.
