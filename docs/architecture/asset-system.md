# Asset system

Artifacts pin declarative asset references by `packId`, semantic version, and content hash. Asset packs may contain typed data, metadata, versioned media references, and declarative composites. Runtime sessions never resolve a mutable `latest` tag.

The built-in `standard-cards@1.0.0` fixture demonstrates typed cards without arbitrary executable package code. Community JavaScript execution and publication are explicitly out of scope.
