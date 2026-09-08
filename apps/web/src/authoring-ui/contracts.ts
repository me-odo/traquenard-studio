import { CURRENT_AUTHORING_BASELINE_ID } from './baseline.js';
import { activeLabRegistry } from './registry.js';

export const rootAuthoringSurface = {
  route: '/',
  baselineId: CURRENT_AUTHORING_BASELINE_ID,
  experimentalAxes: [] as const,
} as const;

export const activeAuthoringSurfaces = activeLabRegistry.map((manifest) => ({
  route: manifest.route,
  previewRoute: `/lab-preview/${manifest.id}` as const,
  baselineId: manifest.baselineId,
  experimentalAxes: manifest.experimentalAxes,
}));
