import { afterEach, describe, expect, it } from 'vitest';
import { publishDraft, sequentialDraft } from '@traquenard/authoring-domain';
import { buildServer } from '../apps/server/src/index.js';

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
    const { joinCode } = hosted.json<{ joinCode: string }>();

    const joined = await app.inject({
      method: 'POST',
      url: `/api/sessions/${joinCode}/join`,
      payload: { name: 'Alex' },
    });
    const joinedBody = joined.json<{
      events: Array<{ kind: string; payload: { operationId?: string; options?: string[] } }>;
    }>();
    const input = joinedBody.events.find((event) => event.kind === 'input.requested');
    expect(input).toBeDefined();

    const command = await app.inject({
      method: 'POST',
      url: `/api/sessions/${joinCode}/commands`,
      payload: {
        protocolVersion: 1,
        commandId: 'e2e-choice',
        kind: 'input.submit',
        participantId: 'p2',
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
});
