# ADR 0005: Traquenard-owned structured authoring renderer

**Status:** Accepted

**Context:** Traquenard needs ordered and nested structured authoring while semantic Game IR remains canonical truth. [Issue #7](https://github.com/me-odo/traquenard-studio/issues/7), implemented and evidenced in commit [`5cad329`](https://github.com/me-odo/traquenard-studio/commit/5cad329fae8db038c02c241f5b09814f3eb4ae44), compared the custom renderer, dnd-kit with Base UI, Blockly, and React Flow.

**Decision:** Traquenard owns the structured renderer and the authoring document, semantic IDs, slot meaning, workflow hierarchy, resources, typed references, diagnostics, versioning, and future command/history semantics. dnd-kit is the preferred primitive for drag/drop sensors, sortable and reparent mechanics, collision lifecycle, and drag overlays. Base UI is the preferred primitive layer for accessible unstyled comboboxes, menus, popovers or dialog-like interactions, and focus behavior; use Floating UI directly only where Base UI cannot express the required interaction. Adapters emit Traquenard authoring commands. UI-library state or serialization must never become canonical game semantics.

**Alternatives:** Blockly remains useful reference evidence for structured and C-shaped geometry and accessibility, but it is not the authoring document or active canonical workspace. React Flow and other graph canvases are not the default renderer for the current ordered/nested grammar.

**Consequences:** Traquenard retains custom visual freedom, including C-shaped structured controls, with bounded framework lock-in. Drag is an accelerator rather than the only authoring path; tap, click, search, and keyboard paths remain first-class. Mobile remains an application-specific focused document experience. This ADR selects implementation primitives, not a final visual editor grammar; UX experiments remain provisional until human review.
