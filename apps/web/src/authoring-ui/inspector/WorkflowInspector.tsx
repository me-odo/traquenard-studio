import { deleteWorkflowCommand, renameWorkflowCommand } from '@traquenard/authoring-domain';
import type { CompositeDefinition } from '@traquenard/game-ir';
import { Property, typeLabel } from './presentation.js';
import type { InspectorProps } from './types.js';

export function WorkflowInspector(
  props: InspectorProps & { readonly workflow: CompositeDefinition },
) {
  return (
    <section aria-label={`${props.workflow.name} Workflow details`}>
      <span className="authoring-ui-badge">REUSABLE WORKFLOW</span>
      <label>
        Name
        <input
          aria-label="Workflow name"
          value={props.workflow.name}
          onChange={(event) =>
            props.run(
              (definition) =>
                renameWorkflowCommand(definition, props.workflow.id, event.target.value),
              'Workflow name changed; semantic ID stayed stable.',
            )
          }
        />
      </label>
      <Property
        label="Inputs"
        value={
          props.workflow.inputs.map((item) => `${item.name}: ${typeLabel(item.type)}`).join(', ') ||
          'None'
        }
      />
      <Property
        label="Outputs"
        value={
          props.workflow.outputs
            .map((item) => `${item.name}: ${typeLabel(item.type)}`)
            .join(', ') || 'None'
        }
      />
      <p className="authoring-ui-note">
        Ports and version are read-only in this pass. Name and semantic ID are distinct.
      </p>
      <button
        className="authoring-ui-primary"
        onClick={() => props.onOpenWorkflow(props.workflow.id)}
      >
        Open Workflow
      </button>
      <button
        className="authoring-ui-danger"
        onClick={() => {
          props.run(
            (definition) => deleteWorkflowCommand(definition, props.workflow.id),
            `${props.workflow.name} deleted. Invocations were preserved for diagnostics.`,
          );
          props.onDeleted();
        }}
      >
        Delete Workflow
      </button>
    </section>
  );
}
