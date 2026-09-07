import { Kysely, PostgresDialect, type Generated } from 'kysely';
import { Pool } from 'pg';
import type { GameArtifact } from '@traquenard/game-ir';
import { acceptArtifact } from '@traquenard/game-validator';

export interface Database {
  game_artifact: {
    artifact_id: string;
    game_id: string;
    game_version: number;
    content_hash: string;
    payload: unknown;
    created_at: Generated<Date>;
  };
  session_event: {
    session_id: string;
    sequence: number;
    logical_time: number;
    payload: unknown;
    created_at: Generated<Date>;
  };
}

export function createDatabase(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

export interface ArtifactRepository {
  put(artifact: GameArtifact): Promise<void>;
  getById(artifactId: string): Promise<GameArtifact | undefined>;
}

export class ArtifactVersionConflictError extends Error {
  public readonly code = 'IMMUTABLE_ARTIFACT_VERSION';
  public constructor(gameId: string, gameVersion: number) {
    super(`Game version '${gameId}@${gameVersion}' already identifies different content.`);
  }
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  readonly #byId = new Map<string, GameArtifact>();
  readonly #byVersion = new Map<string, GameArtifact>();

  public put(artifact: GameArtifact): Promise<void> {
    return Promise.resolve().then(() => {
      const accepted = acceptArtifact(artifact);
      const key = versionKey(accepted);
      const existing = this.#byVersion.get(key);
      if (existing && existing.contentHash !== accepted.contentHash)
        throw new ArtifactVersionConflictError(accepted.definition.gameId, accepted.gameVersion);
      this.#byVersion.set(key, accepted);
      this.#byId.set(accepted.artifactId, accepted);
    });
  }

  public getById(artifactId: string): Promise<GameArtifact | undefined> {
    return Promise.resolve(this.#byId.get(artifactId));
  }
}

export class PostgresArtifactRepository implements ArtifactRepository {
  public constructor(private readonly database: Kysely<Database>) {}

  public async put(artifact: GameArtifact): Promise<void> {
    const accepted = acceptArtifact(artifact);
    await this.database
      .insertInto('game_artifact')
      .values({
        artifact_id: accepted.artifactId,
        game_id: accepted.definition.gameId,
        game_version: accepted.gameVersion,
        content_hash: accepted.contentHash,
        payload: accepted,
      })
      .onConflict((conflict) => conflict.columns(['game_id', 'game_version']).doNothing())
      .execute();
    const existing = await this.database
      .selectFrom('game_artifact')
      .select(['artifact_id', 'content_hash'])
      .where('game_id', '=', accepted.definition.gameId)
      .where('game_version', '=', accepted.gameVersion)
      .executeTakeFirstOrThrow();
    if (
      existing.artifact_id !== accepted.artifactId ||
      existing.content_hash !== accepted.contentHash
    )
      throw new ArtifactVersionConflictError(accepted.definition.gameId, accepted.gameVersion);
  }

  public async getById(artifactId: string): Promise<GameArtifact | undefined> {
    const row = await this.database
      .selectFrom('game_artifact')
      .select('payload')
      .where('artifact_id', '=', artifactId)
      .executeTakeFirst();
    return row ? acceptArtifact(row.payload) : undefined;
  }
}

function versionKey(artifact: GameArtifact): string {
  return `${artifact.definition.gameId}\u0000${artifact.gameVersion}`;
}
