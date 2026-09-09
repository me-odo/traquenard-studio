import { operationReferences } from '@traquenard/authoring-domain';
import { OperationInspector } from './OperationInspector.js';
import { ReferenceInspector } from './ReferenceInspector.js';
import { ResourceInspector } from './ResourceInspector.js';
import { RuntimeInspector } from './RuntimeInspector.js';
import type { InspectorProps } from './types.js';
import { WorkflowInspector } from './WorkflowInspector.js';

export function Inspector(props: InspectorProps) {
  if (props.selection.kind === 'runtime') return <RuntimeInspector />;
  if (props.selection.kind === 'resource') {
    const resourceId = props.selection.id;
    const variable = props.definition.variables.find((item) => item.name === resourceId);
    return variable ? (
      <ResourceInspector {...props} variable={variable} />
    ) : (
      <p>Resource deleted.</p>
    );
  }
  if (props.selection.kind === 'workflow') {
    const workflowId = props.selection.id;
    const workflow = props.definition.composites.find((item) => item.id === workflowId);
    return workflow ? (
      <WorkflowInspector {...props} workflow={workflow} />
    ) : (
      <p>Workflow deleted.</p>
    );
  }
  if (props.selection.kind === 'reference') {
    const referencePath = props.selection.path;
    const operation = props.operation;
    const reference = operation
      ? operationReferences(props.definition, operation).find((item) => item.path === referencePath)
      : undefined;
    return operation && reference ? (
      <ReferenceInspector {...props} operation={operation} reference={reference} />
    ) : (
      <p>Reference is no longer available.</p>
    );
  }
  return props.operation ? (
    <OperationInspector {...props} operation={props.operation} />
  ) : (
    <p>Select a block, Data value, Workflow, or reference.</p>
  );
}
