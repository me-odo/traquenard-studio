import { describe, expect, it } from 'vitest';
import { IR_VERSION, literal, publishArtifact, t, type GameDefinition } from '@traquenard/game-ir';
import { acceptArtifact, validateDefinition } from './index.js';

describe('static Game IR validation', () => {
  it('rejects typed connections that cannot execute', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'invalid',
      title: 'Invalid',
      composites: [],
      variables: [{ name: 'answer', type: t.string }],
      root: { id: 'set', kind: 'set', variable: 'answer', value: literal(4, t.number) },
    };
    expect(validateDefinition(invalid)).toMatchObject({
      valid: false,
      issues: [{ code: 'type_mismatch' }],
    });
  });

  it('accepts structure, identity, and semantics through one artifact boundary', () => {
    const valid = publishArtifact(
      {
        irVersion: IR_VERSION,
        gameId: 'accepted',
        title: 'Accepted',
        variables: [],
        composites: [],
        root: { id: 'end', kind: 'end' },
      },
      1,
    );
    expect(acceptArtifact(valid)).toEqual(valid);
    expect(() => acceptArtifact({ ...valid, contentHash: 'sha256-forged' })).toThrow(
      expect.objectContaining({ code: 'ARTIFACT_HASH_MISMATCH' }),
    );
    expect(() => acceptArtifact({ ...valid, artifactId: 'accepted@1:sha256-forged' })).toThrow(
      expect.objectContaining({ code: 'ARTIFACT_HASH_MISMATCH' }),
    );

    const semanticallyInvalid = publishArtifact(
      {
        ...valid.definition,
        variables: [{ name: 'answer', type: t.string }],
        root: { id: 'invalid-set', kind: 'set', variable: 'answer', value: literal(1, t.number) },
      },
      2,
    );
    expect(() => acceptArtifact(semanticallyInvalid)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARTIFACT' }),
    );
  });

  it('rejects duplicate operation ids and unsafe v1 parallel branches', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'parallel',
      title: 'Parallel',
      variables: [],
      composites: [],
      root: {
        id: 'same',
        kind: 'control.parallel',
        join: 'all',
        branches: [{ id: 'same', kind: 'sequence', steps: [] }],
      },
    };
    const result = validateDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(['duplicate_node_id', 'unsafe_parallel_v1']),
    );
  });

  it('rejects a literal whose runtime value contradicts its declared type', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'lying-literal',
      title: 'Lying literal',
      variables: [{ name: 'count', type: t.number }],
      composites: [],
      root: { id: 'set', kind: 'set', variable: 'count', value: literal('four', t.number) },
    };
    expect(validateDefinition(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'literal_value_type_mismatch' })]),
    );
  });

  it('validates composite interfaces and invocation bindings', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'composite-contract',
      title: 'Composite contract',
      variables: [
        { name: 'participant', type: t.participant },
        { name: 'answer', type: t.number },
      ],
      composites: [
        {
          id: 'ask',
          version: 1,
          name: 'Ask',
          inputs: [{ name: 'target', type: t.participant }],
          outputs: [{ name: 'response', type: t.string }],
          implementation: { id: 'done', kind: 'end' },
        },
      ],
      root: {
        id: 'invoke',
        kind: 'composite.invoke',
        compositeId: 'ask',
        arguments: { target: literal('p1', t.participant) },
        outputs: { response: 'answer' },
      },
    };
    expect(validateDefinition(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'output_type_mismatch' })]),
    );
  });

  it('rejects undeclared global reads and writes inside composite scopes', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'encapsulation',
      title: 'Encapsulation',
      variables: [{ name: 'globalMessage', type: t.string, initial: 'hidden dependency' }],
      composites: [
        {
          id: 'reads-global',
          version: 1,
          name: 'Reads global',
          inputs: [],
          outputs: [],
          implementation: {
            id: 'read-global',
            kind: 'present',
            audience: { kind: 'everyone' },
            message: { kind: 'variable', name: 'globalMessage' },
            privacy: 'public',
          },
        },
        {
          id: 'writes-global',
          version: 1,
          name: 'Writes global',
          inputs: [],
          outputs: [],
          implementation: {
            id: 'write-global',
            kind: 'set',
            variable: 'globalMessage',
            value: literal('mutated', t.string),
          },
        },
      ],
      root: { id: 'end', kind: 'end' },
    };

    const result = validateDefinition(invalid);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'composites.0.implementation.message',
          code: 'unknown_variable',
        }),
        expect.objectContaining({
          path: 'composites.1.implementation.variable',
          code: 'unknown_variable',
        }),
      ]),
    );
  });

  it('requires contextual participant access to cross an explicit composite input', () => {
    const invalid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'context-encapsulation',
      title: 'Context encapsulation',
      variables: [],
      composites: [
        {
          id: 'implicit-context',
          version: 1,
          name: 'Implicit context',
          inputs: [],
          outputs: [],
          implementation: {
            id: 'pick',
            kind: 'random.select',
            from: { kind: 'participants' },
            output: 'selected',
          },
        },
      ],
      root: { id: 'end', kind: 'end' },
    };

    expect(validateDefinition(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'implicit_composite_context' })]),
    );
  });

  it('rejects aliases between distinct Composite output ports', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'output-alias',
      title: 'Output alias',
      variables: [{ name: 'result', type: t.string }],
      composites: [
        {
          id: 'pair',
          version: 1,
          name: 'Pair',
          inputs: [],
          outputs: [
            { name: 'a', type: t.string },
            { name: 'b', type: t.string },
          ],
          implementation: {
            id: 'assign-pair',
            kind: 'sequence',
            steps: [
              { id: 'assign-a', kind: 'set', variable: 'a', value: literal('A', t.string) },
              { id: 'assign-b', kind: 'set', variable: 'b', value: literal('B', t.string) },
            ],
          },
        },
      ],
      root: {
        id: 'invoke-pair',
        kind: 'composite.invoke',
        compositeId: 'pair',
        arguments: {},
        outputs: { a: 'result', b: 'result' },
      },
    };
    expect(validateDefinition(definition).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'root.outputs.b',
          code: 'composite_output_alias',
          message: "Composite output ports 'a' and 'b' cannot both bind caller variable 'result'.",
        }),
      ]),
    );
  });

  it.each([
    {
      name: 'direct',
      composites: [
        {
          id: 'A',
          version: 1,
          name: 'A',
          inputs: [],
          outputs: [],
          implementation: {
            id: 'A-calls-A',
            kind: 'composite.invoke' as const,
            compositeId: 'A',
            arguments: {},
            outputs: {},
          },
        },
      ],
      cycle: 'A -> A',
    },
    {
      name: 'indirect',
      composites: ['A', 'B', 'C'].map((id, index, all) => ({
        id,
        version: 1,
        name: id,
        inputs: [],
        outputs: [],
        implementation: {
          id: `${id}-calls-next`,
          kind: 'composite.invoke' as const,
          compositeId: all[(index + 1) % all.length]!,
          arguments: {},
          outputs: {},
        },
      })),
      cycle: 'A -> B -> C -> A',
    },
  ])('rejects $name Composite call cycles', ({ composites, cycle }) => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'cycles',
      title: 'Cycles',
      variables: [],
      composites,
      root: { id: 'root-end', kind: 'end' },
    };
    const cycleIssue = validateDefinition(definition).issues.find(
      (issue) => issue.code === 'composite_call_cycle',
    );
    expect(cycleIssue?.message).toContain(cycle);
  });

  it('requires Composite outputs on every normal return path', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'definite-output',
      title: 'Definite output',
      variables: [],
      composites: [
        {
          id: 'conditional',
          version: 1,
          name: 'Conditional',
          inputs: [{ name: 'condition', type: t.boolean }],
          outputs: [{ name: 'result', type: t.string }],
          implementation: {
            id: 'optional-assignment',
            kind: 'control.if',
            condition: { kind: 'variable', name: 'condition' },
            then: {
              id: 'assign-result',
              kind: 'set',
              variable: 'result',
              value: literal('assigned', t.string),
            },
          },
        },
        {
          id: 'loop',
          version: 1,
          name: 'Loop',
          inputs: [{ name: 'items', type: t.collection(t.string) }],
          outputs: [{ name: 'result', type: t.string }],
          implementation: {
            id: 'possibly-empty-loop',
            kind: 'control.foreach',
            collection: { kind: 'variable', name: 'items' },
            itemVariable: 'item',
            body: {
              id: 'copy-item',
              kind: 'set',
              variable: 'result',
              value: { kind: 'variable', name: 'item' },
            },
          },
        },
      ],
      root: { id: 'root-end', kind: 'end' },
    };
    expect(
      validateDefinition(definition).issues.filter(
        (issue) => issue.code === 'composite_output_not_assigned',
      ),
    ).toHaveLength(2);
  });

  it('does not require a Composite output on an explicit terminating path', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'early-end-output',
      title: 'Early end output',
      variables: [],
      composites: [
        {
          id: 'conditional-end',
          version: 1,
          name: 'Conditional end',
          inputs: [{ name: 'stop', type: t.boolean }],
          outputs: [{ name: 'result', type: t.string }],
          implementation: {
            id: 'conditional',
            kind: 'control.if',
            condition: { kind: 'variable', name: 'stop' },
            then: { id: 'stop', kind: 'end' },
            else: {
              id: 'assign',
              kind: 'set',
              variable: 'result',
              value: literal('returned', t.string),
            },
          },
        },
      ],
      root: { id: 'root-end', kind: 'end' },
    };
    expect(validateDefinition(definition)).toEqual({ valid: true, issues: [] });
  });

  it('recognizes a nested Composite return as a definite output assignment', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'nested-output',
      title: 'Nested output',
      variables: [],
      composites: [
        {
          id: 'inner',
          version: 1,
          name: 'Inner',
          inputs: [],
          outputs: [{ name: 'value', type: t.string }],
          implementation: {
            id: 'inner-set',
            kind: 'set',
            variable: 'value',
            value: literal('ok', t.string),
          },
        },
        {
          id: 'outer',
          version: 1,
          name: 'Outer',
          inputs: [],
          outputs: [{ name: 'result', type: t.string }],
          implementation: {
            id: 'outer-invoke',
            kind: 'composite.invoke',
            compositeId: 'inner',
            arguments: {},
            outputs: { value: 'result' },
          },
        },
      ],
      root: { id: 'root-end', kind: 'end' },
    };
    expect(validateDefinition(definition)).toEqual({ valid: true, issues: [] });
  });

  it('rejects conflicting parallel writes', () => {
    const definition: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'parallel-conflict',
      title: 'Parallel conflict',
      variables: [{ name: 'answer', type: t.string }],
      composites: [],
      root: {
        id: 'parallel',
        kind: 'control.parallel',
        join: 'all',
        branches: ['p1', 'p2'].map((participantId) => ({
          id: `wait-${participantId}`,
          kind: 'input.wait' as const,
          participant: literal(participantId, t.participant),
          prompt: 'Answer',
          options: ['yes'],
          output: 'answer',
        })),
      },
    };
    expect(validateDefinition(definition).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'parallel_write_conflict' })]),
    );
  });

  it('type-checks a scalar participant audience inside a Composite', () => {
    const valid: GameDefinition = {
      irVersion: IR_VERSION,
      gameId: 'participant-audience',
      title: 'Participant audience',
      variables: [],
      composites: [
        {
          id: 'private-message',
          version: 1,
          name: 'Private message',
          inputs: [{ name: 'recipient', type: t.participant }],
          outputs: [],
          implementation: {
            id: 'present-private',
            kind: 'present',
            audience: { kind: 'participant', id: { kind: 'variable', name: 'recipient' } },
            message: literal('Private', t.string),
            privacy: 'private',
          },
        },
      ],
      root: { id: 'root-end', kind: 'end' },
    };
    expect(validateDefinition(valid)).toEqual({ valid: true, issues: [] });
    const invalid: GameDefinition = {
      ...valid,
      composites: [
        {
          ...valid.composites[0]!,
          inputs: [{ name: 'recipient', type: t.number }],
        },
      ],
    };
    expect(validateDefinition(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'type_mismatch' })]),
    );
  });
});
