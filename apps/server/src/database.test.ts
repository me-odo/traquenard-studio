import { describe, it } from 'vitest';
import { verifyArtifactRepositoryContract } from '../../../tests/support/artifact-repository-contract.js';
import { InMemoryArtifactRepository } from './database.js';

describe('in-memory artifact repository', () => {
  it('implements immutable version identity', async () => {
    await verifyArtifactRepositoryContract(new InMemoryArtifactRepository());
  });
});
