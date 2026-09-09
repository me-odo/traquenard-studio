---
name: frontend-component-change
description: Add or change Traquenard Studio frontend components while preserving shared authoring semantics, accessibility, mobile parity, and experiment propagation.
---

# Frontend Component Change

Search the current authoring component and operation-descriptor registries before creating another component. Put shared product behavior in the current baseline; a Visual Lab may override only its declared experimental axis, and every affected active lab must be updated when a shared decision changes.

Keep semantic authoring state in Traquenard's document and domain layer. Visual component, geometry, drag, popup, selection, focus, and animation state must not become Game IR or own semantic mutations. Route edits through named commands or presentation-neutral domain helpers rather than mutating nested Game IR objects in JSX.

Prefer reusable typed controls driven by expected `TypeRef`, semantic scope, execution position, and candidate compatibility. Do not add operation-specific hard-coded pickers when a generic value, expression, condition, audience, reference, or Workflow-binding control fits. dnd-kit and Base UI are infrastructure behind Traquenard concepts; do not leak their models into canonical state.

Desktop and mobile projections share the same semantics and reusable components. Preserve semantic HTML, accessible names, focus visibility, keyboard operation, reasonable touch targets, and a tap/click alternative for every drag path. Never communicate compatibility or state by color alone.

Every new Game IR operation UI must declare its author label, coverage policy, renderer, Inspector behavior, insertion policy, input/output contract, and reference-discovery policy in the operation descriptor registry. Keep structural/internal and intentionally unavailable operations explicit so new kinds cannot silently disappear.

Split components by durable concept ownership when a file begins coordinating unrelated concerns; avoid both monolithic editors and wrappers that add no ownership. Add focused component/domain regression coverage and realistic desktop/mobile interaction evidence. Run the repository's targeted checks and full verification workflow after meaningful changes.
