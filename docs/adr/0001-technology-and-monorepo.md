# ADR 0001: TypeScript modular monolith

**Status:** Accepted

**Context:** Authoring and runtime need shared types but independent evolution and an accessible local loop.

**Decision:** Use Node 24 LTS, pnpm workspaces, strict TypeScript 6 (the latest line supported by typescript-eslint at founding), React 19 with Vite 8, Fastify 5, Zod boundaries, Vitest/fast-check, Playwright, PostgreSQL 17, and Kysely. Deploy initially as a modular monolith with package dependency checks.

**Alternatives:** Separate services add operational cost; Next.js couples server/UI concerns; an ORM-owned domain model would invert ownership.

**Consequences:** One process can ship first while packages remain extractable. Versions are pinned in the lockfile. Local Node 25 is diagnosed as unsupported rather than silently treated as production-compatible.
