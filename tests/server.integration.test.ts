import { afterEach, describe, expect, it } from 'vitest';
import { publishDraft, sequentialDraft } from '@traquenard/authoring-domain';
import { buildServer } from '../apps/server/src/index.js';
import { referenceCardRound } from '../packages/game-simulator/src/reference-games.js';

describe('Fastify vertical slice', () => {
  let app: Awaited<ReturnType<typeof buildServer>> | undefined;
  afterEach(async () => app?.close());

  it('publishes, hosts, joins, and accepts an authoritative player intent', async () => {
    app = await buildServer();
    const artifact = publishDraft(sequentialDraft, 1);
    const published = await app.inject({
      method: 'POST',
      url: '/api/artifacts',
      payload: artifact,
    });
    expect(published.statusCode).toBe(201);

    const hosted = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { artifactId: artifact.artifactId, hostName: 'Host', seed: 1 },
    });
    expect(hosted.statusCode).toBe(201);
    const { joinCode, credential: hostCredential } = hosted.json<{
      joinCode: string;
      credential: string;
    }>();

    const joined = await app.inject({
      method: 'POST',
      url: `/api/sessions/${joinCode}/join`,
      payload: { name: 'Alex' },
    });
    const joinedBody = joined.json<{
      credential: string;
      events: Array<{ kind: string; payload: { operationId?: string; options?: string[] } }>;
    }>();
    expect(hostCredential).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(joinedBody.credential).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const input = joinedBody.events.find((event) => event.kind === 'input.requested');
    expect(input).toBeDefined();

    const impersonation = await app.inject({
      method: 'POST',
      url: `/api/sessions/${joinCode}/commands`,
      headers: { authorization: `Bearer ${hostCredential}` },
      payload: {
        protocolVersion: 1,
        commandId: 'host-impersonation',
        kind: 'input.submit',
        operationId: input?.payload.operationId,
        choice: input?.payload.options?.[0],
      },
    });
    expect(impersonation.statusCode).toBe(400);
    expect(impersonation.json()).toMatchObject({ error: 'INPUT_FORBIDDEN' });

    const command = await app.inject({
      method: 'POST',
      url: `/api/sessions/${joinCode}/commands`,
      headers: { authorization: `Bearer ${joinedBody.credential}` },
      payload: {
        protocolVersion: 1,
        commandId: 'e2e-choice',
        kind: 'input.submit',
        operationId: input?.payload.operationId,
        choice: input?.payload.options?.[0],
      },
    });
    expect(command.statusCode).toBe(200);
    expect(command.json()).toMatchObject({ status: 'completed' });
  });

  it('rejects artifact content with a forged immutable identity', async () => {
    app = await buildServer();
    const artifact = publishDraft(sequentialDraft, 1);
    const response = await app.inject({
      method: 'POST',
      url: '/api/artifacts',
      payload: { ...artifact, contentHash: 'forged' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'ARTIFACT_HASH_MISMATCH' });
  });

  it('derives private projections from opaque credentials, never participant query input', async () => {
    app = await buildServer();
    await app.inject({ method: 'POST', url: '/api/artifacts', payload: referenceCardRound });
    const hosted = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { artifactId: referenceCardRound.artifactId, hostName: 'Host', seed: 1 },
    });
    const host = hosted.json<{ joinCode: string; credential: string }>();
    const joined = await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.joinCode}/join`,
      payload: { name: 'Alex' },
    });
    const guest = joined.json<{ credential: string }>();

    const hostView = await app.inject({
      method: 'GET',
      url: `/api/sessions/${host.joinCode}?participantId=p2`,
      headers: { authorization: `Bearer ${host.credential}` },
    });
    const guestView = await app.inject({
      method: 'GET',
      url: `/api/sessions/${host.joinCode}`,
      headers: { authorization: `Bearer ${guest.credential}` },
    });
    expect(hostView.statusCode).toBe(200);
    expect(JSON.stringify(hostView.json())).not.toContain('Your private card');
    expect(JSON.stringify(guestView.json())).toContain('Your private card');

    const unauthenticated = await app.inject({
      method: 'GET',
      url: `/api/sessions/${host.joinCode}`,
      headers: { authorization: 'Bearer guessed-participant-id' },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('does not expose trusted time or connectivity inputs on the command transport', async () => {
    app = await buildServer();
    const artifact = publishDraft(sequentialDraft, 1);
    await app.inject({ method: 'POST', url: '/api/artifacts', payload: artifact });
    const hosted = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { artifactId: artifact.artifactId, hostName: 'Host' },
    });
    const host = hosted.json<{ joinCode: string; credential: string }>();
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.joinCode}/join`,
      payload: { name: 'Alex' },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.joinCode}/commands`,
      headers: { authorization: `Bearer ${host.credential}` },
      payload: {
        protocolVersion: 1,
        commandId: 'spoof-time',
        kind: 'time.advance',
        milliseconds: 999_999,
      },
    });
    expect(response.statusCode).toBe(400);

    const lifecycle = await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.joinCode}/commands`,
      headers: { authorization: `Bearer ${host.credential}` },
      payload: {
        protocolVersion: 1,
        commandId: 'spoof-disconnect',
        kind: 'participant.disconnected',
        participantId: 'p2',
      },
    });
    expect(lifecycle.statusCode).toBe(400);
  });
});
