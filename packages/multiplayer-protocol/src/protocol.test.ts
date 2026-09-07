import { describe, expect, it } from 'vitest';
import { ClientCommandSchema, CreateSessionSchema } from './index.js';

describe('public client commands', () => {
  it.each(['time.advance', 'participant.disconnected', 'participant.reconnected'])(
    'rejects the trusted system input %s',
    (kind) => {
      expect(
        ClientCommandSchema.safeParse({
          protocolVersion: 1,
          commandId: 'spoof',
          kind,
          participantId: 'p2',
          milliseconds: 1_000_000,
        }).success,
      ).toBe(false);
    },
  );

  it('rejects caller-supplied participant identity', () => {
    expect(
      ClientCommandSchema.safeParse({
        protocolVersion: 1,
        commandId: 'intent',
        kind: 'input.submit',
        participantId: 'p2',
        operationId: 'ask',
        choice: 'A',
      }).success,
    ).toBe(false);
  });

  it('rejects semantic seed selection and unknown fields during public session creation', () => {
    expect(
      CreateSessionSchema.safeParse({
        artifactId: 'artifact',
        hostName: 'Host',
        seed: 7,
      }).success,
    ).toBe(false);
    expect(
      CreateSessionSchema.safeParse({
        artifactId: 'artifact',
        hostName: 'Host',
        semanticSeed: 'chosen-by-client',
      }).success,
    ).toBe(false);
  });
});
