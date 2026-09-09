import { t, type Expression, type TypeRef } from '@traquenard/game-ir';
import type { AuthoringValue } from './types.js';

export function expressionType(
  expression: Expression,
  available: readonly Pick<AuthoringValue, 'id' | 'type'>[],
): TypeRef | undefined {
  switch (expression.kind) {
    case 'participants':
      return t.collection(t.participant);
    case 'literal':
      return expression.valueType;
    case 'variable':
      return available.find((item) => item.id === expression.name)?.type;
    case 'equals':
      return t.boolean;
  }
}

export function referenceExpressions(expression: Expression): readonly Expression[] {
  if (expression.kind === 'variable' || expression.kind === 'participants') return [expression];
  if (expression.kind === 'equals')
    return [...referenceExpressions(expression.left), ...referenceExpressions(expression.right)];
  return [];
}
