# ADR 0002: Canonical typed Game IR

**Status:** Accepted

**Context:** Visual, future text, persistence, and execution surfaces must not duplicate game meaning.

**Decision:** A versioned, validated, serializable typed IR is the sole published semantic representation. Draft/layout data and transport/ORM models remain adapters.

**Alternatives:** Executing a UI graph couples semantics to UX; arbitrary scripts break inspection, portability, and trust.

**Consequences:** Editor experiments are replaceable and future DSLs have a stable target, at the cost of explicit schema migrations.
