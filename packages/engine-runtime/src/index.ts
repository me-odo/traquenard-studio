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
import { contentHash, type GameArtifact, type ParticipantId } from '@traquenard/game-ir';
import { acceptArtifact } from '@traquenard/game-validator';

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
      readonly payloadHash: string;
    }
  | {
      readonly source: 'system';
      readonly inputKind: SystemInput['kind'];
      readonly inputId: string;
      readonly payloadHash: string;
    };

export type RuntimeEventPayload =
  | SemanticEvent
  | {
      readonly kind: 'session.created';
      readonly artifactId: string;
      readonly semanticSeed: string;
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

export interface InternalSessionOptions {
  readonly sessionId: string;
  readonly joinCode: string;
  readonly artifact: GameArtifact;
  readonly participants: readonly Participant[];
  /** Server-private replay material. Public transports must never accept or project it. */
  readonly semanticSeed: string;
}

export function createSession(options: InternalSessionOptions): SessionState {
  const artifact = acceptArtifact(options.artifact);
  const participants = Object.freeze(
    options.participants.map((participant) => Object.freeze({ ...participant })),
  );
  const base: SessionState = {
    sessionId: options.sessionId,
    joinCode: options.joinCode,
    status: 'running',
    engine: createEngineState(artifact, participants, options.semanticSeed),
    connectedParticipantIds: participants.map((item) => item.id),
    processedInputs: [],
    inputHistory: [],
    eventLog: [],
  };
  return advanceAndAppend(
    append(base, {
      kind: 'session.created',
      artifactId: artifact.artifactId,
      semanticSeed: options.semanticSeed,
      participantIds: participants.map((item) => item.id),
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
    payloadHash: contentHash(command),
  };
  if (assertIdempotency(session, processedKey)) return session;
  assertCanAdvance(session);
  if (session.status === 'paused')
    throw new EngineError('SESSION_PAUSED', 'Gameplay is frozen while the session is paused.');
  let next = record(session, processedKey, {
    source: 'client',
    participantId: authenticatedParticipantId,
    command: Object.freeze({ ...command }),
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
    payloadHash: contentHash(input),
  };
  if (assertIdempotency(session, processedKey)) return session;
  assertCanAdvance(session);
  if (session.status === 'paused' && input.kind === 'time.advance')
    throw new EngineError('SESSION_PAUSED', 'Logical time is frozen while the session is paused.');
  let next = record(session, processedKey, {
    source: 'system',
    input: Object.freeze({ ...input }),
  });
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
    default:
      return assertNever(input);
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
  return session.eventLog.flatMap((event): ClientEvent[] => {
    const payload = event.payload;
    switch (payload.kind) {
      case 'session.created':
        return [
          project(event, payload.kind, {
            kind: payload.kind,
            artifactId: payload.artifactId,
            participantIds: [...payload.participantIds],
          }),
        ];
      case 'presentation.emitted':
        return payload.audience.participantIds.includes(viewerId)
          ? [
              project(event, payload.kind, {
                kind: payload.kind,
                operationId: payload.operationId,
                message: payload.message,
                privacy: payload.privacy,
              }),
            ]
          : [];
      case 'input.requested':
        return payload.audience.participantIds.includes(viewerId)
          ? [
              project(event, payload.kind, {
                kind: payload.kind,
                operationId: payload.operationId,
                participantId: payload.participantId,
                prompt: payload.prompt,
                options: [...payload.options],
              }),
            ]
          : [];
      case 'session.paused':
        return [
          project(event, payload.kind, {
            kind: payload.kind,
            disconnectedParticipantId: payload.disconnectedParticipantId,
          }),
        ];
      case 'participant.connected':
      case 'participant.disconnected':
        return [
          project(event, payload.kind, {
            kind: payload.kind,
            participantId: payload.participantId,
          }),
        ];
      case 'execution.completed':
        return [
          project(event, payload.kind, {
            kind: payload.kind,
            operationId: payload.operationId,
          }),
        ];
      case 'session.resumed':
        return [project(event, payload.kind, { kind: payload.kind })];
      case 'random.selected':
      case 'collection.shuffled':
      case 'collection.drawn':
      case 'input.accepted':
      case 'time.advanced':
      case 'timer.scheduled':
        return [];
      default:
        return assertNever(payload);
    }
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

function assertIdempotency(session: SessionState, candidate: ProcessedInputKey): boolean {
  const processed = session.processedInputs.find((item) => {
    if (item.source !== candidate.source) return false;
    return item.source === 'client' && candidate.source === 'client'
      ? item.participantId === candidate.participantId && item.commandId === candidate.commandId
      : item.source === 'system' &&
          candidate.source === 'system' &&
          item.inputKind === candidate.inputKind &&
          item.inputId === candidate.inputId;
  });
  if (!processed) return false;
  if (processed.payloadHash !== candidate.payloadHash)
    throw new EngineError(
      'IDEMPOTENCY_CONFLICT',
      'An idempotency key was reused with a different semantic payload.',
    );
  return true;
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

function project(
  event: RuntimeEvent,
  kind: RuntimeEventPayload['kind'],
  payload: Readonly<Record<string, unknown>>,
): ClientEvent {
  return { sequence: event.sequence, logicalTime: event.logicalTime, kind, payload };
}

function assertNever(value: never): never {
  throw new EngineError('INVALID_ARTIFACT', `Unhandled runtime variant: ${JSON.stringify(value)}`);
}

export type { Participant } from '@traquenard/engine-core';
export { EngineError } from '@traquenard/engine-core';
