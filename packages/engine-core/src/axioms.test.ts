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
  return advanceExecution(
    createEngineState(publishArtifact(definition, 1), participants, 'axiom-test-seed'),
  );
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

  it('reads declared inputs, writes declared outputs, and returns them to the caller', () => {
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
      createEngineState(publishArtifact(definition, 1), participants, 'axiom-test-seed'),
    );
    expect(result.state.completed).toBe(true);
    expect(result.state.variables.result).toBe('returned');
    expect(result.events.map((event) => event.kind)).toContain('presentation.emitted');
  });

  it('keeps nested composite scopes isolated through explicit bindings', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'nested-composite',
      title: 'Nested composite',
      variables: [
        { name: 'source', type: t.string, initial: 'through both scopes' },
        { name: 'result', type: t.string },
      ],
      composites: [
        {
          id: 'inner',
          version: 1,
          name: 'Inner',
          inputs: [{ name: 'innerInput', type: t.string }],
          outputs: [{ name: 'innerOutput', type: t.string }],
          implementation: {
            id: 'inner-copy',
            kind: 'set',
            variable: 'innerOutput',
            value: variable('innerInput'),
          },
        },
        {
          id: 'outer',
          version: 1,
          name: 'Outer',
          inputs: [{ name: 'outerInput', type: t.string }],
          outputs: [{ name: 'outerOutput', type: t.string }],
          implementation: {
            id: 'invoke-inner',
            kind: 'composite.invoke',
            compositeId: 'inner',
            arguments: { innerInput: variable('outerInput') },
            outputs: { innerOutput: 'outerOutput' },
          },
        },
      ],
      root: {
        id: 'root',
        kind: 'sequence',
        steps: [
          {
            id: 'invoke-outer',
            kind: 'composite.invoke',
            compositeId: 'outer',
            arguments: { outerInput: variable('source') },
            outputs: { outerOutput: 'result' },
          },
          { id: 'end', kind: 'end' },
        ],
      },
    };

    const result = advanceExecution(
      createEngineState(publishArtifact(definition, 1), participants, 'axiom-test-seed'),
    );
    expect(result.state.variables).toMatchObject({
      source: 'through both scopes',
      result: 'through both scopes',
    });
    expect(result.state.scopes).toEqual({});
  });

  it.each([
    {
      name: 'read',
      operation: {
        id: 'implicit-read',
        kind: 'present',
        audience: { kind: 'everyone' },
        message: variable('globalValue'),
        privacy: 'public',
      } as const,
    },
    {
      name: 'mutation',
      operation: {
        id: 'implicit-write',
        kind: 'set',
        variable: 'globalValue',
        value: literal('changed', t.string),
      } as const,
    },
  ])('rejects an undeclared global $name at runtime', ({ operation }) => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'runtime-encapsulation',
      title: 'Runtime encapsulation',
      variables: [{ name: 'globalValue', type: t.string, initial: 'original' }],
      composites: [
        {
          id: 'isolated',
          version: 1,
          name: 'Isolated',
          inputs: [],
          outputs: [],
          implementation: operation,
        },
      ],
      root: {
        id: 'invoke-isolated',
        kind: 'composite.invoke',
        compositeId: 'isolated',
        arguments: {},
        outputs: {},
      },
    };

    expect(() =>
      advanceExecution(
        createEngineState(publishArtifact(definition, 1), participants, 'axiom-test-seed'),
      ),
    ).toThrow(/Unknown variable 'globalValue'/);
  });

  it('completes exactly once when the root exhausts normally', () => {
    const empty = run({ id: 'empty-root', kind: 'sequence', steps: [] });
    expect(empty.state.completed).toBe(true);
    expect(empty.events).toEqual([{ kind: 'execution.completed', operationId: 'empty-root' }]);
    expect(advanceExecution(empty.state).events).toEqual([]);

    const presentation = run({
      id: 'presentation-root',
      kind: 'present',
      audience: { kind: 'everyone' },
      message: literal('Shown', t.string),
      privacy: 'public',
    });
    expect(presentation.events.map((event) => event.kind)).toEqual([
      'presentation.emitted',
      'execution.completed',
    ]);
  });

  it('keeps explicit end as early termination with a single completion event', () => {
    const result = run({
      id: 'root',
      kind: 'sequence',
      steps: [
        { id: 'early-end', kind: 'end' },
        {
          id: 'unreachable',
          kind: 'present',
          audience: { kind: 'everyone' },
          message: literal('Never shown', t.string),
          privacy: 'public',
        },
      ],
    });
    expect(result.events).toEqual([{ kind: 'execution.completed', operationId: 'early-end' }]);
  });

  it('rejects a nonexistent participant in a parallel input wait', () => {
    expect(() =>
      run(
        {
          id: 'parallel',
          kind: 'control.parallel',
          join: 'all',
          branches: [
            {
              id: 'missing-participant',
              kind: 'input.wait',
              participant: literal('nobody', t.participant),
              prompt: 'Never satisfiable',
              options: ['A'],
              output: 'answer',
            },
          ],
        },
        [{ name: 'answer', type: t.string }],
      ),
    ).toThrow('not a session participant');
  });

  it('enforces Composite output assignment at runtime as defense in depth', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'missing-runtime-output',
      title: 'Missing runtime output',
      variables: [{ name: 'result', type: t.string }],
      composites: [
        {
          id: 'broken',
          version: 1,
          name: 'Broken',
          inputs: [],
          outputs: [{ name: 'value', type: t.string }],
          implementation: { id: 'does-not-assign', kind: 'sequence', steps: [] },
        },
      ],
      root: {
        id: 'invoke-broken',
        kind: 'composite.invoke',
        compositeId: 'broken',
        arguments: {},
        outputs: { value: 'result' },
      },
    };
    expect(() =>
      advanceExecution(
        createEngineState(publishArtifact(definition, 1), participants, 'axiom-test-seed'),
      ),
    ).toThrow("Composite output 'value' was not assigned");
  });

  it('rejects unsafe logical-time values and overflow before mutation', () => {
    const base = createEngineState(
      publishArtifact(
        {
          irVersion: IR_VERSION,
          gameId: 'time-domain',
          title: 'Time domain',
          variables: [],
          composites: [],
          root: { id: 'timer', kind: 'time.wait', durationMs: 2 },
        },
        1,
      ),
      participants,
      'axiom-test-seed',
    );
    expect(() => advanceLogicalTime(base, Number.MAX_SAFE_INTEGER + 1)).toThrow('safe integer');
    const nearLimit = { ...base, logicalTime: Number.MAX_SAFE_INTEGER - 1 };
    expect(() => advanceLogicalTime(nearLimit, 2)).toThrow('safe integer domain');
    expect(() => advanceExecution(nearLimit)).toThrow('safe integer domain');
    expect(nearLimit.logicalTime).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(nearLimit.pending).toEqual({});
  });
});
