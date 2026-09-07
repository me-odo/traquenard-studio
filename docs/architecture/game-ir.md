# Canonical Game IR v1

IR v1 is a serialized tree of discriminated operations with typed expressions, declared state, named composites with typed input/output ports, and audience intents. Composite invocation explicitly binds argument expressions and output variables, so reuse remains inspectable and statically checkable. Trees make sequence, condition, iteration, parallel barriers, and composite inspection explicit without inventing a full language. Stable IDs support editor projections and future migrations; coordinates never appear in IR.

Static validation resolves variables and expression types, recursively checks literal values (including empty and nested collections) against their declared types, rejects duplicate IDs, invalid input/options, unsafe parallel children, invalid composite bindings, missing composites, and unsupported versions before execution. Publishing canonicalizes the definition, pins asset-pack versions, assigns a game version, and computes a deterministic SHA-256 content hash.

V1 parallel children are independent waits/presentations and join with `all`; richer branch continuations can extend the versioned schema later. Expressions are intentionally closed and side-effect free. A future textual DSL and alternate visual editors can serialize the same model.

Migration contract: readers dispatch by `irVersion`. V1 is the first persisted shape, so no legacy migration is needed. Future discriminator or required-field changes must add a reader/migrator rather than silently breaking stored drafts/artifacts.
