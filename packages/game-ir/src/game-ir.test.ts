import { describe, expect, it } from 'vitest';
import {
  GameArtifactSchema,
  IR_VERSION,
  canonicalJson,
  parseGameArtifact,
  publishArtifact,
  t,
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
    expect(artifact.artifactId).toContain('tiny@1:fnv1a-');
  });

  it('canonicalizes object key ordering for stable hashes', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('rejects an unsupported serialized IR version', () => {
    expect(() =>
      parseGameArtifact({
        ...publishArtifact(definition, 1),
        definition: { ...definition, irVersion: 2 },
      }),
    ).toThrow();
  });

  it('represents nested collection types independently of runtime frameworks', () => {
    expect(t.collection(t.collection(t.string))).toEqual({
      kind: 'collection',
      element: { kind: 'collection', element: { kind: 'string' } },
    });
  });
});
