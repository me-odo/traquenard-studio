import { Kysely, PostgresDialect, type Generated } from 'kysely';
import { Pool } from 'pg';

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
