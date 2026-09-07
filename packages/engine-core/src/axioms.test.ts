import { describe, expect, it } from 'vitest';
import {
  IR_VERSION,
  literal,
  publishArtifact,
  t,
  variable,
  type GameDefinition,
  type Operation,
} from '@traquenard/game-ir';
import {
  EngineError,
  acceptInput,
  advanceExecution,
  advanceLogicalTime,
  axiomDescriptors,
  createEngineState,
  type Participant,
} from './index.js';

const participants: readonly Participant[] = [
  { id: 'p1', name: 'One', isHost: true, required: true },
  { id: 'p2', name: 'Two', isHost: false, required: true },
];

function run(root: Operation, variables: GameDefinition['variables'] = []) {
  const definition: GameDefinition = {
    irVersion: IR_VERSION,
    gameId: 'contract',
    title: 'Contract',
    variables,
    composites: [],
    root,
  };
  return advanceExecution(createEngineState(publishArtifact(definition, 1), participants, 1));
}

describe('axiom registry and contracts', () => {
  it('has one complete descriptor for every operation discriminator', () => {
    expect(new Set(axiomDescriptors.map((item) => item.id))).toHaveProperty(
      'size',
      axiomDescriptors.length,
    );
    for (const item of axiomDescriptors) {
      expect(item.version).toBe(1);
      expect(item.responsibility.length).toBeGreaterThan(0);
      expect(item.determinism).toContain('explicit');
    }
  });

  it('executes sequence, set, conditional and stable foreach semantics', () => {
    const result = run(
      {
        id: 'seq',
        kind: 'sequence',
        steps: [
          { id: 'set', kind: 'set', variable: 'flag', value: literal(true, t.boolean) },
          {
            id: 'if',
            kind: 'control.if',
            condition: variable('flag'),
            then: {
              id: 'loop',
              kind: 'control.foreach',
              collection: literal(['a', 'b'], t.collection(t.string)),
              itemVariable: 'item',
              body: {
                id: 'show',
                kind: 'present',
                audience: { kind: 'everyone' },
                message: variable('item'),
                privacy: 'public',
              },
            },
          },
          { id: 'end', kind: 'end' },
        ],
      },
      [{ name: 'flag', type: t.boolean }],
    );
    expect(result.state.completed).toBe(true);
    expect(
      result.events
        .filter((event) => event.kind === 'presentation.emitted')
        .map((event) => (event.kind === 'presentation.emitted' ? event.message : '')),
    ).toEqual(['a', 'b']);
  });

  it('uses deterministic random selection and Fisher–Yates shuffle', () => {
    const operation: Operation = {
      id: 'seq',
      kind: 'sequence',
      steps: [
        {
          id: 'pick',
          kind: 'random.select',
          from: literal(['p1', 'p2'], t.collection(t.participant)),
          output: 'player',
        },
        {
          id: 'shuffle',
          kind: 'collection.shuffle',
          collection: variable('cards'),
          output: 'cards',
        },
      ],
    };
    const variables = [
      { name: 'player', type: t.participant },
      { name: 'cards', type: t.collection(t.string), initial: ['a', 'b', 'c'] },
    ] as const;
    expect(run(operation, variables).state).toMatchObject(run(operation, variables).state);
  });

  it('waits for validated input and rejects another participant', () => {
    const waiting = run(
      {
        id: 'ask',
        kind: 'input.wait',
        participant: literal('p2', t.participant),
        prompt: 'Pick',
        options: ['A'],
        output: 'answer',
      },
      [{ name: 'answer', type: t.string }],
    ).state;
    expect(() => acceptInput(waiting, 'ask', 'p1', 'A')).toThrow(EngineError);
    expect(acceptInput(waiting, 'ask', 'p2', 'A').variables.answer).toBe('A');
  });

  it('schedules and resolves only through logical time', () => {
    const waiting = run({ id: 'timer', kind: 'time.wait', durationMs: 100 }).state;
    expect(Object.keys(advanceLogicalTime(waiting, 99).pending)).toEqual(['timer']);
    expect(advanceLogicalTime(waiting, 100).pending).toEqual({});
  });

  it('draws from a collection and fails explicitly when empty', () => {
    const drawn = run(
      { id: 'draw', kind: 'collection.draw', collectionVariable: 'deck', output: 'card' },
      [
        { name: 'deck', type: t.collection(t.string), initial: ['A'] },
        { name: 'card', type: t.string },
      ],
    );
    expect(drawn.state.variables).toMatchObject({ deck: [], card: 'A' });
    expect(() =>
      run({ id: 'draw', kind: 'collection.draw', collectionVariable: 'deck', output: 'card' }, [
        { name: 'deck', type: t.collection(t.string), initial: [] },
        { name: 'card', type: t.string },
      ]),
    ).toThrow('empty');
  });

  it('starts all parallel waits before joining', () => {
    const result = run(
      {
        id: 'parallel',
        kind: 'control.parallel',
        join: 'all',
        branches: [
          {
            id: 'a',
            kind: 'input.wait',
            participant: literal('p1', t.participant),
            prompt: 'A',
            options: ['yes'],
            output: 'one',
          },
          { id: 'b', kind: 'time.wait', durationMs: 10 },
        ],
      },
      [{ name: 'one', type: t.string }],
    );
    expect(Object.keys(result.state.pending)).toEqual(['a', 'b']);
  });

  it('invokes declarative composites and ends', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'composite',
      title: 'Composite',
      variables: [
        { name: 'message', type: t.string, initial: 'outside' },
        { name: 'result', type: t.string },
      ],
      composites: [
        {
          id: 'round',
          version: 1,
          name: 'Round',
          inputs: [{ name: 'message', type: t.string }],
          outputs: [{ name: 'response', type: t.string }],
          implementation: {
            id: 'inside-sequence',
            kind: 'sequence',
            steps: [
              {
                id: 'inside',
                kind: 'present',
                audience: { kind: 'everyone' },
                message: variable('message'),
                privacy: 'public',
              },
              {
                id: 'set-output',
                kind: 'set',
                variable: 'response',
                value: literal('returned', t.string),
              },
            ],
          },
        },
      ],
      root: {
        id: 'root',
        kind: 'sequence',
        steps: [
          {
            id: 'invoke',
            kind: 'composite.invoke',
            compositeId: 'round',
            arguments: { message: variable('message') },
            outputs: { response: 'result' },
          },
          { id: 'end', kind: 'end' },
        ],
      },
    };
    const result = advanceExecution(
      createEngineState(publishArtifact(definition, 1), participants, 1),
    );
    expect(result.state.completed).toBe(true);
    expect(result.state.variables.result).toBe('returned');
    expect(result.events.map((event) => event.kind)).toContain('presentation.emitted');
  });
});
