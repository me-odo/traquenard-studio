import { expect } from 'vitest';
import { createSession } from '@traquenard/engine-runtime';
import {
  literal,
  publishArtifact,
  t,
  type GameArtifact,
  type GameDefinition,
} from '@traquenard/game-ir';
import { validateArtifact } from '@traquenard/game-validator';
import type { ArtifactRepository } from '../../apps/server/src/database.js';

export async function verifyArtifactRepositoryContract(
  repository: ArtifactRepository,
): Promise<void> {
  const base = orderedDefinition(false);
  const first = publishArtifact(base, 27);
  const reordered = publishArtifact(orderedDefinition(true), 27);
  const conflicting = publishArtifact({ ...base, title: 'Different content' }, 27);

  expect(reordered.contentHash).toBe(first.contentHash);
  expect(reordered.artifactId).toBe(first.artifactId);
  expect(validateArtifact(reordered)).toEqual(validateArtifact(first));
  await repository.put(first);
  await repository.put(reordered);
  const fetched = await repository.getById(first.artifactId);
  expect(fetched).toBeDefined();
  const sessionOptions = {
    sessionId: 'repository-session',
    joinCode: 'ORDER',
    participants: [{ id: 'p1', name: 'Host', isHost: true, required: true }],
    semanticSeed: 'repository-contract-seed',
  } as const;
  expect(createSession({ ...sessionOptions, artifact: fetched! })).toEqual(
    createSession({ ...sessionOptions, artifact: first }),
  );

  await expect(repository.put({ ...first, contentHash: 'sha256-forged' })).rejects.toMatchObject({
    code: 'ARTIFACT_HASH_MISMATCH',
  });
  await expect(
    repository.put({ ...first, artifactId: 'repository-contract@27:sha256-forged' }),
  ).rejects.toMatchObject({ code: 'ARTIFACT_HASH_MISMATCH' });
  await expect(repository.put(conflicting)).rejects.toMatchObject({
    code: 'IMMUTABLE_ARTIFACT_VERSION',
  });
}

export function equivalentArtifactRepresentations(): readonly [GameArtifact, GameArtifact] {
  return [
    publishArtifact(orderedDefinition(false), 27),
    publishArtifact(orderedDefinition(true), 27),
  ];
}

function orderedDefinition(reverseBindings: boolean): GameDefinition {
  const argumentsInOrder = reverseBindings
    ? { äInput: literal('non-ascii', t.string), zInput: literal('ascii', t.string) }
    : { zInput: literal('ascii', t.string), äInput: literal('non-ascii', t.string) };
  const outputsInOrder = reverseBindings
    ? { ä: 'äResult', z: 'zResult' }
    : { z: 'zResult', ä: 'äResult' };
  return {
    irVersion: 1,
    gameId: 'repository-contract',
    title: 'Ordered content',
    variables: [
      { name: 'zResult', type: t.string },
      { name: 'äResult', type: t.string },
    ],
    composites: [
      {
        id: 'ordered-copy',
        version: 1,
        name: 'Ordered copy',
        inputs: [
          { name: 'zInput', type: t.string },
          { name: 'äInput', type: t.string },
        ],
        outputs: [
          { name: 'z', type: t.string },
          { name: 'ä', type: t.string },
        ],
        implementation: {
          id: 'copy-sequence',
          kind: 'sequence',
          steps: [
            {
              id: 'copy-z',
              kind: 'set',
              variable: 'z',
              value: { kind: 'variable', name: 'zInput' },
            },
            {
              id: 'copy-non-ascii',
              kind: 'set',
              variable: 'ä',
              value: { kind: 'variable', name: 'äInput' },
            },
          ],
        },
      },
    ],
    root: {
      id: 'invoke-copy',
      kind: 'composite.invoke',
      compositeId: 'ordered-copy',
      arguments: argumentsInOrder,
      outputs: outputsInOrder,
    },
  };
}
