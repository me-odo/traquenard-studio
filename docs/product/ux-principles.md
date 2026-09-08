# UX principles

Compatibility originates in IR types and is communicated with labels, icons, color, ports, and explanatory disabled states—not color alone. Drag/drop is optional: search and tap/click insertion are first-class, keyboard-accessible paths. Mobile composition matters from the first prototype.

Semantic zoom keeps composites readable as single typed units while allowing inspection. Scoped reference chips and short local links should be tested alongside graph edges to avoid cable spaghetti. Parallel execution needs dedicated visual experiments; its provisional grouped container is not an engine contract. Players must always see an unambiguous current action, pause state, and information intended for their audience.

Editor experiments use the `/lab` route and the same authoring/IR APIs. Hypotheses and evaluation criteria belong in deduplicated GitHub Issues when authentication is available.

Authoring experiments inherit the current shared authoring baseline and use the standard Lab Harness with reproducible desktop/phone viewports. A manifest declares only the axis under test; independent full-editor forks are not valid experiment surfaces. Research controls surround the preview rather than occupying the simulated application viewport. Accepted global decisions propagate through shared baseline code to `/` and every active lab before an experiment closes.

Structured authoring uses a Traquenard-owned renderer. dnd-kit may provide gesture mechanics and Base UI may provide accessible headless interaction primitives, but neither library defines document or game semantics. Tap, click, search, and keyboard paths remain first-class, and visual experiments remain provisional until human review.
