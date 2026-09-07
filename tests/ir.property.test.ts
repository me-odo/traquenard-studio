import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  IR_VERSION,
  parseGameArtifact,
  publishArtifact,
  t,
  type GameDefinition,
} from '@traquenard/game-ir';
import { validateDefinition } from '@traquenard/game-validator';

describe('Game IR properties', () => {
  it('preserves valid artifacts through JSON serialization', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((value) => value.trim().length > 0),
        fc.integer({ min: 1, max: 10_000 }),
        (title, version) => {
          const definition: GameDefinition = {
            irVersion: IR_VERSION,
            gameId: 'generated',
            title,
            variables: [],
            composites: [],
            root: { id: 'end', kind: 'end' },
          };
          const artifact = publishArtifact(definition, version);
          expect(parseGameArtifact(JSON.parse(JSON.stringify(artifact)))).toEqual(artifact);
        },
      ),
      { seed: 20260907 },
    );
  });

  it('never validates a generated string-to-number connection', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const definition: GameDefinition = {
          irVersion: IR_VERSION,
          gameId: 'invalid',
          title: 'Invalid',
          variables: [{ name: 'count', type: t.number }],
          composites: [],
          root: {
            id: 'set',
            kind: 'set',
            variable: 'count',
            value: { kind: 'literal', value, valueType: t.string },
          },
        };
        expect(validateDefinition(definition).valid).toBe(false);
      }),
      { seed: 20260907 },
    );
  });
});
