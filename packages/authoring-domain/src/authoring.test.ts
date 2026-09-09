import { describe, expect, it } from 'vitest';
import {
  IR_VERSION,
  literal,
  t,
  variable,
  type GameDefinition,
  type Operation,
} from '@traquenard/game-ir';
import { validateDefinition } from '@traquenard/game-validator';
import {
  authoredCollectionDeclarations,
  authoredStateDeclarations,
  authoringDiagnostics,
  availableValuesForOperation,
  changeAudience,
  changeForeachCollection,
  changeInputParticipant,
  changeRandomSelectSource,
  changeWorkflowArgument,
  collectionCandidatesForOperation,
  createAuthoredData,
  deleteAuthoredData,
  deleteOperationCommand,
  deleteWorkflowCommand,
  findOperation,
  flowOutputDeclarations,
  operationDescriptors,
  operationReferences,
  createWorkflowCommand,
  renameWorkflowCommand,
  renameForeachBindingSafely,
  setConditionOperand,
  valueCandidatesForOperation,
} from './index.js';

const workflow = {
  id: 'announce',
  version: 1,
  name: 'Announce answer',
  inputs: [{ name: 'text', type: t.string }],
  outputs: [],
  implementation: {
    id: 'announce-sequence',
    kind: 'sequence',
    steps: [
      {
        id: 'announce-message',
        kind: 'present',
        audience: { kind: 'everyone' },
        message: variable('text'),
        privacy: 'public',
      },
    ],
  },
} as const;

function fixture(): GameDefinition {
  return {
    irVersion: IR_VERSION,
    gameId: 'authoring-domain-test',
    title: 'Authoring domain test',
    variables: [
      { name: 'playersA', type: t.collection(t.participant), initial: ['p1', 'p2'] },
      { name: 'cards', type: t.collection(t.card), initial: [] },
      { name: 'score', type: t.number, initial: 0 },
      { name: 'title', type: t.string, initial: 'Round' },
      { name: 'selected', type: t.participant },
      { name: 'answer', type: t.string },
    ],
    composites: [workflow],
    root: {
      id: 'root',
      kind: 'sequence',
      steps: [
        { id: 'pick', kind: 'random.select', from: { kind: 'participants' }, output: 'selected' },
        {
          id: 'ask',
          kind: 'input.wait',
          participant: variable('selected'),
          prompt: 'Ready?',
          options: ['Yes', 'No'],
          output: 'answer',
        },
        {
          id: 'check',
          kind: 'control.if',
          condition: { kind: 'equals', left: variable('answer'), right: literal('Yes', t.string) },
          then: { id: 'then', kind: 'sequence', steps: [] },
          else: { id: 'else', kind: 'sequence', steps: [] },
        },
        {
          id: 'each',
          kind: 'control.foreach',
          collection: { kind: 'participants' },
          itemVariable: 'player',
          body: {
            id: 'body',
            kind: 'sequence',
            steps: [
              {
                id: 'private',
                kind: 'present',
                audience: { kind: 'participant', id: variable('player') },
                message: variable('title'),
                privacy: 'private',
              },
            ],
          },
        },
        {
          id: 'invoke',
          kind: 'composite.invoke',
          compositeId: 'announce',
          arguments: { text: variable('answer') },
          outputs: {},
        },
        { id: 'end', kind: 'end' },
      ],
    },
  };
}

