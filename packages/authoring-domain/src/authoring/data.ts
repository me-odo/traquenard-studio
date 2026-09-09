import type { GameDefinition, VariableDeclaration } from '@traquenard/game-ir';
import { allOperations, operationOutputNames } from './traversal.js';

export function authoredDataDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return definition.variables.filter((item) => item.initial !== undefined);
}

export function authoredCollectionDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return authoredDataDeclarations(definition).filter((item) => item.type.kind === 'collection');
}

export function authoredStateDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return authoredDataDeclarations(definition).filter((item) => item.type.kind !== 'collection');
}

export function flowOutputDeclarations(definition: GameDefinition): readonly VariableDeclaration[] {
  const produced = new Set(allOperations(definition).flatMap(operationOutputNames));
  return definition.variables.filter(
    (item) => item.initial === undefined && produced.has(item.name),
  );
}
