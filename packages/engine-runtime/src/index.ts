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

export type ExternalCommand =
  | {
      readonly protocolVersion: 1;
      readonly commandId: string;
      readonly kind: 'input.submit';
      readonly participantId: ParticipantId;
      readonly operationId: string;
      readonly choice: string;
    }
  | {
      readonly protocolVersion: 1;
      readonly commandId: string;
      readonly kind: 'time.advance';
      readonly milliseconds: number;
    }
  | {
      readonly protocolVersion: 1;
      readonly commandId: string;
      readonly kind: 'participant.disconnected';
      readonly participantId: ParticipantId;
    }
  | {
      readonly protocolVersion: 1;
      readonly commandId: string;
      readonly kind: 'participant.reconnected';
      readonly participantId: ParticipantId;
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
  readonly processedCommandIds: readonly string[];
  readonly commandHistory: readonly ExternalCommand[];
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
    processedCommandIds: [],
    commandHistory: [],
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

export function applyCommand(session: SessionState, command: ExternalCommand): SessionState {
  if (session.processedCommandIds.includes(command.commandId)) return session;
  if (session.status === 'completed')
    throw new EngineError('SESSION_COMPLETED', 'The session is already complete.');
  if (
    session.status === 'paused' &&
    command.kind !== 'participant.reconnected' &&
    command.kind !== 'participant.disconnected'
  )
    throw new EngineError(
      'SESSION_PAUSED',
      'Gameplay and logical time are frozen while the session is paused.',
    );

  let next: SessionState = {
    ...session,
    processedCommandIds: [...session.processedCommandIds, command.commandId],
    commandHistory: [...session.commandHistory, command],
  };
  switch (command.kind) {
    case 'input.submit':
      next = {
        ...next,
        engine: acceptInput(
          next.engine,
          command.operationId,
          command.participantId,
          command.choice,
        ),
      };
      next = append(next, {
        kind: 'input.accepted',
        operationId: command.operationId,
        participantId: command.participantId,
        choice: command.choice,
      });
      return advanceAndAppend(next);
    case 'time.advance':
      next = { ...next, engine: advanceLogicalTime(next.engine, command.milliseconds) };
      next = append(next, { kind: 'time.advanced', milliseconds: command.milliseconds });
      return advanceAndAppend(next);
    case 'participant.disconnected': {
      if (!next.engine.participants.some((item) => item.id === command.participantId))
        throw new EngineError('UNKNOWN_PARTICIPANT', 'Participant is not part of this session.');
      const connected = next.connectedParticipantIds.filter((id) => id !== command.participantId);
      next = append(
        { ...next, connectedParticipantIds: connected },
        { kind: 'participant.disconnected', participantId: command.participantId },
      );
      const participant = next.engine.participants.find(
        (item) => item.id === command.participantId,
      )!;
      return participant.required && next.status === 'running'
        ? append(
            { ...next, status: 'paused' },
            { kind: 'session.paused', disconnectedParticipantId: command.participantId },
          )
        : next;
    }
    case 'participant.reconnected': {
      if (!next.engine.participants.some((item) => item.id === command.participantId))
        throw new EngineError('UNKNOWN_PARTICIPANT', 'Participant is not part of this session.');
      const connected = next.connectedParticipantIds.includes(command.participantId)
        ? next.connectedParticipantIds
        : [...next.connectedParticipantIds, command.participantId];
      next = append(
        { ...next, connectedParticipantIds: connected },
        { kind: 'participant.connected', participantId: command.participantId },
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
  commands: readonly ExternalCommand[],
): SessionState {
  return commands.reduce(applyCommand, createSession(options));
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
