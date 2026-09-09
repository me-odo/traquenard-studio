import { t, type Audience, type Expression, type GameDefinition } from '@traquenard/game-ir';
import { sameType } from '@traquenard/game-validator';
import { authoredStateDeclarations } from '../data.js';
import { identifier } from '../formatting.js';
import {
  findOperation,
  removeOperation,
  rewriteOperationExpressions,
  updateDefinitionOperation,
  updateVariableType,
} from '../traversal.js';
import { availableValuesForOperation, expressionTypeAtOperation } from '../values.js';

export function changeForeachCollection(
  definition: GameDefinition,
  operationId: string,
  collection: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, collection);
  if (type?.kind !== 'collection') return definition;
  return updateDefinitionOperation(definition, operationId, (operation) =>
    operation.kind === 'control.foreach' ? { ...operation, collection } : operation,
  );
}

export function renameForeachBindingSafely(
  definition: GameDefinition,
  operationId: string,
  nextName: string,
): GameDefinition {
  const name = identifier(nextName);
  if (!name) return definition;
  return updateDefinitionOperation(definition, operationId, (operation) => {
    if (operation.kind !== 'control.foreach' || operation.itemVariable === name) return operation;
    return {
      ...operation,
      itemVariable: name,
      body: rewriteOperationExpressions(operation.body, operation.itemVariable, name),
    };
  });
}

export function changeRandomSelectSource(
  definition: GameDefinition,
  operationId: string,
  from: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, from);
  if (type?.kind !== 'collection') return definition;
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'random.select') return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'random.select' ? { ...item, from } : item,
    ),
    operation.output,
    type.element,
  );
}

export function changeShuffleSource(
  definition: GameDefinition,
  operationId: string,
  collection: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, collection);
  if (type?.kind !== 'collection') return definition;
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'collection.shuffle') return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'collection.shuffle' ? { ...item, collection } : item,
    ),
    operation.output,
    type,
  );
}

export function changeDrawSource(
  definition: GameDefinition,
  operationId: string,
  collectionVariable: string,
): GameDefinition {
  const source = availableValuesForOperation(definition, operationId).find(
    (item) => item.id === collectionVariable && item.type.kind === 'collection',
  );
  const operation = findOperation(definition, operationId);
  if (!source || source.type.kind !== 'collection' || operation?.kind !== 'collection.draw')
    return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'collection.draw' ? { ...item, collectionVariable } : item,
    ),
    operation.output,
    source.type.element,
  );
}

export function setConditionOperand(
  definition: GameDefinition,
  operationId: string,
  side: 'left' | 'right',
  expression: Expression,
): GameDefinition {
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'control.if' || operation.condition.kind !== 'equals') return definition;
  const other = side === 'left' ? operation.condition.right : operation.condition.left;
  const expressionTypeValue = expressionTypeAtOperation(definition, operationId, expression);
  const otherType = expressionTypeAtOperation(definition, operationId, other);
  if (!expressionTypeValue || !otherType || !sameType(expressionTypeValue, otherType))
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'control.if' && item.condition.kind === 'equals'
      ? { ...item, condition: { ...item.condition, [side]: expression } }
      : item,
  );
}

export function changeInputParticipant(
  definition: GameDefinition,
  operationId: string,
  participant: Expression,
): GameDefinition {
  if (
    !sameType(
      expressionTypeAtOperation(definition, operationId, participant) ?? t.string,
      t.participant,
    )
  )
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'input.wait' ? { ...item, participant } : item,
  );
}

export function changePresentMessage(
  definition: GameDefinition,
  operationId: string,
  message: Expression,
): GameDefinition {
  if (!sameType(expressionTypeAtOperation(definition, operationId, message) ?? t.number, t.string))
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'present' ? { ...item, message } : item,
  );
}

export function changeAudience(
  definition: GameDefinition,
  operationId: string,
  audience: Audience,
): GameDefinition {
  if (audience.kind === 'participant') {
    const type = expressionTypeAtOperation(definition, operationId, audience.id);
    if (!type || !sameType(type, t.participant)) return definition;
  }
  if (audience.kind === 'participants') {
    const type = expressionTypeAtOperation(definition, operationId, audience.ids);
    if (!type || !sameType(type, t.collection(t.participant))) return definition;
  }
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'present' ? { ...item, audience } : item,
  );
}

export function changeWorkflowArgument(
  definition: GameDefinition,
  operationId: string,
  portName: string,
  expression: Expression,
): GameDefinition {
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'composite.invoke') return definition;
  const expected = definition.composites
    .find((item) => item.id === operation.compositeId)
    ?.inputs.find((item) => item.name === portName)?.type;
  const actual = expressionTypeAtOperation(definition, operationId, expression);
  if (!expected || !actual || !sameType(expected, actual)) return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'composite.invoke'
      ? { ...item, arguments: { ...item.arguments, [portName]: expression } }
      : item,
  );
}

export function setStateValue(
  definition: GameDefinition,
  operationId: string,
  target: string,
  value: Expression,
): GameDefinition {
  const expected = authoredStateDeclarations(definition).find((item) => item.name === target)?.type;
  const actual = expressionTypeAtOperation(definition, operationId, value);
  if (!expected || !actual || !sameType(expected, actual)) return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'set' ? { ...item, variable: target, value } : item,
  );
}

export function deleteOperationCommand(
  definition: GameDefinition,
  operationId: string,
): GameDefinition {
  return {
    ...definition,
    root: removeOperation(definition.root, operationId),
    composites: definition.composites.map((workflow) => ({
      ...workflow,
      implementation: removeOperation(workflow.implementation, operationId),
    })),
  };
}
