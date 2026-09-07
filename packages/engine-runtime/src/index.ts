import {
  EngineError,
  acceptInput,
  advanceExecution,
  advanceLogicalTime,
  createEngineState,
  type EngineState,
  type Participant,
  type SemanticEvent,
} from '@traquenard/engine-core';
import type { GameArtifact, ParticipantId } from '@traquenard/game-ir';
import { validateArtifact } from '@traquenard/game-validator';

export interface ClientCommand {
  readonly protocolVersion: 1;
  readonly commandId: string;
  readonly kind: 'input.submit';
  readonly operationId: string;
  readonly choice: string;
}

export type SystemInput =
  | { readonly inputId: string; readonly kind: 'time.advance'; readonly milliseconds: number }
  | {
      readonly inputId: string;
      readonly kind: 'participant.disconnected';
      readonly participantId: ParticipantId;
    }
  | {
      readonly inputId: string;
      readonly kind: 'participant.reconnected';
      readonly participantId: ParticipantId;
    };

export type RecordedInput =
  | {
      readonly source: 'client';
      readonly participantId: ParticipantId;
      readonly command: ClientCommand;
    }
  | { readonly source: 'system'; readonly input: SystemInput };

export type ProcessedInputKey =
  | {
      readonly source: 'client';
      readonly participantId: ParticipantId;
      readonly commandId: string;
    }
  | {
      readonly source: 'system';
      readonly inputKind: SystemInput['kind'];
      readonly inputId: string;
    };

export type RuntimeEventPayload =
  | SemanticEvent
  | {
      readonly kind: 'session.created';
      readonly artifactId: string;
      readonly seed: number;
      readonly participantIds: readonly string[];
    }
  | {
      readonly kind: 'input.accepted';
      readonly operationId: string;
      readonly participantId: string;
      readonly choice: string;
    }
  | { readonly kind: 'time.advanced'; readonly milliseconds: number }
  | { readonly kind: 'session.paused'; readonly disconnectedParticipantId: string }
  | { readonly kind: 'session.resumed' }
  | { readonly kind: 'participant.connected'; readonly participantId: string }
  | { readonly kind: 'participant.disconnected'; readonly participantId: string };

export interface RuntimeEvent {
  readonly sequence: number;
  readonly logicalTime: number;
  readonly payload: RuntimeEventPayload;
}

export interface SessionState {
  readonly sessionId: string;
  readonly joinCode: string;
  readonly status: 'running' | 'paused' | 'completed';
  readonly engine: EngineState;
  readonly connectedParticipantIds: readonly ParticipantId[];
  readonly processedInputs: readonly ProcessedInputKey[];
  readonly inputHistory: readonly RecordedInput[];
  readonly eventLog: readonly RuntimeEvent[];
}

