import type { GameArtifact, TypeRef, Value } from '@traquenard/game-ir';
import { EngineError } from './errors.js';
import { createRngState } from './rng.js';
import type { EngineState, Participant } from './types.js';

export function createEngineState(
  artifact: GameArtifact,
  participants: readonly Participant[],
  semanticSeed: string,
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
    rngState: createRngState(semanticSeed),
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
  if (scope.outputNames.includes(name) && !scope.assignedOutputNames.includes(name))
    throw new EngineError(
      'UNASSIGNED_COMPOSITE_OUTPUT',
      `Composite output '${name}' was read before assignment.`,
    );
  return scope.values[name];
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
    if (!(name in scope.values) && !scope.outputNames.includes(name))
      throw new EngineError(
        'UNKNOWN_VARIABLE',
        `Unknown variable '${name}' in composite scope '${scopeId}'.`,
      );
    return {
      ...state,
      scopes: {
        ...state.scopes,
        [scopeId]: {
          ...scope,
          values: { ...scope.values, [name]: value },
          assignedOutputNames:
            scope.outputNames.includes(name) && !scope.assignedOutputNames.includes(name)
              ? [...scope.assignedOutputNames, name]
              : scope.assignedOutputNames,
        },
      },
    };
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
    default:
      return assertNever(type);
  }
}

function assertNever(value: never): never {
  throw new EngineError('INVALID_ARTIFACT', `Unhandled type: ${JSON.stringify(value)}`);
}
