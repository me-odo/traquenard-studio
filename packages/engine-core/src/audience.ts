import type { Audience, Value } from '@traquenard/game-ir';
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
    case 'participants':
      return {
        kind: audience.kind,
        participantIds: asCollection(evaluate(audience.ids, state, locals, scopeId)).map(String),
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
  }
}
