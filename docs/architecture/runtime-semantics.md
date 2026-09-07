# Runtime semantics

For identical artifact, initial state, seed, participants, and ordered external events, the reducer emits the same state and event sequence. `engine-core` has no IO, browser APIs, global random source, or clock. Its xorshift RNG state and logical milliseconds are explicit session fields.

The runtime advances pure operations until it reaches input/timer barriers or completion. Clients submit only idempotent gameplay intents; opaque participant credentials are resolved at the transport boundary and participant IDs are never accepted as caller authority. Logical-time advancement and disconnect/reconnect lifecycle are distinct trusted system inputs. Processed identities use separate typed namespaces for each participant's client commands and each kind of system input, so equal raw IDs cannot collide across authority boundaries. All semantically relevant client and system inputs are recorded for replay.

At the runtime level, a disconnect of any required participant globally pauses the session; trusted time advancement and gameplay commands are rejected while paused, and reconnection of all required participants resumes it without consuming paused wall time. The current WebSocket adapter does not yet produce lifecycle system inputs from real connections, and no server scheduler currently drives logical time. Those transport integrations are future work tracked in issue #3; the present contract is exercised through direct runtime inputs and deterministic tests.

Presentation events carry first-class audiences (`everyone`, `host`, participant list, team, role). Server projections remove whole unauthorized events, including payloads; hiding in CSS is never security.

The event log records artifact identity, seed, accepted inputs, logical-time advances, connection changes, random outcomes, presentations, and completion. It is sufficient for deterministic replay without pretending every function call is event sourced.
