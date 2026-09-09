import type { GameDefinition } from '@traquenard/game-ir';

export function WorkflowLibrary(props: {
  readonly definition: GameDefinition;
  readonly onRoot: () => void;
  readonly onWorkflow: (id: string) => void;
  readonly onCreate: () => void;
}) {
  return (
    <section>
      <h3>Workflows</h3>
      <button className="authoring-ui-tree-item" onClick={props.onRoot}>
        Root workflow <small>{props.definition.title} · game flow</small>
      </button>
      {props.definition.composites.map((workflow) => (
        <button
          key={workflow.id}
          className="authoring-ui-tree-item"
          onClick={() => props.onWorkflow(workflow.id)}
        >
          {workflow.name} <small>Reusable Workflow</small>
        </button>
      ))}
      <button className="authoring-ui-create" onClick={props.onCreate}>
        + New workflow
      </button>
      <p className="authoring-ui-note">
        THEN, ELSE, foreach, and parallel bodies are inline structure, not global Workflows.
      </p>
    </section>
  );
}
