# Server composition root

Validate every serialized boundary. Clients send intents only; never accept client-provided random/timer outcomes. Filter audiences before serializing events. Artifacts referenced by sessions are immutable. Keep Fastify, WebSocket, and persistence details out of engine packages.
