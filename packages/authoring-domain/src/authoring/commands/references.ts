import type { Expression, GameDefinition, Operation } from '@traquenard/game-ir';
import {
  changeAudience,
  changeDrawSource,
  changeForeachCollection,
  changeInputParticipant,
  changePresentMessage,
  changeRandomSelectSource,
  changeShuffleSource,
  changeWorkflowArgument,
  setConditionOperand,
  setStateValue,
} from './operations.js';

export function changeReferenceExpression(
  definition: GameDefinition,
  operation: Operation,
  path: string,
  expression: Expression,
): GameDefinition {
  switch (operation.kind) {
    case 'set':
      return path === 'value'
        ? setStateValue(definition, operation.id, operation.variable, expression)
        : definition;
    case 'random.select':
      return path === 'from'
        ? changeRandomSelectSource(definition, operation.id, expression)
        : definition;
    case 'present':
      if (path === 'message') return changePresentMessage(definition, operation.id, expression);
      if (path === 'audience.id')
        return changeAudience(definition, operation.id, { kind: 'participant', id: expression });
      if (path === 'audience.ids')
        return changeAudience(definition, operation.id, { kind: 'participants', ids: expression });
      return definition;
    case 'input.wait':
      return path === 'participant'
        ? changeInputParticipant(definition, operation.id, expression)
        : definition;
    case 'control.if':
      return path === 'condition.left'
        ? setConditionOperand(definition, operation.id, 'left', expression)
        : path === 'condition.right'
          ? setConditionOperand(definition, operation.id, 'right', expression)
          : definition;
    case 'control.foreach':
      return path === 'collection'
        ? changeForeachCollection(definition, operation.id, expression)
        : definition;
    case 'collection.shuffle':
      return path === 'collection'
        ? changeShuffleSource(definition, operation.id, expression)
        : definition;
    case 'collection.draw':
      return path === 'collectionVariable' && expression.kind === 'variable'
        ? changeDrawSource(definition, operation.id, expression.name)
        : definition;
    case 'composite.invoke':
      return path.startsWith('arguments.')
        ? changeWorkflowArgument(definition, operation.id, path.slice(10), expression)
        : definition;
    default:
      return definition;
  }
}
