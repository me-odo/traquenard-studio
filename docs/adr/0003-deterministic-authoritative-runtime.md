# ADR 0003: Deterministic server-authoritative runtime

**Status:** Accepted

**Context:** Multiplayer outcomes, replay, timing, reconnects, and hidden information require one trusted semantic owner.

**Decision:** The server reduces validated commands against immutable artifacts using a server-generated private semantic seed, HMAC-SHA-256 counter-mode deterministic randomness, and safe-integer logical time. Fixed seed injection exists only at internal runtime/simulator and server-composition test boundaries. Explicit event projections exclude all replay-secret material and filter audience-scoped events before transport. Required-participant disconnect pauses globally.

**Alternatives:** Client authority is easy to tamper with; wall-clock scheduling makes replay and pause nondeterministic.

**Consequences:** Clients animate predetermined outcomes and can safely retry commands. Real timers need an adapter that emits logical-time events.
