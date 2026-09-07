import { describe, expect, it } from 'vitest';
import {
  GameArtifactSchema,
  IR_VERSION,
  canonicalJson,
  parseGameArtifact,
  publishArtifact,
  t,
  valueConformsToType,
  type GameDefinition,
} from './index.js';

const definition: GameDefinition = {
  irVersion: IR_VERSION,
  gameId: 'tiny',
  title: 'Tiny',
  variables: [],
  composites: [],
  root: { id: 'end', kind: 'end' },
};

describe('Game Artifact publishing', () => {
  it('creates an immutable, versioned and schema-valid artifact', () => {
    const artifact = publishArtifact(definition, 1);
    expect(GameArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.definition)).toBe(true);
    expect(artifact.artifactId).toMatch(/^tiny@1:sha256-[a-f0-9]{64}$/);
  });

  it('canonicalizes object key ordering for stable hashes', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('orders ASCII and non-ASCII keys by locale-independent UTF-16 code units', () => {
    const first = { ä: 1, z: 2, é: { å: 3, a: 4 } };
    const second = { é: { a: 4, å: 3 }, z: 2, ä: 1 };
    expect(canonicalJson(first)).toBe('{"z":2,"ä":1,"é":{"a":4,"å":3}}');
    expect(canonicalJson(second)).toBe(canonicalJson(first));
  });

  it('does not normalize semantically distinct Unicode strings', () => {
    expect(canonicalJson({ value: 'é' })).not.toBe(canonicalJson({ value: 'e\u0301' }));
  });

  it('rejects an unsupported serialized IR version', () => {
    expect(() =>
      parseGameArtifact({
        ...publishArtifact(definition, 1),
        definition: { ...definition, irVersion: 2 },
      }),
    ).toThrow();
  });

  it('rejects timer durations outside the safe-integer domain', () => {
    expect(() =>
      publishArtifact(
        {
          ...definition,
          root: {
            id: 'unsafe-timer',
            kind: 'time.wait',
            durationMs: Number.MAX_SAFE_INTEGER + 1,
          },
        },
        1,
      ),
    ).toThrow();
  });

  it('represents nested collection types independently of runtime frameworks', () => {
    expect(t.collection(t.collection(t.string))).toEqual({
      kind: 'collection',
      element: { kind: 'collection', element: { kind: 'string' } },
    });
  });

  it('validates empty and nested collection values from their explicit element type', () => {
    expect(valueConformsToType([], t.collection(t.number))).toBe(true);
    expect(
      valueConformsToType(
        [
          [1, 2],
          [3, 4],
        ],
        t.collection(t.collection(t.number)),
      ),
    ).toBe(true);
    expect(valueConformsToType([1, '2'], t.collection(t.number))).toBe(false);
  });

  it('rejects non-finite numbers and non-card objects at the literal boundary', () => {
    expect(valueConformsToType(Number.POSITIVE_INFINITY, t.number)).toBe(false);
    expect(valueConformsToType({ id: 'a', suit: 'hearts', rank: 'A' }, t.card)).toBe(true);
    expect(valueConformsToType([], t.card)).toBe(false);
  });
});
