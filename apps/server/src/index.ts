import websocket from '@fastify/websocket';
import { randomBytes } from 'node:crypto';
import {
  EngineError,
  applyClientCommand,
  createSession,
  projectEvents,
  type ClientCommand,
  type Participant,
  type SessionState,
} from '@traquenard/engine-runtime';
import type { GameArtifact } from '@traquenard/game-ir';
import { acceptArtifact, ArtifactAcceptanceError } from '@traquenard/game-validator';
import {
  ClientCommandSchema,
  CreateSessionSchema,
  JoinSessionSchema,
} from '@traquenard/multiplayer-protocol';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ArtifactVersionConflictError,
  InMemoryArtifactRepository,
  type ArtifactRepository,
} from './database.js';

interface Lobby {
  readonly sessionId: string;
  readonly joinCode: string;
  readonly artifact: GameArtifact;
  readonly host: Participant;
  readonly semanticSeed: string;
  readonly credentials: Map<string, string>;
  session?: SessionState;
}

export async function buildServer(
  options: {
    readonly artifactRepository?: ArtifactRepository;
    readonly credentialFactory?: () => string;
    readonly semanticSeedFactory?: () => string;
  } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(websocket);
  const artifacts = options.artifactRepository ?? new InMemoryArtifactRepository();
  const credentialFactory =
    options.credentialFactory ?? (() => randomBytes(32).toString('base64url'));
  const semanticSeedFactory =
    options.semanticSeedFactory ?? (() => randomBytes(32).toString('hex'));
  const lobbies = new Map<string, Lobby>();
  let sessionSequence = 0;

  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof AuthenticationError
        ? 401
        : error instanceof ArtifactVersionConflictError
          ? 409
          : error instanceof z.ZodError ||
              error instanceof EngineError ||
              error instanceof ArtifactAcceptanceError
            ? 400
            : 500;
    const message = error instanceof Error ? error.message : 'Unknown request error';
    return reply.status(status).send({
      error:
        error instanceof EngineError ||
        error instanceof ArtifactAcceptanceError ||
        error instanceof AuthenticationError ||
        error instanceof ArtifactVersionConflictError
          ? error.code
          : 'INVALID_REQUEST',
      message,
    });
  });

  app.get('/health', () => ({ status: 'ok' }));

  app.post('/api/artifacts', async (request, reply) => {
    const artifact = acceptArtifact(request.body);
    await artifacts.put(artifact);
    return reply
      .status(201)
      .send({ artifactId: artifact.artifactId, contentHash: artifact.contentHash });
  });

  app.post('/api/sessions', async (request, reply) => {
    const body = CreateSessionSchema.parse(request.body);
    const storedArtifact = await artifacts.getById(body.artifactId);
    if (!storedArtifact) return reply.status(404).send({ error: 'ARTIFACT_NOT_FOUND' });
    const artifact = acceptArtifact(storedArtifact);
    sessionSequence += 1;
    const sessionId = `session-${sessionSequence}`;
    const joinCode = `PLAY${String(sessionSequence).padStart(2, '0')}`;
    const credential = credentialFactory();
    lobbies.set(joinCode, {
      sessionId,
      joinCode,
      artifact,
      host: { id: 'p1', name: body.hostName, isHost: true, required: true },
      semanticSeed: semanticSeedFactory(),
      credentials: new Map([[credential, 'p1']]),
    });
    return reply
      .status(201)
      .send({ sessionId, joinCode, participantId: 'p1', credential, status: 'waiting-for-player' });
  });

  app.post<{ Params: { joinCode: string } }>(
    '/api/sessions/:joinCode/join',
    async (request, reply) => {
      const body = JoinSessionSchema.parse(request.body);
      const lobby = lobbies.get(request.params.joinCode);
      if (!lobby) return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
      if (lobby.session) return reply.status(409).send({ error: 'SESSION_ALREADY_JOINED' });
      const credential = credentialFactory();
      const guest: Participant = { id: 'p2', name: body.name, isHost: false, required: true };
      lobby.credentials.set(credential, guest.id);
      lobby.session = createSession({
        sessionId: lobby.sessionId,
        joinCode: lobby.joinCode,
        artifact: lobby.artifact,
        participants: [lobby.host, guest],
        semanticSeed: lobby.semanticSeed,
      });
      return reply.status(201).send({
        sessionId: lobby.sessionId,
        participantId: 'p2',
        credential,
        status: lobby.session.status,
        events: projectEvents(lobby.session, 'p2'),
      });
    },
  );

  app.get<{ Params: { joinCode: string } }>('/api/sessions/:joinCode', async (request, reply) => {
    const lobby = lobbies.get(request.params.joinCode);
    if (!lobby) return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
    const participantId = authenticate(lobby, request.headers.authorization);
    if (!lobby.session)
      return {
        sessionId: lobby.sessionId,
        joinCode: lobby.joinCode,
        status: 'waiting-for-player',
        events: [],
      };
    return {
      sessionId: lobby.sessionId,
      joinCode: lobby.joinCode,
      status: lobby.session.status,
      logicalTime: lobby.session.engine.logicalTime,
      events: projectEvents(lobby.session, participantId),
    };
  });

  app.post<{ Params: { joinCode: string } }>(
    '/api/sessions/:joinCode/commands',
    async (request, reply) => {
      const lobby = lobbies.get(request.params.joinCode);
      if (!lobby?.session) return reply.status(404).send({ error: 'SESSION_NOT_RUNNING' });
      const participantId = authenticate(lobby, request.headers.authorization);
      const command = ClientCommandSchema.parse(request.body) as ClientCommand;
      lobby.session = applyClientCommand(lobby.session, participantId, command);
      return { status: lobby.session.status, events: projectEvents(lobby.session, participantId) };
    },
  );

  app.get('/realtime', { websocket: true }, (socket: { send: (payload: string) => void }) => {
    socket.send(JSON.stringify({ protocolVersion: 1, kind: 'ready' }));
  });

  return app;
}

class AuthenticationError extends Error {
  public readonly code = 'INVALID_SESSION_CREDENTIAL';
}

function authenticate(lobby: Lobby, authorization: string | undefined): string {
  const match = /^Bearer (.+)$/.exec(authorization ?? '');
  const participantId = match ? lobby.credentials.get(match[1]!) : undefined;
  if (!participantId) throw new AuthenticationError('A valid participant credential is required.');
  return participantId;
}
