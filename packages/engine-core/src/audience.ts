import type { Audience, Value } from '@traquenard/game-ir';
import { EngineError } from './errors.js';
import { evaluate, asCollection } from './evaluator.js';
import type { EngineState, ResolvedAudience } from './types.js';

export function resolveAudience(
  audience: Audience,
  state: EngineState,
  locals: Readonly<Record<string, Value>>,
  scopeId?: string,
): ResolvedAudience {
  const all = state.participants.map((item) => item.id);
  switch (audience.kind) {
    case 'everyone':
      return { kind: audience.kind, participantIds: all };
    case 'host':
      return {
        kind: audience.kind,
        participantIds: state.participants.filter((item) => item.isHost).map((item) => item.id),
      };
    case 'participant':
      return {
        kind: audience.kind,
        participantIds: [
          requireParticipantId(evaluate(audience.id, state, locals, scopeId), state),
        ],
      };
    case 'participants':
      return {
        kind: audience.kind,
        participantIds: asCollection(evaluate(audience.ids, state, locals, scopeId)).map((id) =>
          requireParticipantId(id, state),
        ),
      };
    case 'team':
      return {
        kind: audience.kind,
        participantIds: state.participants
          .filter((item) => item.teamId === audience.teamId)
          .map((item) => item.id),
      };
    case 'role':
      return {
        kind: audience.kind,
        participantIds: state.participants
          .filter((item) => item.roleId === audience.roleId)
          .map((item) => item.id),
      };
    default:
      return assertNever(audience);
  }
}

function requireParticipantId(value: Value, state: EngineState): string {
  if (
    typeof value !== 'string' ||
    !state.participants.some((participant) => participant.id === value)
  )
    throw new EngineError('UNKNOWN_PARTICIPANT', 'Audience target is not a session participant.');
  return value;
}

function assertNever(value: never): never {
  throw new EngineError('INVALID_ARTIFACT', `Unhandled audience: ${JSON.stringify(value)}`);
}
