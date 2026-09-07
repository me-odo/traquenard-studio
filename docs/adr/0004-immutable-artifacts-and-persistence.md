# ADR 0004: Immutable artifacts and append-oriented sessions

**Status:** Accepted

**Context:** Sessions must remain reproducible after authors edit games or assets.

**Decision:** Publishing creates a new artifact version with canonical content hash and pinned dependencies. Sessions reference that identity and append ordered authoritative events. PostgreSQL/Kysely is the durable adapter target; an in-memory implementation supports fast local tests.

**Alternatives:** Mutable latest versions destroy replay; full distributed event sourcing is premature.

**Consequences:** Revisions create new versions and storage is simple to extract later.
