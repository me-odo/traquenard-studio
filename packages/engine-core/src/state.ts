import type { GameArtifact, TypeRef, Value } from '@traquenard/game-ir';
import { EngineError } from './errors.js';
import { normalizeSeed } from './rng.js';
import type { EngineState, Participant } from './types.js';

export function createEngineState(
  artifact: GameArtifact,
  participants: readonly Participant[],
  seed: number,
): EngineState {
  const variables = Object.fromEntries(
    artifact.definition.variables.map((item) => [
      item.name,
      item.initial ?? defaultValue(item.type),
    ]),
  );
  return {
    artifact,
    participants,
    variables,
    scopes: {},
    nextScopeId: 1,
    frames: [{ kind: 'operation', operation: artifact.definition.root, locals: {} }],
    pending: {},
    rngState: normalizeSeed(seed),
    logicalTime: 0,
    completed: false,
  };
}

export function readVariable(
  state: EngineState,
  name: string,
  scopeId?: string,
): Value | undefined {
  if (!scopeId) return state.variables[name];
  const scope = state.scopes[scopeId];
  if (!scope) throw new EngineError('UNKNOWN_SCOPE', `Unknown composite scope '${scopeId}'.`);
  return scope[name];
}

export function setVariable(
  state: EngineState,
  name: string,
  value: Value,
  scopeId?: string,
): EngineState {
  if (scopeId) {
    const scope = state.scopes[scopeId];
    if (!scope) throw new EngineError('UNKNOWN_SCOPE', `Unknown composite scope '${scopeId}'.`);
    if (!(name in scope))
      throw new EngineError(
        'UNKNOWN_VARIABLE',
        `Unknown variable '${name}' in composite scope '${scopeId}'.`,
      );
    return { ...state, scopes: { ...state.scopes, [scopeId]: { ...scope, [name]: value } } };
  }
  if (!(name in state.variables))
    throw new EngineError('UNKNOWN_VARIABLE', `Unknown variable '${name}'.`);
  return { ...state, variables: { ...state.variables, [name]: value } };
}

export function defaultValue(type: TypeRef): Value {
  switch (type.kind) {
    case 'string':
    case 'participant':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'card':
      return { id: '', suit: '', rank: '' };
    case 'collection':
      return [];
  }
}
