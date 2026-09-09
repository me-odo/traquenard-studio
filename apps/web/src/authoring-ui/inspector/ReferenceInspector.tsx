import { changeReferenceExpression, type OperationReference } from '@traquenard/authoring-domain';
import type { Operation } from '@traquenard/game-ir';
import { ValueSourceField } from '../fields/ValueSourceField.js';
import { Property, referenceValue, typeLabel } from './presentation.js';
import type { InspectorProps } from './types.js';

export function ReferenceInspector(
  props: InspectorProps & {
    readonly operation: Operation;
    readonly reference: OperationReference;
  },
) {
  return (
    <section aria-label={`${props.reference.label} reference details`}>
      <span className="authoring-ui-badge">TYPED REFERENCE</span>
      <h3>{props.reference.label}</h3>
      <Property label="Source" value={referenceValue(props.reference)} />
      <Property label="Type" value={typeLabel(props.reference.expectedType)} />
      <ValueSourceField
        definition={props.definition}
        operationId={props.operation.id}
        label="Change"
        value={props.reference.expression}
        expectedType={props.reference.expectedType}
        allowLiteral={allowsLiteral(props.reference.path)}
        allowRuntime={props.reference.path !== 'collectionVariable'}
        onChange={(expression) =>
          props.run(
            (definition) =>
              changeReferenceExpression(
                definition,
                props.operation,
                props.reference.path,
                expression,
              ),
            `${props.reference.label} source changed.`,
          )
        }
      />
      {props.semanticNavigation ? (
        <button
          className="authoring-ui-primary"
          onClick={() => props.onNavigateSource(props.reference)}
        >
          Go to source
        </button>
      ) : (
        <small>Semantic navigation is disabled in this experiment configuration.</small>
      )}
    </section>
  );
}

function allowsLiteral(path: string): boolean {
  return !['from', 'collection', 'collectionVariable', 'audience.ids'].includes(path);
}
