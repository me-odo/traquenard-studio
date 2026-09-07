import { describe, expect, it } from 'vitest';
import { projectEvents } from '@traquenard/engine-runtime';
import {
  referenceArtifacts,
  referenceCardRound,
  referenceGroupVote,
  referenceSequential,
  simulateGame,
} from './index.js';

describe('canonical reference games', () => {
  it.each(referenceArtifacts.map((artifact) => [artifact.definition.title, artifact] as const))(
    'executes %s to a terminal state',
    (_title, artifact) => {
      const result = simulateGame(artifact, 1);
      expect(result.session.status).toBe('completed');
      expect(result.session.eventLog.at(-1)?.payload.kind).toBe('execution.completed');
    },
  );

  it('preserves the sequential selection, audience, input owner, and Composite return', () => {
    const result = simulateGame(referenceSequential, 1);
    expect(result.session.engine.variables).toMatchObject({
      selectedPlayer: 'p1',
      answer: 'Mime',
    });
    const privatePresentation = result.session.eventLog.find(
      (event) =>
        event.payload.kind === 'presentation.emitted' &&
        event.payload.operationId === 'turn-private',
    );
    const input = result.session.eventLog.find(
      (event) =>
        event.payload.kind === 'input.requested' && event.payload.operationId === 'turn-input',
    );
    expect(privatePresentation?.payload).toMatchObject({
      audience: { participantIds: ['p1'] },
    });
    expect(input?.payload).toMatchObject({ participantId: 'p1' });
    expect(JSON.stringify(projectEvents(result.session, 'p1'))).toContain('You were selected.');
    expect(JSON.stringify(projectEvents(result.session, 'p2'))).not.toContain('You were selected.');
  });

  it('keeps group-vote waits independent and joins all before continuation', () => {
    const result = simulateGame(referenceGroupVote, 1);
    const requests = result.session.eventLog.filter(
      (event) => event.payload.kind === 'input.requested',
    );
    expect(requests).toHaveLength(3);
    expect(
      requests.map((event) =>
        event.payload.kind === 'input.requested'
          ? [
              event.payload.operationId,
              event.payload.participantId,
              event.payload.audience.participantIds,
            ]
          : [],
      ),
    ).toEqual([
      ['vote-p1', 'p1', ['p1']],
      ['vote-p2', 'p2', ['p2']],
      ['vote-p3', 'p3', ['p3']],
    ]);
    expect(result.session.engine.variables).toMatchObject({
      vote1: 'Forest',
      vote2: 'Forest',
      vote3: 'Forest',
    });
    const completionIndex = result.session.eventLog.findIndex(
      (event) =>
        event.payload.kind === 'presentation.emitted' &&
        event.payload.operationId === 'vote-complete',
    );
    const acceptedIndexes = result.session.eventLog
      .map((event, index) => (event.payload.kind === 'input.accepted' ? index : -1))
      .filter((index) => index >= 0);
    expect(acceptedIndexes).toHaveLength(3);
    expect(completionIndex).toBeGreaterThan(Math.max(...acceptedIndexes));
  });

  it('keeps card shuffle, draw, and timer semantics deterministic for an internal seed', () => {
    const first = simulateGame(referenceCardRound, 1);
    const second = simulateGame(referenceCardRound, 1);
    expect(first.session.engine.variables).toEqual(second.session.engine.variables);
    expect(first.session.engine.variables.handCard).toMatchObject({ id: 'diamonds-q' });
    expect(first.trace).toEqual(['time:+3000']);
    expect(first.session.engine.logicalTime).toBe(3000);
  });
});
