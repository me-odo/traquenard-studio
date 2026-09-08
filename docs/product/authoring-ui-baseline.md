# Current authoring UI baseline

This document records the reusable authoring presentation currently shipped by Traquenard Studio. It is current truth for product surfaces, not an ADR for every visual choice and not evidence that an open experiment has concluded.

## Surface contract

The root editor is:

```text
CURRENT AUTHORING BASELINE
+ no experiment-specific overrides
```

Every active authoring lab is:

```text
CURRENT AUTHORING BASELINE
+ declared experimental override(s)
```

The baseline descriptor, experiment manifests, shared editor, and Lab Harness live in `apps/web/src/authoring-ui`. `/` and every registered lab preview mount the same `AuthoringEditor`; the lab index is generated from the same registry. An active lab must not provide an independent top-level authoring shell.

## Adopted global baseline

- Traquenard owns the structured React renderer and all semantic authoring state.
- dnd-kit owns bounded drag sensors, collision/drop lifecycle, overlays, reorder, and reparent mechanics. It emits Traquenard semantic slot commands; library state and coordinates are never canonical.
- Base UI owns the accessible searchable add-step combobox and its popup/focus behavior.
- Drag is an optional accelerator. Click/tap, search, keyboard, and explicit insertion slots remain first-class.
- Typed compatibility and references come from Traquenard authoring and Game IR semantics, never visual proximity or color.
- The desktop baseline has a sticky workspace bar, persistent Library and Inspector, and a Flow-only primary scroll surface. Panels may scroll internally.
- The author-facing Library is organized as Blocks; Data with Runtime, Collections, and State; and named reusable Workflows.
- Named Workflows are Composite definitions at the same navigation depth as Data. THEN, ELSE, foreach, and permitted parallel bodies remain inline children of their structural parent.
- Root and active labs share the shell, ordinary block renderer, structured blocks, reference chips, insertion slots, Library/Data/Workflows navigation, Inspector conventions, tokens, and focused mobile navigation.
- Desktop and phone lab evaluation uses actual iframe viewports of 1280×800 and 390×844. Research controls and evidence remain on the host page, outside the preview.

## Review-session working copies

The current editor and Visual Lab previews keep their mutable semantic `GameDefinition` working copy in browser `sessionStorage` so an ordinary reload does not erase a manual review. Keys include the persistence schema, current baseline ID, surface/lab identity, and fixture identity; a future configuration that changes semantic fixture meaning must also supply a semantic configuration discriminator. Current lab configuration fields are presentation-only and remain in the URL, so switching projection or device retains the same fixture working copy.

Stored envelopes are schema-marked and checked against their baseline, surface, fixture, and canonical game identity before Game IR parsing. Malformed, stale, unavailable, or incompatible storage falls back to a fresh clone of the canonical fixture. Reset clears only the selected working-copy key and restores that canonical clone.

This is temporary, client-side review infrastructure. It is not production draft persistence, autosave, revision history, account ownership, or recovery architecture, and a restored working copy is never a published artifact.

## Provisional integrated directions

- Typed reference chips are the current local representation. Semantic source navigation is integrated but remains under Issue #2 human review; provenance traces are an optional inspection/debug overlay.
- The grouped parallel overview is the current baseline default, but Issue #1 still compares it with lanes and fork/join projections.
- Negative-space C-shaped foreach and IF rendering incorporates Issue #6 feedback for retest. Its final geometry is not yet adopted as a durable product conclusion.

## Explicit open axes

- Final structured block geometry and density.
- Final parallel grammar and any future richer branch semantics.
- Exact reference inspection and navigation interaction.
- Theme and brand expression beyond the shared accessibility/spacing/state tokens.
- Broader resource schemas and richer authored collection editors.

Issues #1, #2, and #6 remain the human-review authorities for those questions. Their presence in a prototype does not make their conclusions adopted.

## Propagating an accepted decision

For a global authoring decision:

1. Implement it in the shared baseline component or token.
2. Confirm `/` consumes that implementation with no experiment override.
3. Confirm every active lab consumes it through `AuthoringEditor` and `LabHarness`.
4. Remove or migrate the experimental override that represented the resolved axis.
5. Update the registry and this current-truth document.
6. Run the focused contract/E2E suite and complete local `pnpm verify` before pushing.
7. Only then complete the experiment-closure workflow.

The shared baseline ID plus manifest/contract tests catches obvious bypasses and stale registered forks. GitHub comments and documentation alone are not implementation propagation when code surfaces are affected.

Local decisions change only the relevant shared component or declared experiment override. Rejected and inconclusive directions remain outside the baseline.

## Semantic boundary

This layer changes no Game IR, runtime, validator, Engine Axiom, or canonical artifact semantics. Visual geometry, viewport selection, harness configuration, selection, and drag state remain replaceable presentation state. Blockly is absent, React Flow is not the default surface, and runtime never depends on authoring UI.
