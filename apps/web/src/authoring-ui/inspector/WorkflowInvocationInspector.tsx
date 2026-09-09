import { changeWorkflowArgument } from '@traquenard/authoring-domain';
import type { Operation } from '@traquenard/game-ir';
import { displayName } from '../document.js';
import { ValueSourceField } from '../fields/ValueSourceField.js';
import { Property, ReadOnlyOutput } from './presentation.js';
import type { InspectorProps } from './types.js';

export function WorkflowInvocationInspector(
  props: InspectorProps & {
    readonly operation: Extract<Operation, { readonly kind: 'composite.invoke' }>;
  },
) {
  const workflow = props.definition.composites.find(
    (item) => item.id === props.operation.compositeId,
  );
  return (
    <>
      <Property label="Workflow" value={workflow?.name ?? props.operation.compositeId} />
      <p className="authoring-ui-note">
        Target switching is read-only until inputs and outputs can be reconciled atomically.
      </p>
      {workflow?.inputs.map((port) => {
        const binding = props.operation.arguments[port.name];
        return binding ? (
          <ValueSourceField
            key={port.name}
            definition={props.definition}
            operationId={props.operation.id}
            label={displayName(port.name)}
            value={binding}
            expectedType={port.type}
            allowLiteral
            onChange={(expression) =>
              props.run(
                (definition) =>
                  changeWorkflowArgument(definition, props.operation.id, port.name, expression),
                `${displayName(port.name)} binding changed.`,
              )
            }
          />
        ) : null;
      })}
      {Object.entries(props.operation.outputs).map(([port, target]) => (
        <ReadOnlyOutput key={port} label={`${displayName(port)} output`} value={target} />
      ))}
      <button
        className="authoring-ui-primary"
        onClick={() => props.onOpenWorkflow(props.operation.compositeId)}
      >
        Open Workflow
      </button>
    </>
  );
}
