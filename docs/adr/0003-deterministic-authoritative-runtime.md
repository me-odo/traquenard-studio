# ADR 0003: Deterministic server-authoritative runtime

**Status:** Accepted

**Context:** Multiplayer outcomes, replay, timing, reconnects, and hidden information require one trusted semantic owner.

**Decision:** The server reduces validated commands against immutable artifacts using explicit seeded RNG and logical time. It filters audience-scoped events before transport. Required-participant disconnect pauses globally.

**Alternatives:** Client authority is easy to tamper with; wall-clock scheduling makes replay and pause nondeterministic.

**Consequences:** Clients animate predetermined outcomes and can safely retry commands. Real timers need an adapter that emits logical-time events.
