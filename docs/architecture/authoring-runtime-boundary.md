# Authoring/runtime boundary

The dependency direction is:

`apps/web → authoring-domain → game-validator → game-ir`

`apps/server → engine-runtime → engine-core → game-ir`

Runtime packages cannot import authoring, React, Vite, Fastify, database, or transport modules. An automated architecture check enforces these directions and scans engine code for direct wall-clock/global randomness. The server accepts only validated artifacts and protocol commands. Published sessions never reference mutable drafts or `latest` dependencies.

Editor layout is a separate `DraftLayout` keyed by semantic node ID. Deleting or replacing every coordinate preserves compiled IR. This permits alternate graph, outline, mobile, and eventual text projections without runtime changes.
