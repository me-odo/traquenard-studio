import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  IR_VERSION,
  contentHash,
  parseGameArtifact,
  publishArtifact,
  t,
  type GameDefinition,
} from '@traquenard/game-ir';
import { validateDefinition } from '@traquenard/game-validator';

describe('Game IR properties', () => {
  it('keeps canonical hashes invariant under record insertion order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom('a', 'z', 'Z', 'ä', 'é', '東京', 'e\u0301'), fc.integer(), {
          minKeys: 2,
        }),
        (record) => {
          const reversed = Object.fromEntries(Object.entries(record).reverse());
          expect(contentHash(reversed)).toBe(contentHash(record));
        },
      ),
      { seed: 20260907 },
    );
  });

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

  it('never accepts heterogeneous values under a homogeneous collection type', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.string(), (numbers, text) => {
        const definition: GameDefinition = {
          irVersion: IR_VERSION,
          gameId: 'heterogeneous',
          title: 'Heterogeneous',
          variables: [{ name: 'numbers', type: t.collection(t.number) }],
          composites: [],
          root: {
            id: 'set',
            kind: 'set',
            variable: 'numbers',
            value: {
              kind: 'literal',
              value: [...numbers, text],
              valueType: t.collection(t.number),
            },
          },
        };
        expect(validateDefinition(definition).valid).toBe(false);
      }),
      { seed: 20260907 },
    );
  });

  it('accepts arbitrary empty collections when their explicit type is sound', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(t.string, t.number, t.boolean, t.participant, t.card),
        (element) => {
          const definition: GameDefinition = {
            irVersion: IR_VERSION,
            gameId: 'empty',
            title: 'Empty',
            variables: [{ name: 'items', type: t.collection(element), initial: [] }],
            composites: [],
            root: { id: 'end', kind: 'end' },
          };
          expect(validateDefinition(definition).valid).toBe(true);
        },
      ),
      { seed: 20260907 },
    );
  });
});
