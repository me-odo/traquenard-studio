import { afterAll, beforeAll, describe, it } from 'vitest';
import { createDatabase, PostgresArtifactRepository } from '../apps/server/src/database.js';
import { verifyArtifactRepositoryContract } from './support/artifact-repository-contract.js';

const connectionString = process.env.DATABASE_URL;
describe.skipIf(!connectionString)('PostgreSQL artifact repository', () => {
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database
      .deleteFrom('game_artifact')
      .where('game_id', '=', 'repository-contract')
      .execute();
  });

  afterAll(async () => {
    await database
      .deleteFrom('game_artifact')
      .where('game_id', '=', 'repository-contract')
      .execute();
    await database.destroy();
  });

  it('implements immutable version identity', async () => {
    await verifyArtifactRepositoryContract(new PostgresArtifactRepository(database));
  });
});
