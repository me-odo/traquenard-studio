import { describe, expect, it } from 'vitest';
import {
  referenceCardRound,
  referenceGroupVote,
  referenceSequential,
} from '../../game-simulator/src/reference-games.js';
import {
  applyClientCommand,
  applySystemInput,
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
  semanticSeed: 'test-seed:1',
});

describe('authoritative sessions', () => {
  it('pauses globally, freezes timers, and resumes after reconnect', () => {
    let session = createSession(options(referenceCardRound));
    expect(session.engine.pending['round-timer']).toBeDefined();
    session = applySystemInput(session, {
      inputId: 'd1',
      kind: 'participant.disconnected',
      participantId: 'p2',
    });
    expect(session.status).toBe('paused');
    expect(() =>
      applySystemInput(session, {
        inputId: 't1',
        kind: 'time.advance',
        milliseconds: 9999,
      }),
    ).toThrow('frozen');
    expect(session.engine.logicalTime).toBe(0);
    session = applySystemInput(session, {
      inputId: 'r1',
      kind: 'participant.reconnected',
      participantId: 'p2',
    });
    expect(session.status).toBe('running');
    session = applySystemInput(session, {
      inputId: 't2',
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
      operationId: wait.operationId,
      choice: wait.options[0]!,
    };
    const once = applyClientCommand(initial, wait.participantId, command);
    expect(applyClientCommand(once, wait.participantId, command)).toBe(once);
    expect(
      replaySession(options(), [{ source: 'client', participantId: wait.participantId, command }]),
    ).toEqual(once);
  });

  it('deduplicates client and system inputs in separate typed namespaces', () => {
    const initial = createSession(options(referenceGroupVote));
    const systemInput = {
      inputId: 'shared-raw-id',
      kind: 'time.advance' as const,
      milliseconds: 25,
    };
    const afterSystem = applySystemInput(initial, systemInput);
    expect(applySystemInput(afterSystem, systemInput)).toBe(afterSystem);

    const wait = Object.values(afterSystem.engine.pending).find(
      (pending) => pending.kind === 'input' && pending.participantId === 'p1',
    );
    if (!wait || wait.kind !== 'input') throw new Error('Expected p1 input');
    const clientCommand = {
      protocolVersion: 1 as const,
      commandId: 'shared-raw-id',
      kind: 'input.submit' as const,
      operationId: wait.operationId,
      choice: wait.options[0]!,
    };
    const afterClient = applyClientCommand(afterSystem, 'p1', clientCommand);
    expect(applyClientCommand(afterClient, 'p1', clientCommand)).toBe(afterClient);
    expect(afterClient.processedInputs).toEqual([
      expect.objectContaining({
        source: 'system',
        inputKind: 'time.advance',
        inputId: 'shared-raw-id',
      }),
      expect.objectContaining({
        source: 'client',
        participantId: 'p1',
        commandId: 'shared-raw-id',
      }),
    ]);
    expect(replaySession(options(referenceGroupVote), afterClient.inputHistory)).toEqual(
      afterClient,
    );
  });

  it('rejects client and system idempotency keys reused with different payloads', () => {
    const initial = createSession(options(referenceGroupVote));
    const wait = Object.values(initial.engine.pending).find(
      (pending) => pending.kind === 'input' && pending.participantId === 'p1',
    );
    if (!wait || wait.kind !== 'input') throw new Error('Expected p1 input');
    const firstCommand = {
      protocolVersion: 1 as const,
      commandId: 'client-conflict',
      kind: 'input.submit' as const,
      operationId: wait.operationId,
      choice: wait.options[0]!,
    };
    const afterClient = applyClientCommand(initial, 'p1', firstCommand);
    expect(() =>
      applyClientCommand(afterClient, 'p1', {
        ...firstCommand,
        choice: wait.options[1]!,
      }),
    ).toThrow('different semantic payload');

    const firstTime = {
      inputId: 'system-conflict',
      kind: 'time.advance' as const,
      milliseconds: 1,
    };
    const afterSystem = applySystemInput(initial, firstTime);
    expect(() => applySystemInput(afterSystem, { ...firstTime, milliseconds: 2 })).toThrow(
      'different semantic payload',
    );
  });

  it('keeps replay secrets private while exact internal replay remains deterministic', () => {
    const initial = createSession(options(referenceCardRound));
    const internalCreation = initial.eventLog.find(
      (event) => event.payload.kind === 'session.created',
    );
    expect(internalCreation?.payload).toMatchObject({
      kind: 'session.created',
      semanticSeed: 'test-seed:1',
    });
    for (const participant of participants) {
      const projection = JSON.stringify(projectEvents(initial, participant.id));
      expect(projection).not.toContain('test-seed:1');
      expect(projection).not.toContain('semanticSeed');
      expect(projection).not.toContain('rngState');
    }

    const completed = applySystemInput(initial, {
      inputId: 'finish-timer',
      kind: 'time.advance',
      milliseconds: 3000,
    });
    expect(replaySession(options(referenceCardRound), completed.inputHistory)).toEqual(completed);
  });

  it('copies caller-owned artifacts and participants at the session boundary', () => {
    const mutableArtifact = structuredClone(referenceSequential);
    const mutableParticipants = participants.map((participant) => ({ ...participant }));
    const session = createSession({
      ...options(mutableArtifact),
      participants: mutableParticipants,
    });
    mutableParticipants[0]!.id = 'mutated';
    (mutableArtifact.definition as { title: string }).title = 'Mutated';
    expect(session.engine.participants[0]!.id).toBe('p1');
    expect(session.engine.artifact.definition.title).toBe(referenceSequential.definition.title);
    expect(Object.isFrozen(session.engine.artifact)).toBe(true);
  });

  it('copies caller-owned inputs before retaining replay history', () => {
    const initial = createSession(options(referenceGroupVote));
    const wait = Object.values(initial.engine.pending).find(
      (pending) => pending.kind === 'input' && pending.participantId === 'p1',
    );
    if (!wait || wait.kind !== 'input') throw new Error('Expected p1 input');
    const command = {
      protocolVersion: 1 as const,
      commandId: 'owned-command',
      kind: 'input.submit' as const,
      operationId: wait.operationId,
      choice: wait.options[0]!,
    };
    const afterCommand = applyClientCommand(initial, 'p1', command);
    command.choice = wait.options[1]!;
    expect(afterCommand.inputHistory[0]).toMatchObject({
      source: 'client',
      command: { choice: wait.options[0] },
    });

    const systemInput = {
      inputId: 'owned-system-input',
      kind: 'time.advance' as const,
      milliseconds: 1,
    };
    const afterSystem = applySystemInput(initial, systemInput);
    systemInput.milliseconds = 2;
    expect(afterSystem.inputHistory[0]).toMatchObject({
      source: 'system',
      input: { milliseconds: 1 },
    });
  });

  it('rejects forged artifact identity before runtime execution', () => {
    expect(() =>
      createSession({
        ...options(),
        artifact: { ...referenceSequential, contentHash: 'sha256-forged' },
      }),
    ).toThrow(expect.objectContaining({ code: 'ARTIFACT_HASH_MISMATCH' }));
    expect(() =>
      createSession({
        ...options(),
        artifact: { ...referenceSequential, artifactId: 'forged' },
      }),
    ).toThrow(expect.objectContaining({ code: 'ARTIFACT_HASH_MISMATCH' }));
  });
});
