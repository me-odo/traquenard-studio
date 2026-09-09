import { describe, expect, it } from 'vitest';
import { authoringDiagnostics } from '@traquenard/authoring-domain';
import { validateDefinition } from '@traquenard/game-validator';
import { CURRENT_AUTHORING_BASELINE_ID } from './baseline.js';
import { activeAuthoringSurfaces, rootAuthoringSurface } from './contracts.js';
import {
  createBaselineDocument,
  insertAtSlot,
  moveToSlot,
  resolveReferenceSource,
  sequenceById,
  setWaitDuration,
} from './document.js';
import { parallelFixtures } from './fixtures/parallel.js';
import { referenceFixtures } from './fixtures/references.js';
import { createOperationForSlot, operationCatalog } from './registry/operations.js';
import { activeLabRegistry, deviceProfiles, normalizedLabState } from './registry.js';

describe('current authoring baseline contracts', () => {
  it('defines root as the baseline with no experiment override and every active lab as that baseline plus declared axes', () => {
    expect(rootAuthoringSurface).toEqual({
      route: '/',
      baselineId: CURRENT_AUTHORING_BASELINE_ID,
      experimentalAxes: [],
    });
    expect(activeAuthoringSurfaces).toHaveLength(3);
    expect(
      activeAuthoringSurfaces.every(
        (surface) => surface.baselineId === CURRENT_AUTHORING_BASELINE_ID,
      ),
    ).toBe(true);
    expect(activeAuthoringSurfaces.every((surface) => surface.experimentalAxes.length > 0)).toBe(
      true,
    );
    expect(activeAuthoringSurfaces.map((surface) => surface.route)).toEqual([
      '/lab/authoring',
      '/lab/parallel',
      '/lab/references',
    ]);
  });

  it('registers only active/supporting labs with both reproducible viewport profiles', () => {
    expect(deviceProfiles.desktop).toMatchObject({ width: 1280, height: 800 });
    expect(deviceProfiles.phone).toMatchObject({ width: 390, height: 844 });
    expect(activeLabRegistry.every((manifest) => manifest.status !== ('retired' as never))).toBe(
      true,
    );
    expect(
      activeLabRegistry.every((manifest) => manifest.deviceProfiles.join(',') === 'desktop,phone'),
    ).toBe(true);
    expect(activeLabRegistry.some((manifest) => manifest.id === ('framework-spike' as never))).toBe(
      false,
    );
  });

  it('keeps every shared realistic review fixture valid before author edits', () => {
    const definitions = [
      createBaselineDocument(),
      ...parallelFixtures.map((item) => item.definition),
      ...referenceFixtures.map((item) => item.definition),
    ];
    expect(definitions.every((definition) => validateDefinition(definition).valid)).toBe(true);
  });

  it('normalizes and preserves device, fixture, and multiple experiment-specific URL fields', () => {
    const references = activeLabRegistry.find((manifest) => manifest.id === 'references')!;
    const state = normalizedLabState(
      references,
      new URLSearchParams('device=phone&fixture=composite&navigation=off&traces=on'),
    );
    expect(state).toEqual({
      device: 'phone',
      fixture: 'composite',
      configuration: { navigation: 'off', traces: 'on' },
    });
    expect(normalizedLabState(references, new URLSearchParams('device=tablet')).device).toBe(
      'desktop',
    );
  });

  it('keeps dnd insert, reorder, and nested reparent commands in the Traquenard document', () => {
    const canonical = createBaselineDocument();
    const inserted = insertAtSlot(
      canonical,
      { sequenceId: 'authoring-root', index: 1 },
      'time.wait',
      'test-wait',
    );
    const reordered = moveToSlot(inserted, 'test-wait', { sequenceId: 'authoring-root', index: 0 });
    const nested = moveToSlot(reordered, 'test-wait', { sequenceId: 'each-player-body', index: 1 });
    expect(sequenceById(inserted, 'authoring-root')?.steps[1]?.id).toBe('test-wait');
    expect(sequenceById(reordered, 'authoring-root')?.steps[0]?.id).toBe('test-wait');
    expect(sequenceById(nested, 'each-player-body')?.steps.map((step) => step.id)).toEqual([
      'greet-player',
      'test-wait',
    ]);
    expect(
      moveToSlot(canonical, 'each-player', { sequenceId: 'each-player-body', index: 0 }),
    ).toEqual(canonical);
    expect(
      sequenceById(canonical, 'authoring-root')?.steps.some((step) => step.id === 'test-wait'),
    ).toBe(false);

    const nearEnd = insertAtSlot(
      canonical,
      { sequenceId: 'authoring-root', index: 7 },
      'time.wait',
      'near-end-wait',
    );
    const movedBefore = moveToSlot(nearEnd, 'near-end-wait', {
      sequenceId: 'authoring-root',
      index: 6,
    });
    expect(sequenceById(movedBefore, 'authoring-root')?.steps.map((step) => step.id)).toEqual([
      'choose-player',
      'draw-question',
      'ask-question',
      'answer-check',
      'each-player',
      'ready-together',
      'near-end-wait',
      'prepare-turn',
      'finish-game',
    ]);
  });

  it('creates every insertable descriptor through the shared operation registry', () => {
    const definition = createBaselineDocument();
    const location = { sequenceId: 'authoring-root', index: 1 } as const;
    for (const descriptor of operationCatalog) {
      const created = createOperationForSlot(
        definition,
        location,
        descriptor.kind as Exclude<typeof descriptor.kind, 'sequence'>,
        `test-${descriptor.kind}`,
      );
      expect(created.operation.kind).toBe(descriptor.kind);
    }
    expect(authoringDiagnostics(definition)).toEqual([]);
  });

  it('applies semantic insert, edit, and reorder commands inside a named Workflow', () => {
    const inserted = insertAtSlot(
      createBaselineDocument(),
      { sequenceId: 'prepare-sequence', index: 1 },
      'time.wait',
      'workflow-wait',
    );
    const edited = setWaitDuration(inserted, 'workflow-wait', 3);
    const moved = moveToSlot(edited, 'workflow-wait', {
      sequenceId: 'prepare-sequence',
      index: 0,
    });
    expect(sequenceById(edited, 'prepare-sequence')?.steps[1]).toMatchObject({
      id: 'workflow-wait',
      kind: 'time.wait',
      durationMs: 3000,
    });
    expect(sequenceById(moved, 'prepare-sequence')?.steps[0]?.id).toBe('workflow-wait');
  });

  it('resolves authored data, root producers, and Composite input bindings semantically', () => {
    const definition = createBaselineDocument();
    expect(resolveReferenceSource(definition, 'questionsDeck')).toEqual({
      kind: 'resource',
      id: 'questionsDeck',
    });
    expect(resolveReferenceSource(definition, 'currentPlayer')).toEqual({
      kind: 'operation',
      id: 'choose-player',
    });
    expect(resolveReferenceSource(definition, 'deck', 'prepare.turn')).toEqual({
      kind: 'resource',
      id: 'questionsDeck',
    });
  });
});
