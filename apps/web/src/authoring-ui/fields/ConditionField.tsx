import { expressionTypeAtOperation, setConditionOperand } from '@traquenard/authoring-domain';
import { t, type GameDefinition, type Operation } from '@traquenard/game-ir';
import type { RunCommand } from '../state/types.js';
import { ValueSourceField } from './ValueSourceField.js';

export function ConditionField(props: {
  readonly definition: GameDefinition;
  readonly operation: Extract<Operation, { readonly kind: 'control.if' }>;
  readonly run: RunCommand;
}) {
  const condition = props.operation.condition;
  if (condition.kind !== 'equals')
    return (
      <ValueSourceField
        definition={props.definition}
        operationId={props.operation.id}
        label="Condition"
        value={condition}
        expectedType={t.boolean}
        allowLiteral
        onChange={() => undefined}
      />
    );
  const leftType = expressionTypeAtOperation(props.definition, props.operation.id, condition.left);
  const rightType = expressionTypeAtOperation(
    props.definition,
    props.operation.id,
    condition.right,
  );
  const sharedType = leftType ?? rightType ?? t.string;
  return (
    <section className="authoring-ui-condition" aria-label="Condition editor">
      <ValueSourceField
        definition={props.definition}
        operationId={props.operation.id}
        label="Left operand"
        value={condition.left}
        expectedType={sharedType}
        allowLiteral
        onChange={(expression) =>
          props.run(
            (definition) => setConditionOperand(definition, props.operation.id, 'left', expression),
            'Condition left operand changed.',
          )
        }
      />
      <strong className="authoring-ui-condition-operator">equals</strong>
      <ValueSourceField
        definition={props.definition}
        operationId={props.operation.id}
        label="Right operand"
        value={condition.right}
        expectedType={sharedType}
        allowLiteral
        onChange={(expression) =>
          props.run(
            (definition) =>
              setConditionOperand(definition, props.operation.id, 'right', expression),
            'Condition right operand changed.',
          )
        }
      />
    </section>
  );
}
