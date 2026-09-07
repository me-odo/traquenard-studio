# Glossary

- **Engine Axiom:** smallest domain-independent executable semantic operation, registered and versioned in code.
- **Domain Primitive:** built-in game-oriented behavior implemented from axioms when possible.
- **Composite:** named, typed, inspectable reusable IR subgraph.
- **Game Draft:** mutable authoring data plus independent layout metadata.
- **Game IR:** typed, versioned, serialized executable definition independent of UI and transport.
- **Game Artifact:** immutable published IR version with pinned dependencies and content hash.
- **Game Session:** authoritative execution of one artifact for participants and a seed.
- **Client Command:** retry-safe participant intent; never an outcome.
- **External Event:** ordered input that affects deterministic execution, including input, connection, and logical time.
- **Runtime Event:** authoritative semantic history used for replay and projections.
- **Presentation Event:** audience-scoped runtime output; animation renders its predetermined result.
- **Participant ID:** ephemeral session identity, distinct from any future account.
