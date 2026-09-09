import { t, type GameDefinition, type Value, type VariableDeclaration } from '@traquenard/game-ir';
import { identifier, uniqueName } from '../formatting.js';
import type { AuthoredDataKind } from '../types.js';

export function createAuthoredData(
  definition: GameDefinition,
  kind: AuthoredDataKind,
  requestedName: string,
): GameDefinition {
  const name = uniqueName(
    definition.variables.map((item) => item.name),
    identifier(requestedName) || kind,
  );
  const declaration: VariableDeclaration =
    kind === 'collection'
      ? { name, type: t.collection(t.card), initial: [] }
      : kind === 'string'
        ? { name, type: t.string, initial: '' }
        : kind === 'boolean'
          ? { name, type: t.boolean, initial: false }
          : { name, type: t.number, initial: 0 };
  return { ...definition, variables: [...definition.variables, declaration] };
}

export function updateAuthoredDataInitial(
  definition: GameDefinition,
  variableName: string,
  initial: Value,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) =>
      item.name === variableName && item.initial !== undefined ? { ...item, initial } : item,
    ),
  };
}

export function deleteAuthoredData(
  definition: GameDefinition,
  variableName: string,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.filter(
      (item) => item.name !== variableName || item.initial === undefined,
    ),
  };
}
