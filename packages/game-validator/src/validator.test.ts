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
});
