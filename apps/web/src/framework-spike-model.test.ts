import { describe, expect, it } from 'vitest';
import {
  applySemanticCommand,
  blocklyMoveCommand,
  blocklyOperationIds,
  createFrameworkSpikeDocument,
  createLongFrameworkDocument,
  frameworkSpikeFixture,
  insertAtSlot,
  moveToSlot,
  projectFixtureToBlockly,
  semanticOrder,
} from './framework-spike-model.js';

describe('framework spike semantic adapters', () => {
  it('projects every semantic operation from the shared fixture into Blockly', () => {
    const projection = projectFixtureToBlockly(frameworkSpikeFixture);
    expect(blocklyOperationIds(projection)).toEqual([
      'choose-player',
      'draw-question',
      'ask-question',
      'answer-check',
      'present-correct',
      'wait-again',
      'each-player',
      'greet-player',
      'ready-together',
      'parallel-message',
      'parallel-wait',
      'prepare-turn',
      'finish-game',
    ]);
  });

  it('inserts between root operations and into a nested foreach body', () => {
    const rootInserted = insertAtSlot(
      createFrameworkSpikeDocument(),
      { sequenceId: 'authoring-root', index: 1 },
      'wait',
      'spike-wait',
    );
    const nested = insertAtSlot(
      rootInserted,
      { sequenceId: 'each-player-body', index: 1 },
      'present',
      'nested-present',
    );
    expect(semanticOrder(nested, 'authoring-root').slice(0, 3)).toEqual([
      'choose-player',
      'spike-wait',
      'draw-question',
    ]);
    expect(semanticOrder(nested, 'each-player-body')).toEqual(['greet-player', 'nested-present']);
  });

  it('reorders and reparents existing operations using semantic slots', () => {
    const reordered = moveToSlot(createFrameworkSpikeDocument(), 'draw-question', {
      sequenceId: 'authoring-root',
      index: 0,
    });
    const nested = moveToSlot(reordered, 'wait-again', {
      sequenceId: 'each-player-body',
      index: 1,
    });
    expect(semanticOrder(reordered, 'authoring-root').slice(0, 2)).toEqual([
      'draw-question',
      'choose-player',
    ]);
    expect(semanticOrder(nested, 'answer-no')).toEqual([]);
    expect(semanticOrder(nested, 'each-player-body')).toEqual(['greet-player', 'wait-again']);
  });

  it('translates a Blockly structural result into a Traquenard command', () => {
    const fixture = createFrameworkSpikeDocument();
    const command = blocklyMoveCommand('wait-again', 'each-player', 'BODY', 0);
    const updated = applySemanticCommand(fixture, command);
    expect(command).toEqual({
      kind: 'move-operation',
      operationId: 'wait-again',
      to: { sequenceId: 'each-player-body', index: 0 },
    });
    expect(semanticOrder(updated, 'answer-no')).toEqual([]);
    expect(semanticOrder(updated, 'each-player-body')).toEqual(['wait-again', 'greet-player']);
  });

  it('keeps selection and layout state outside the canonical fixture', () => {
    const before = JSON.stringify(frameworkSpikeFixture);
    const viewState = { selectedId: 'each-player', openPalette: true, zoom: 0.8 };
    expect(viewState.selectedId).toBe('each-player');
    expect(JSON.stringify(frameworkSpikeFixture)).toBe(before);
  });

  it('builds a longer nested rendering fixture without changing the shared source', () => {
    const before = JSON.stringify(frameworkSpikeFixture);
    const stress = createLongFrameworkDocument(40);
    expect(semanticOrder(stress, 'each-player-body')).toHaveLength(41);
    expect(JSON.stringify(frameworkSpikeFixture)).toBe(before);
  });
});