describe('semantic authoring model', () => {
  it('requires an explicit, generic authoring policy for every Game IR operation kind', () => {
    const kinds: readonly Operation['kind'][] = [
      'sequence',
      'set',
      'random.select',
      'present',
      'input.wait',
      'control.if',
      'control.foreach',
      'control.parallel',
      'time.wait',
      'collection.shuffle',
      'collection.draw',
      'composite.invoke',
      'end',
    ];
    expect(Object.keys(operationDescriptors).sort()).toEqual([...kinds].sort());
    expect(Object.values(operationDescriptors).every((item) => item.policy)).toBe(true);
    expect(operationDescriptors['random.select'].label).toBe('Pick random item');
    expect(operationDescriptors['collection.draw'].label).toBe('Draw item');
    expect(operationDescriptors['composite.invoke'].label).toBe('Run workflow');
    expect(Object.values(operationDescriptors).map((item) => item.label)).not.toContain(
      'Prepare Turn',
    );
  });

  it('separates authored Data from uninitialized flow output declarations', () => {
    const definition = fixture();
    expect(authoredCollectionDeclarations(definition).map((item) => item.name)).toEqual([
      'playersA',
      'cards',
    ]);
    expect(authoredStateDeclarations(definition).map((item) => item.name)).toEqual([
      'score',
      'title',
    ]);
    expect(flowOutputDeclarations(definition).map((item) => item.name)).toEqual([
      'selected',
      'answer',
    ]);
  });

  it('calculates execution-order and foreach-local scope without leaking Workflow inputs', () => {
    const beforePick = availableValuesForOperation(fixture(), 'pick');
    const afterPick = availableValuesForOperation(fixture(), 'ask');
    const insideForeach = availableValuesForOperation(fixture(), 'private');
    const insideWorkflow = availableValuesForOperation(fixture(), 'announce-message');
    expect(beforePick.some((item) => item.id === 'selected')).toBe(false);
    expect(afterPick.find((item) => item.id === 'selected')?.family).toBe('flow-output');
    expect(insideForeach.find((item) => item.id === 'player')?.type).toEqual(t.participant);
    expect(insideWorkflow.map((item) => item.id)).toEqual(['text']);
  });

  it('filters candidates by expected type while explaining incompatible values', () => {
    const participant = valueCandidatesForOperation(fixture(), 'ask', t.participant);
    expect(participant.find((item) => item.value.id === 'selected')?.compatible).toBe(true);
    expect(participant.find((item) => item.value.id === 'score')).toMatchObject({
      compatible: false,
      reason: 'Expected participant, received number.',
    });
    const collections = collectionCandidatesForOperation(fixture(), 'each');
    expect(collections.filter((item) => item.compatible).map((item) => item.value.id)).toEqual([
      'runtime.players',
      'playersA',
      'cards',
    ]);
  });

  it('changes collection sources and derives foreach-local and random output types', () => {
    const foreachChanged = changeForeachCollection(fixture(), 'each', variable('cards'));
    expect(
      availableValuesForOperation(foreachChanged, 'private').find((item) => item.id === 'player')
        ?.type,
    ).toEqual(t.card);
    const randomChanged = changeRandomSelectSource(fixture(), 'pick', variable('cards'));
    expect(randomChanged.variables.find((item) => item.name === 'selected')?.type).toEqual(t.card);
  });

  it('renames a foreach binding with atomic body reference migration', () => {
    const changed = renameForeachBindingSafely(fixture(), 'each', 'currentParticipant');
    expect(findOperation(changed, 'each')).toMatchObject({ itemVariable: 'currentParticipant' });
    expect(findOperation(changed, 'private')).toMatchObject({
      audience: { id: { kind: 'variable', name: 'currentParticipant' } },
    });
    expect(validateDefinition(changed)).toEqual({ valid: true, issues: [] });
  });

  it('enforces condition, participant, audience, and Workflow argument compatibility', () => {
    const definition = fixture();
    expect(setConditionOperand(definition, 'check', 'right', literal(1, t.number))).toBe(
      definition,
    );
    expect(changeInputParticipant(definition, 'ask', variable('title'))).toBe(definition);
    expect(changeWorkflowArgument(definition, 'invoke', 'text', variable('score'))).toBe(
      definition,
    );
    expect(changeAudience(definition, 'private', { kind: 'host' })).not.toBe(definition);
  });

  it('discovers real input references without treating outputs as references', () => {
    const definition = fixture();
    expect(
      operationReferences(definition, findOperation(definition, 'check')!).map((item) => item.path),
    ).toEqual(['condition.left']);
    expect(
      operationReferences(definition, findOperation(definition, 'invoke')!).map(
        (item) => item.path,
      ),
    ).toEqual(['arguments.text']);
    expect(
      operationReferences(definition, findOperation(definition, 'pick')!).map((item) => item.path),
    ).toEqual(['from']);
    expect(
      operationReferences(definition, findOperation(definition, 'pick')!).some(
        (item) => item.path === 'output',
      ),
    ).toBe(false);
  });

  it('extracts references from every supported semantic input field', () => {
    const definition: GameDefinition = {
      ...fixture(),
      variables: [
        ...fixture().variables,
        { name: 'shuffled', type: t.collection(t.card) },
        { name: 'card', type: t.card },
      ],
      root: {
        id: 'reference-root',
        kind: 'sequence',
        steps: [
          { id: 'set', kind: 'set', variable: 'score', value: variable('score') },
          {
            id: 'shuffle',
            kind: 'collection.shuffle',
            collection: variable('cards'),
            output: 'shuffled',
          },
          { id: 'draw', kind: 'collection.draw', collectionVariable: 'cards', output: 'card' },
          { id: 'pick', kind: 'random.select', from: { kind: 'participants' }, output: 'selected' },
          {
            id: 'ask',
            kind: 'input.wait',
            participant: variable('selected'),
            prompt: 'Ready?',
            options: ['Yes'],
            output: 'answer',
          },
          {
            id: 'show',
            kind: 'present',
            audience: { kind: 'participant', id: variable('selected') },
            message: variable('title'),
            privacy: 'private',
          },
          {
            id: 'check',
            kind: 'control.if',
            condition: { kind: 'equals', left: variable('answer'), right: variable('title') },
            then: { id: 'empty-then', kind: 'sequence', steps: [] },
          },
          {
            id: 'each',
            kind: 'control.foreach',
            collection: variable('cards'),
            itemVariable: 'item',
            body: { id: 'empty-body', kind: 'sequence', steps: [] },
          },
          {
            id: 'invoke',
            kind: 'composite.invoke',
            compositeId: 'announce',
            arguments: { text: variable('answer') },
            outputs: {},
          },
        ],
      },
    };
    const paths = (id: string) =>
      operationReferences(definition, findOperation(definition, id)!).map((item) => item.path);
    expect(paths('set')).toEqual(['value']);
    expect(paths('shuffle')).toEqual(['collection']);
    expect(paths('draw')).toEqual(['collectionVariable']);
    expect(paths('pick')).toEqual(['from']);
    expect(paths('ask')).toEqual(['participant']);
    expect(paths('show')).toEqual(['message', 'audience.id']);
    expect(paths('check')).toEqual(['condition.left', 'condition.right']);
    expect(paths('each')).toEqual(['collection']);
    expect(paths('invoke')).toEqual(['arguments.text']);
  });

  it('preserves invalid deletion states and reports navigable dangling consumers', () => {
    const deleted = deleteOperationCommand(fixture(), 'pick');
    expect(findOperation(deleted, 'pick')).toBeUndefined();
    expect(findOperation(deleted, 'ask')).toBeDefined();
    expect(authoringDiagnostics(deleted)).toContainEqual(
      expect.objectContaining({
        code: 'value_unavailable',
        operationId: 'ask',
        field: 'participant',
      }),
    );
    const withoutTitle = deleteAuthoredData(fixture(), 'title');
    expect(authoringDiagnostics(withoutTitle)).toContainEqual(
      expect.objectContaining({ operationId: 'private', field: 'message' }),
    );
  });

  it('creates and renames a Workflow by display name while deletion preserves invocations', () => {
    const created = createWorkflowCommand(fixture(), 'Score round');
    const renamed = renameWorkflowCommand(created, 'scoreRound', 'Score the round');
    expect(renamed.composites.find((item) => item.id === 'scoreRound')?.name).toBe(
      'Score the round',
    );
    const deleted = deleteWorkflowCommand(renamed, 'announce');
    expect(findOperation(deleted, 'invoke')).toBeDefined();
    expect(authoringDiagnostics(deleted)).toContainEqual(
      expect.objectContaining({ code: 'unknown_workflow', operationId: 'invoke' }),
    );
  });

  it('creates editable authored number, text, boolean, and card collection Data', () => {
    let definition = fixture();
    definition = createAuthoredData(definition, 'state', 'Round count');
    definition = createAuthoredData(definition, 'string', 'Round label');
    definition = createAuthoredData(definition, 'boolean', 'Bonus enabled');
    definition = createAuthoredData(definition, 'collection', 'Bonus cards');
    expect(definition.variables.slice(-4)).toMatchObject([
      { name: 'roundCount', type: t.number, initial: 0 },
      { name: 'roundLabel', type: t.string, initial: '' },
      { name: 'bonusEnabled', type: t.boolean, initial: false },
      { name: 'bonusCards', type: t.collection(t.card), initial: [] },
    ]);
  });
});
