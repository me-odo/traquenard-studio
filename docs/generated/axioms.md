# Engine Axiom Registry

> Generated from `packages/engine-core/src/axioms.ts`. Do not edit manually. Run `pnpm docs:axioms`.

All axioms are deterministic for explicit state, seed/RNG state, logical time, and ordered external inputs. Serialization uses the corresponding Game IR v1 discriminator; execution details and contract tests live with the registry.

| Identifier           | Version | Responsibility                                                  | Inputs                        | Outputs        | Effects       | Errors                                                          |
| -------------------- | ------- | --------------------------------------------------------------- | ----------------------------- | -------------- | ------------- | --------------------------------------------------------------- |
| `sequence`           | 1       | Order child operations.                                         | steps                         | —              | control       | —                                                               |
| `set`                | 1       | Write a typed state variable.                                   | variable, value               | —              | state         | UNKNOWN_VARIABLE                                                |
| `random.select`      | 1       | Select one collection member.                                   | collection, RNG state         | value          | state, event  | EMPTY_COLLECTION                                                |
| `present`            | 1       | Emit audience-scoped presentation intent.                       | audience, message             | —              | event         | —                                                               |
| `input.wait`         | 1       | Wait for a participant choice.                                  | participant, prompt, options  | choice         | wait, event   | UNKNOWN_PARTICIPANT                                             |
| `control.if`         | 1       | Choose a branch.                                                | boolean condition             | —              | control       | —                                                               |
| `control.foreach`    | 1       | Iterate a collection in stable order.                           | collection, item binding      | —              | control       | —                                                               |
| `control.parallel`   | 1       | Start independent waits and join all.                           | branches                      | —              | control, wait | UNSAFE_PARALLEL_BRANCH                                          |
| `time.wait`          | 1       | Wait until logical time reaches a due point.                    | duration, logical time        | —              | wait, event   | —                                                               |
| `collection.shuffle` | 1       | Deterministically permute a collection.                         | collection, RNG state         | collection     | state, event  | —                                                               |
| `collection.draw`    | 1       | Remove and return the first collection item.                    | collection variable           | item           | state, event  | EMPTY_COLLECTION                                                |
| `composite.invoke`   | 1       | Invoke an inspectable declarative subgraph through typed ports. | composite id, typed arguments | typed bindings | control       | UNKNOWN_COMPOSITE, UNKNOWN_VARIABLE, IMPLICIT_COMPOSITE_CONTEXT |
| `end`                | 1       | Mark semantic execution complete.                               | —                             | —              | event         | —                                                               |
