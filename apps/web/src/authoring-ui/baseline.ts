export const CURRENT_AUTHORING_BASELINE_ID =
  'traquenard-authoring-ui-2026-09-09-functional' as const;

export const currentAuthoringBaseline = {
  id: CURRENT_AUTHORING_BASELINE_ID,
  inherited: [
    'Traquenard-owned structured renderer',
    'dnd-kit semantic slot interactions',
    'Base UI accessible picker primitives',
    'Library / Flow / Inspector shell',
    'Data and named Workflow navigation',
    'Typed local reference chips',
    'Scope-aware typed fields and semantic commands',
    'Diagnostics with Undo and Redo',
    'Shared operation descriptors and branch blocks',
  ],
} as const;

export type AuthoringExperimentOverrides = Readonly<{
  containment?: 'c-shape' | 'framed';
  parallelProjection?: 'grouped' | 'lanes' | 'fork-join';
  semanticNavigation?: boolean;
  traceOverlay?: boolean;
}>;

export const defaultAuthoringBaselineOverrides: AuthoringExperimentOverrides = {
  containment: 'c-shape',
  parallelProjection: 'grouped',
  semanticNavigation: true,
  traceOverlay: false,
};
