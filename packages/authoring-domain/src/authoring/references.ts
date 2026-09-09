import {
  t,
  variable,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
} from '@traquenard/game-ir';
import { referenceExpressions } from './expressions.js';
import type { OperationReference } from './types.js';
import { availableValuesForOperation, expressionTypeAtOperation } from './values.js';

export function operationReferences(
  definition: GameDefinition,
  operation: Operation,
): readonly OperationReference[] {
  const refs: OperationReference[] = [];
  const pushExpression = (
    path: string,
    label: string,
    expectedType: TypeRef,
    expression: Expression,
  ) => {
    for (const nested of referenceExpressions(expression))
      refs.push({ ownerOperationId: operation.id, path, label, expectedType, expression: nested });
  };
  switch (operation.kind) {
    case 'set': {
      const expected = definition.variables.find((item) => item.name === operation.variable)?.type;
      if (expected) pushExpression('value', 'Value', expected, operation.value);
      break;
    }
    case 'random.select': {
      const output = definition.variables.find((item) => item.name === operation.output)?.type;
      if (output) pushExpression('from', 'From', t.collection(output), operation.from);
      break;
    }
    case 'present':
      pushExpression('message', 'Message', t.string, operation.message);
      if (operation.audience.kind === 'participant')
        pushExpression('audience.id', 'Audience', t.participant, operation.audience.id);
      if (operation.audience.kind === 'participants')
        pushExpression(
          'audience.ids',
          'Audience',
          t.collection(t.participant),
          operation.audience.ids,
        );
      break;
    case 'input.wait':
      pushExpression('participant', 'Participant', t.participant, operation.participant);
      break;
    case 'control.if':
      if (operation.condition.kind === 'equals') {
        const leftType = expressionTypeAtOperation(
          definition,
          operation.id,
          operation.condition.left,
        );
        const rightType = expressionTypeAtOperation(
          definition,
          operation.id,
          operation.condition.right,
        );
        if (leftType)
          pushExpression('condition.left', 'Left operand', leftType, operation.condition.left);
        if (rightType)
          pushExpression('condition.right', 'Right operand', rightType, operation.condition.right);
      } else pushExpression('condition', 'Condition', t.boolean, operation.condition);
      break;
    case 'control.foreach':
      for (const expression of referenceExpressions(operation.collection)) {
        const type = expressionTypeAtOperation(definition, operation.id, expression);
        if (type)
          refs.push({
            ownerOperationId: operation.id,
            path: 'collection',
            label: 'Collection',
            expectedType: type,
            expression,
          });
      }
      break;
    case 'collection.shuffle': {
      const output = definition.variables.find((item) => item.name === operation.output)?.type;
      if (output) pushExpression('collection', 'Collection', output, operation.collection);
      break;
    }
    case 'collection.draw': {
      const source = availableValuesForOperation(definition, operation.id).find(
        (item) => item.id === operation.collectionVariable,
      );
      if (source)
        refs.push({
          ownerOperationId: operation.id,
          path: 'collectionVariable',
          label: 'Collection',
          expectedType: source.type,
          expression: variable(operation.collectionVariable),
        });
      break;
    }
    case 'composite.invoke': {
      const workflow = definition.composites.find((item) => item.id === operation.compositeId);
      for (const port of workflow?.inputs ?? []) {
        const expression = operation.arguments[port.name];
        if (expression) pushExpression(`arguments.${port.name}`, port.name, port.type, expression);
      }
      break;
    }
  }
  return refs;
}