export interface ClientEvent {
  readonly sequence: number;
  readonly logicalTime: number;
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function createSession(options: {
  readonly sessionId: string;
  readonly joinCode: string;
  readonly artifact: GameArtifact;
  readonly participants: readonly Participant[];
  readonly seed: number;
}): SessionState {
  const validation = validateArtifact(options.artifact);
  if (!validation.valid)
    throw new EngineError(
      'INVALID_ARTIFACT',
      validation.issues.map((item) => item.message).join(' '),
    );
  const base: SessionState = {
    sessionId: options.sessionId,
    joinCode: options.joinCode,
    status: 'running',
    engine: createEngineState(options.artifact, options.participants, options.seed),
    connectedParticipantIds: options.participants.map((item) => item.id),
    processedInputs: [],
    inputHistory: [],
    eventLog: [],
  };
  return advanceAndAppend(
    append(base, {
      kind: 'session.created',
      artifactId: options.artifact.artifactId,
      seed: options.seed,
      participantIds: options.participants.map((item) => item.id),
    }),
  );
}

export function applyClientCommand(
  session: SessionState,
  authenticatedParticipantId: ParticipantId,
  command: ClientCommand,
): SessionState {
  if (!session.engine.participants.some((item) => item.id === authenticatedParticipantId))
    throw new EngineError(
      'UNKNOWN_PARTICIPANT',
      'Authenticated participant is not part of this session.',
    );
  const processedKey: ProcessedInputKey = {
    source: 'client',
    participantId: authenticatedParticipantId,
    commandId: command.commandId,
  };
  if (wasProcessed(session, processedKey)) return session;
  assertCanAdvance(session);
  if (session.status === 'paused')
    throw new EngineError('SESSION_PAUSED', 'Gameplay is frozen while the session is paused.');
  let next = record(session, processedKey, {
    source: 'client',
    participantId: authenticatedParticipantId,
    command,
  });
  next = {
    ...next,
    engine: acceptInput(
      next.engine,
      command.operationId,
      authenticatedParticipantId,
      command.choice,
    ),
  };
  next = append(next, {
    kind: 'input.accepted',
    operationId: command.operationId,
    participantId: authenticatedParticipantId,
    choice: command.choice,
  });
  return advanceAndAppend(next);
}

export function applySystemInput(session: SessionState, input: SystemInput): SessionState {
  const processedKey: ProcessedInputKey = {
    source: 'system',
    inputKind: input.kind,
    inputId: input.inputId,
  };
  if (wasProcessed(session, processedKey)) return session;
  assertCanAdvance(session);
  if (session.status === 'paused' && input.kind === 'time.advance')
    throw new EngineError('SESSION_PAUSED', 'Logical time is frozen while the session is paused.');
  let next = record(session, processedKey, { source: 'system', input });
  switch (input.kind) {
    case 'time.advance':
      next = { ...next, engine: advanceLogicalTime(next.engine, input.milliseconds) };
      return advanceAndAppend(
        append(next, { kind: 'time.advanced', milliseconds: input.milliseconds }),
      );
    case 'participant.disconnected': {
      const participant = participantFor(next, input.participantId);
      const connected = next.connectedParticipantIds.filter((id) => id !== input.participantId);
      next = append(
        { ...next, connectedParticipantIds: connected },
        { kind: 'participant.disconnected', participantId: input.participantId },
      );
      return participant.required && next.status === 'running'
        ? append(
            { ...next, status: 'paused' },
            { kind: 'session.paused', disconnectedParticipantId: input.participantId },
          )
        : next;
    }
    case 'participant.reconnected': {
      participantFor(next, input.participantId);
      const connected = next.connectedParticipantIds.includes(input.participantId)
        ? next.connectedParticipantIds
        : [...next.connectedParticipantIds, input.participantId];
      next = append(
        { ...next, connectedParticipantIds: connected },
        { kind: 'participant.connected', participantId: input.participantId },
      );
      const allRequiredConnected = next.engine.participants
        .filter((item) => item.required)
        .every((item) => connected.includes(item.id));
      return next.status === 'paused' && allRequiredConnected
        ? advanceAndAppend(append({ ...next, status: 'running' }, { kind: 'session.resumed' }))
        : next;
    }
  }
}

export function replaySession(
  options: Parameters<typeof createSession>[0],
  inputs: readonly RecordedInput[],
): SessionState {
  return inputs.reduce(
    (session, input) =>
      input.source === 'client'
        ? applyClientCommand(session, input.participantId, input.command)
        : applySystemInput(session, input.input),
    createSession(options),
  );
}

export function projectEvents(
  session: SessionState,
  viewerId: ParticipantId,
): readonly ClientEvent[] {
  if (!session.engine.participants.some((participant) => participant.id === viewerId)) return [];
  const publicKinds = new Set([
    'session.created',
    'session.paused',
    'session.resumed',
    'participant.connected',
    'participant.disconnected',
    'execution.completed',
  ]);
  return session.eventLog.flatMap((event): ClientEvent[] => {
    const payload = event.payload;
    if (payload.kind === 'presentation.emitted' || payload.kind === 'input.requested') {
      if (!payload.audience.participantIds.includes(viewerId)) return [];
      const { audience, ...visible } = payload;
      void audience;
      return [
        {
          sequence: event.sequence,
          logicalTime: event.logicalTime,
          kind: payload.kind,
          payload: visible,
        },
      ];
    }
    if (!publicKinds.has(payload.kind)) return [];
    return [
      {
        sequence: event.sequence,
        logicalTime: event.logicalTime,
        kind: payload.kind,
        payload: { ...payload },
      },
    ];
  });
}

function assertCanAdvance(session: SessionState): void {
  if (session.status === 'completed')
    throw new EngineError('SESSION_COMPLETED', 'The session is already complete.');
}

function participantFor(session: SessionState, participantId: ParticipantId): Participant {
  const participant = session.engine.participants.find((item) => item.id === participantId);
  if (!participant)
    throw new EngineError('UNKNOWN_PARTICIPANT', 'Participant is not part of this session.');
  return participant;
}

function wasProcessed(session: SessionState, candidate: ProcessedInputKey): boolean {
  return session.processedInputs.some((processed) => {
    if (processed.source !== candidate.source) return false;
    return processed.source === 'client' && candidate.source === 'client'
      ? processed.participantId === candidate.participantId &&
          processed.commandId === candidate.commandId
      : processed.source === 'system' &&
          candidate.source === 'system' &&
          processed.inputKind === candidate.inputKind &&
          processed.inputId === candidate.inputId;
  });
}

function record(
  session: SessionState,
  processedKey: ProcessedInputKey,
  input: RecordedInput,
): SessionState {
  return {
    ...session,
    processedInputs: [...session.processedInputs, processedKey],
    inputHistory: [...session.inputHistory, input],
  };
}

function advanceAndAppend(session: SessionState): SessionState {
  if (session.status !== 'running') return session;
  const advanced = advanceExecution(session.engine);
  let next = { ...session, engine: advanced.state };
  for (const event of advanced.events) next = append(next, event);
  if (next.engine.completed) next = { ...next, status: 'completed' };
  return next;
}

function append(session: SessionState, payload: RuntimeEventPayload): SessionState {
  const event: RuntimeEvent = {
    sequence: session.eventLog.length + 1,
    logicalTime: session.engine.logicalTime,
    payload,
  };
  return { ...session, eventLog: [...session.eventLog, event] };
}

export type { Participant } from '@traquenard/engine-core';
export { EngineError } from '@traquenard/engine-core';
