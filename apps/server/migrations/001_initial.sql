CREATE TABLE IF NOT EXISTS game_artifact (
  artifact_id text PRIMARY KEY,
  game_id text NOT NULL,
  game_version integer NOT NULL,
  content_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, game_version)
);
CREATE TABLE IF NOT EXISTS session_event (
  session_id text NOT NULL,
  sequence integer NOT NULL,
  logical_time bigint NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, sequence)
);
