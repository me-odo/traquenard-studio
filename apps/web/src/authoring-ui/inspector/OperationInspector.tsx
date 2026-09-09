import {
  deleteOperationCommand,
  operationLabel,
  operationReferences,
} from '@traquenard/authoring-domain';
import type { Operation } from '@traquenard/game-ir';
import { operationSummary } from '../document.js';
import { CommunicationOperationFields } from './operation/CommunicationOperationFields.js';
import { ControlOperationFields } from './operation/ControlOperationFields.js';
import { DataOperationFields } from './operation/DataOperationFields.js';
import { WorkflowInvocationInspector } from './WorkflowInvocationInspector.js';
import { referenceValue } from './presentation.js';
import type { InspectorProps } from './types.js';

export function OperationInspector(props: InspectorProps & { readonly operation: Operation }) {
  const { operation } = props;
  return (
    <section aria-label={`${operationLabel(operation)} properties`}>
      <span className="authoring-ui-eyebrow">SELECTED STEP</span>
      <h3>{operationLabel(operation)}</h3>
      <p>{operationSummary(operation, props.definition)}</p>
      <DataOperationFields {...props} operation={operation} />
      <CommunicationOperationFields {...props} operation={operation} />
      <ControlOperationFields {...props} operation={operation} />
      {operation.kind === 'composite.invoke' && (
        <WorkflowInvocationInspector {...props} operation={operation} />
      )}
      {operationReferences(props.definition, operation).map((reference) => (
        <button
          key={reference.path}
          className="authoring-ui-reference-inspector"
          onClick={() => props.onNavigateReference(reference)}
        >
          <span>{reference.label}</span>
          <strong>{referenceValue(reference)}</strong>
          <small>Inspect typed reference</small>
        </button>
      ))}
      {operation.kind !== 'sequence' && (
        <button
          className="authoring-ui-danger"
          onClick={() => {
            props.run(
              (definition) => deleteOperationCommand(definition, operation.id),
              `${operationLabel(operation)} deleted. References were not silently repaired.`,
            );
            props.onDeleted();
          }}
        >
          Delete step
        </button>
      )}
      <small className="authoring-ui-semantic-id">Semantic ID · {operation.id}</small>
    </section>
  );
}
