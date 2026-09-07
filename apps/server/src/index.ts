import websocket from '@fastify/websocket';
import {
  EngineError,
  applyCommand,
  createSession,
  projectEvents,
  type ExternalCommand,
  type Participant,
  type SessionState,
} from '@traquenard/engine-runtime';
import { contentHash, parseGameArtifact, type GameArtifact } from '@traquenard/game-ir';
import {
  ClientCommandSchema,
  CreateSessionSchema,
  JoinSessionSchema,
} from '@traquenard/multiplayer-protocol';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

interface Lobby {
  readonly sessionId: string;
  readonly joinCode: string;
  readonly artifact: GameArtifact;
  readonly host: Participant;
  readonly seed: number;
  session?: SessionState;
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(websocket);
  const artifacts = new Map<string, GameArtifact>();
  const lobbies = new Map<string, Lobby>();
  let sessionSequence = 0;

  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof z.ZodError || error instanceof EngineError ? 400 : 500;
    const message = error instanceof Error ? error.message : 'Unknown request error';
    return reply
      .status(status)
      .send({ error: error instanceof EngineError ? error.code : 'INVALID_REQUEST', message });
  });

  app.get('/health', () => ({ status: 'ok' }));

  app.post('/api/artifacts', async (request, reply) => {
    const artifact = parseGameArtifact(request.body);
    const expected = contentHash({
      artifactFormat: artifact.artifactFormat,
      gameVersion: artifact.gameVersion,
      definition: artifact.definition,
      assets: artifact.assets,
    });
    if (
      expected !== artifact.contentHash ||
      artifact.artifactId !== `${artifact.definition.gameId}@${artifact.gameVersion}:${expected}`
    )
      throw new EngineError(
        'ARTIFACT_HASH_MISMATCH',
        'Artifact identity does not match canonical content.',
      );
    const existing = artifacts.get(artifact.artifactId);
    if (existing && existing.contentHash !== artifact.contentHash)
      throw new EngineError('IMMUTABLE_ARTIFACT', 'A published artifact cannot be replaced.');
    artifacts.set(artifact.artifactId, artifact);
    return reply
      .status(201)
      .send({ artifactId: artifact.artifactId, contentHash: artifact.contentHash });
  });

  app.post('/api/sessions', async (request, reply) => {
    const body = CreateSessionSchema.parse(request.body);
    const artifact = artifacts.get(body.artifactId);
    if (!artifact) return reply.status(404).send({ error: 'ARTIFACT_NOT_FOUND' });
    sessionSequence += 1;
    const sessionId = `session-${sessionSequence}`;
    const joinCode = `PLAY${String(sessionSequence).padStart(2, '0')}`;
    lobbies.set(joinCode, {
      sessionId,
      joinCode,
      artifact,
      host: { id: 'p1', name: body.hostName, isHost: true, required: true },
      seed: body.seed ?? 1,
    });
    return reply
      .status(201)
      .send({ sessionId, joinCode, participantId: 'p1', status: 'waiting-for-player' });
  });

  app.post<{ Params: { joinCode: string } }>(
    '/api/sessions/:joinCode/join',
    async (request, reply) => {
      const body = JoinSessionSchema.parse(request.body);
      const lobby = lobbies.get(request.params.joinCode);
      if (!lobby) return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
      if (!lobby.session) {
        const guest: Participant = { id: 'p2', name: body.name, isHost: false, required: true };
        lobby.session = createSession({
          sessionId: lobby.sessionId,
          joinCode: lobby.joinCode,
          artifact: lobby.artifact,
          participants: [lobby.host, guest],
          seed: lobby.seed,
        });
      }
      return reply.status(201).send({
        sessionId: lobby.sessionId,
        participantId: 'p2',
        status: lobby.session.status,
        events: projectEvents(lobby.session, 'p2'),
      });
    },
  );

  app.get<{ Params: { joinCode: string }; Querystring: { participantId?: string } }>(
    '/api/sessions/:joinCode',
    async (request, reply) => {
      const lobby = lobbies.get(request.params.joinCode);
      if (!lobby) return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
      if (!lobby.session)
        return {
          sessionId: lobby.sessionId,
          joinCode: lobby.joinCode,
          status: 'waiting-for-player',
          events: [],
        };
      const participantId = request.query.participantId ?? '';
      return {
        sessionId: lobby.sessionId,
        joinCode: lobby.joinCode,
        status: lobby.session.status,
        logicalTime: lobby.session.engine.logicalTime,
        events: projectEvents(lobby.session, participantId),
      };
    },
  );

  app.post<{ Params: { joinCode: string } }>(
    '/api/sessions/:joinCode/commands',
    async (request, reply) => {
      const lobby = lobbies.get(request.params.joinCode);
      if (!lobby?.session) return reply.status(404).send({ error: 'SESSION_NOT_RUNNING' });
      const command = ClientCommandSchema.parse(request.body) as ExternalCommand;
      lobby.session = applyCommand(lobby.session, command);
      const viewerId = 'participantId' in command ? command.participantId : lobby.host.id;
      return { status: lobby.session.status, events: projectEvents(lobby.session, viewerId) };
    },
  );

  app.get('/realtime', { websocket: true }, (socket: { send: (payload: string) => void }) => {
    socket.send(JSON.stringify({ protocolVersion: 1, kind: 'ready' }));
  });

  return app;
}
