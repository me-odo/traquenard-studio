import { describe, expect, it } from 'vitest';
import {
  referenceCardRound,
  referenceGroupVote,
  referenceSequential,
} from '../../game-simulator/src/reference-games.js';
import {
  applyCommand,
  createSession,
  projectEvents,
  replaySession,
  type Participant,
} from './index.js';

const participants: readonly Participant[] = [
  { id: 'p1', name: 'Host', isHost: true, required: true },
  { id: 'p2', name: 'Alex', isHost: false, required: true },
  { id: 'p3', name: 'Sam', isHost: false, required: true },
];

const options = (artifact = referenceSequential) => ({
  sessionId: 's1',
  joinCode: 'ABC123',
  artifact,
  participants,
  seed: 1,
});

describe('authoritative sessions', () => {
  it('pauses globally, freezes timers, and resumes after reconnect', () => {
    let session = createSession(options(referenceCardRound));
    expect(session.engine.pending['round-timer']).toBeDefined();
    session = applyCommand(session, {
      protocolVersion: 1,
      commandId: 'd1',
      kind: 'participant.disconnected',
      participantId: 'p2',
    });
    expect(session.status).toBe('paused');
    expect(() =>
      applyCommand(session, {
        protocolVersion: 1,
        commandId: 't1',
        kind: 'time.advance',
        milliseconds: 9999,
      }),
    ).toThrow('frozen');
    expect(session.engine.logicalTime).toBe(0);
    session = applyCommand(session, {
      protocolVersion: 1,
      commandId: 'r1',
      kind: 'participant.reconnected',
      participantId: 'p2',
    });
    expect(session.status).toBe('running');
    session = applyCommand(session, {
      protocolVersion: 1,
      commandId: 't2',
      kind: 'time.advance',
      milliseconds: 3000,
    });
    expect(session.status).toBe('completed');
  });

  it('does not leak private prompts or card presentation to another participant', () => {
    const vote = createSession(options(referenceGroupVote));
    const p1 = projectEvents(vote, 'p1');
    expect(p1.filter((event) => event.kind === 'input.requested')).toHaveLength(1);
    expect(JSON.stringify(p1)).not.toContain('vote-p2');

    const cards = createSession(options(referenceCardRound));
    expect(JSON.stringify(projectEvents(cards, 'p1'))).not.toContain('Your private card');
    expect(JSON.stringify(projectEvents(cards, 'p2'))).toContain('Your private card');
    expect(JSON.stringify(projectEvents(cards, 'p1'))).not.toContain('handCard');
  });

  it('treats retried command ids idempotently and replays exactly', () => {
    const initial = createSession(options());
    const wait = Object.values(initial.engine.pending)[0]!;
    if (wait.kind !== 'input') throw new Error('Expected input');
    const command = {
      protocolVersion: 1 as const,
      commandId: 'once',
      kind: 'input.submit' as const,
      participantId: wait.participantId,
      operationId: wait.operationId,
      choice: wait.options[0]!,
    };
    const once = applyCommand(initial, command);
    expect(applyCommand(once, command)).toBe(once);
    expect(replaySession(options(), [command])).toEqual(once);
  });
});
