import { describe, expect, it } from 'vitest';
import { IR_VERSION, literal, t, type GameDefinition } from '@traquenard/game-ir';
import { validateDefinition } from './index.js';

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
});
