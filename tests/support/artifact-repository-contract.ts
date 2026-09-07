import { expect } from 'vitest';
import { publishArtifact, type GameDefinition } from '@traquenard/game-ir';
import type { ArtifactRepository } from '../../apps/server/src/database.js';

export async function verifyArtifactRepositoryContract(
  repository: ArtifactRepository,
): Promise<void> {
  const base: GameDefinition = {
    irVersion: 1,
    gameId: 'repository-contract',
    title: 'First content',
    variables: [],
    composites: [],
    root: { id: 'end', kind: 'end' },
  };
  const first = publishArtifact(base, 27);
  const conflicting = publishArtifact({ ...base, title: 'Different content' }, 27);

  await repository.put(first);
  await repository.put(first);
  expect(await repository.getById(first.artifactId)).toEqual(first);
  await expect(repository.put(conflicting)).rejects.toMatchObject({
    code: 'IMMUTABLE_ARTIFACT_VERSION',
  });
}
