import type { Expression, Value } from '@traquenard/game-ir';
import { EngineError } from './errors.js';
import { readVariable } from './state.js';
import type { EngineState } from './types.js';

export function evaluate(
  expression: Expression,
  state: EngineState,
  locals: Readonly<Record<string, Value>> = {},
  scopeId?: string,
): Value {
  switch (expression.kind) {
    case 'literal':
      return expression.value;
    case 'participants':
      return state.participants.map((item) => item.id);
    case 'variable': {
      const value = locals[expression.name] ?? readVariable(state, expression.name, scopeId);
      if (value === undefined)
        throw new EngineError('UNKNOWN_VARIABLE', `Unknown variable '${expression.name}'.`);
      return value;
    }
    case 'equals':
      return (
        canonicalValue(evaluate(expression.left, state, locals, scopeId)) ===
        canonicalValue(evaluate(expression.right, state, locals, scopeId))
      );
  }
}

export function asCollection(value: Value | undefined): readonly Value[] {
  if (!Array.isArray(value)) throw new EngineError('INVALID_VALUE', 'Expected a collection value.');
  return value as readonly Value[];
}

function canonicalValue(value: Value): string {
  return JSON.stringify(value);
}
