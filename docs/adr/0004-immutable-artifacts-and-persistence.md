# ADR 0004: Immutable artifacts and append-oriented sessions

**Status:** Accepted

**Context:** Sessions must remain reproducible after authors edit games or assets.

**Decision:** Publishing creates a new artifact version with a canonical SHA-256 content hash and pinned dependencies. Canonical object keys are ordered by unnormalized UTF-16 code units, independent of locale. One validation-layer acceptance boundary parses, clones/freezes, verifies content hash and artifact ID, and validates semantics for publication, repositories, and runtime creation. `(gameId, gameVersion)` identifies exactly one immutable payload: identical writes are idempotent and different content is rejected by every repository adapter. Sessions reference that identity and append ordered authoritative events. PostgreSQL/Kysely is the durable adapter target; an in-memory implementation supports fast local tests.

**Alternatives:** Mutable latest versions destroy replay; full distributed event sourcing is premature.

**Consequences:** Revisions create new versions and storage is simple to extract later.
