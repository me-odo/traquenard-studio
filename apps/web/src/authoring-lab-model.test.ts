import { describe, expect, it } from 'vitest';
import { validateDefinition } from '@traquenard/game-validator';
import {
  addCardToDeck,
  authoringCanonicalDefinition,
  authoringDiagnostics,
  availableValuesAt,
  canonicalAuthoringJson,
  changeDrawSource,
  createAuthoringWorkingDefinition,
  createResource,
  deleteOperation,
  deleteResource,
  drawSourceCandidates,
  findOperation,
  insertOperation,
  moveOperation,
  resourceUsages,
  setVariableInitial,
} from './authoring-lab-model.js';

describe('core authoring lab document', () => {
  it('starts from genuine valid foreach, if, Composite, and restricted parallel semantics', () => {
    expect(validateDefinition(authoringCanonicalDefinition)).toEqual({ valid: true, issues: [] });
    expect(findOperation(authoringCanonicalDefinition, 'each-player')?.kind).toBe(
      'control.foreach',
    );
    expect(findOperation(authoringCanonicalDefinition, 'answer-check')?.kind).toBe('control.if');
    expect(findOperation(authoringCanonicalDefinition, 'prepare-turn')?.kind).toBe(
      'composite.invoke',
    );
    expect(findOperation(authoringCanonicalDefinition, 'ready-together')).toMatchObject({
      kind: 'control.parallel',
      join: 'all',
    });
  });

  it('creates and edits a deck in the working semantic document only', () => {
    const before = canonicalAuthoringJson();
    const created = createResource(createAuthoringWorkingDefinition(), 'deck', 'Bonus Deck');
    const edited = addCardToDeck(created, 'bonusDeck', 'Wildcard');

    expect(edited.variables.find((item) => item.name === 'bonusDeck')).toMatchObject({
      type: { kind: 'collection', element: { kind: 'card' } },
      initial: [{ rank: 'Wildcard' }],
    });
    expect(canonicalAuthoringJson()).toBe(before);
    expect(authoringCanonicalDefinition.variables.some((item) => item.name === 'bonusDeck')).toBe(
      false,
    );
  });

  it('creates, edits, and deletes authored state without offering runtime Players as a declaration', () => {
    const created = createResource(createAuthoringWorkingDefinition(), 'variable', 'Round Score');
    const edited = setVariableInitial(created, 'roundScore', 7);
    const deleted = deleteResource(edited, 'roundScore');

    expect(edited.variables.find((item) => item.name === 'roundScore')?.initial).toBe(7);
    expect(deleted.variables.some((item) => item.name === 'roundScore')).toBe(false);
    expect(deleted.variables.some((item) => item.name === 'runtime.players')).toBe(false);
    expect(deleteResource(deleted, 'runtime.players')).toEqual(deleted);
  });

  it('keeps runtime values, game resources, and flow outputs distinct', () => {
    const beforeFirstStep = availableValuesAt(authoringCanonicalDefinition, 'authoring-root', 0);
    const afterChoose = availableValuesAt(authoringCanonicalDefinition, 'authoring-root', 1);

    expect(beforeFirstStep.find((item) => item.id === 'runtime.players')?.family).toBe('runtime');
    expect(beforeFirstStep.find((item) => item.id === 'questionsDeck')?.family).toBe('resource');
    expect(beforeFirstStep.some((item) => item.id === 'currentPlayer')).toBe(false);
    expect(afterChoose.find((item) => item.id === 'currentPlayer')?.family).toBe('flow');
  });

  it('makes a newly created compatible deck available to Draw Card and explains incompatibility', () => {
    const created = createResource(createAuthoringWorkingDefinition(), 'deck', 'Bonus Deck');
    const candidates = drawSourceCandidates(created, 'authoring-root', 2);

    expect(candidates.find((item) => item.value.id === 'bonusDeck')?.compatible).toBe(true);
    expect(candidates.find((item) => item.value.id === 'score')).toMatchObject({
      compatible: false,
      reason: 'Expected Collection<card>, received number.',
    });
  });

  it('inserts deterministically between two root steps and changes a typed deck reference', () => {
    const inserted = insertOperation(
      createAuthoringWorkingDefinition(),
      'authoring-root',
      1,
      'draw-card',
      'inserted-draw',
    );
    const changed = changeDrawSource(inserted, 'inserted-draw', 'challengesDeck');
    const root = changed.root;

    expect(root.kind).toBe('sequence');
    if (root.kind !== 'sequence') return;
    expect(root.steps.slice(0, 3).map((item) => item.id)).toEqual([
      'choose-player',
      'inserted-draw',
      'draw-question',
    ]);
    expect(findOperation(changed, 'inserted-draw')).toMatchObject({
      kind: 'collection.draw',
      collectionVariable: 'challengesDeck',
    });
    expect(validateDefinition(changed)).toEqual({ valid: true, issues: [] });
  });

  it('inserts into foreach, THEN, and ELSE sequence bodies, including an empty body', () => {
    const inForeach = insertOperation(
      createAuthoringWorkingDefinition(),
      'each-player-body',
      0,
      'present',
      'inside-loop',
    );
    const inThen = insertOperation(inForeach, 'answer-yes', 1, 'wait', 'inside-then');
    const inElse = insertOperation(inThen, 'answer-no', 0, 'present', 'inside-else');

    expect(findOperation(inElse, 'inside-loop')).toBeDefined();
    expect(findOperation(inElse, 'inside-then')).toBeDefined();
    expect(findOperation(inElse, 'inside-else')).toBeDefined();
    expect(validateDefinition(inElse)).toEqual({ valid: true, issues: [] });
  });

  it('preserves an invalid deletion, reports the dangling flow value, and permits exact undo', () => {
    const working = createAuthoringWorkingDefinition();
    const deleted = deleteOperation(working, 'choose-player');

    expect(findOperation(deleted, 'choose-player')).toBeUndefined();
    expect(authoringDiagnostics(deleted)).toContainEqual({
      code: 'value_unavailable',
      operationId: 'ask-question',
      message: 'Current Player is used by Ask / Wait for Input before its producing step.',
    });
    expect(working).toEqual(createAuthoringWorkingDefinition());
  });

  it('reorders within the owning sequence and can reverse the operation', () => {
    const moved = moveOperation(createAuthoringWorkingDefinition(), 'draw-question', -1);
    const restored = moveOperation(moved, 'draw-question', 1);
    expect(moved.root.kind === 'sequence' && moved.root.steps[0]?.id).toBe('draw-question');
    expect(restored).toEqual(createAuthoringWorkingDefinition());
  });

  it('keeps Composite-local values out of the parent and exposes them only inside the Composite', () => {
    const parent = availableValuesAt(authoringCanonicalDefinition, 'authoring-root', 0);
    const composite = availableValuesAt(authoringCanonicalDefinition, 'prepare-sequence', 0);

    expect(parent.some((item) => item.family === 'composite')).toBe(false);
    expect(composite.map((item) => `${item.id}:${item.family}`)).toEqual([
      'player:composite',
      'deck:composite',
    ]);
    expect(
      availableValuesAt(authoringCanonicalDefinition, 'prepare-sequence', 2).map(
        (item) => `${item.id}:${item.family}`,
      ),
    ).toContain('card:flow');
  });

  it('edits the focused Composite implementation without changing its parent invocation', () => {
    const edited = insertOperation(
      createAuthoringWorkingDefinition(),
      'prepare-sequence',
      1,
      'present',
      'composite-message',
    );

    expect(findOperation(edited, 'composite-message')?.kind).toBe('present');
    expect(findOperation(edited, 'prepare-turn')?.kind).toBe('composite.invoke');
    expect(validateDefinition(edited)).toEqual({ valid: true, issues: [] });
  });

  it('keeps selection, inspector, projection, and expansion state outside semantic output', () => {
    const working = createAuthoringWorkingDefinition();
    const before = JSON.stringify(working);
    const viewState = {
      selectedId: 'answer-check',
      inspector: 'operation',
      projection: 'inset',
      expandedIds: ['each-player', 'answer-check'],
    };

    expect(viewState).toMatchObject({ projection: 'inset', inspector: 'operation' });
    expect(JSON.stringify(working)).toBe(before);
  });

  it('derives resource usage independently of flow position', () => {
    expect(resourceUsages(authoringCanonicalDefinition, 'questionsDeck')).toEqual([
      'Draw Card',
      'Prepare Turn',
    ]);
  });

  it('does not encode selection or structural projection in semantic output', () => {
    const before = canonicalAuthoringJson();
    const visualState = {
      selectedId: 'each-player',
      projection: 'inset',
      expanded: ['answer-check'],
    };
    expect(visualState.projection).toBe('inset');
    expect(canonicalAuthoringJson()).toBe(before);
  });
});
