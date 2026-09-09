export function WorkspaceTopbar(props: {
  readonly title: string;
  readonly workflowName: string | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onReset: () => void;
}) {
  return (
    <header className="authoring-ui-topbar">
      <div>
        <strong>Traquenard Studio</strong>
        <span className="authoring-ui-breadcrumb">
          {props.title} / {props.workflowName ?? 'Root workflow'}
        </span>
      </div>
      <nav aria-label="Workspace actions">
        <a href="/lab">Visual Lab</a>
        <a href="/runtime-proof">Runtime proof</a>
        <button disabled={!props.canUndo} onClick={props.onUndo}>
          Undo
        </button>
        <button disabled={!props.canRedo} onClick={props.onRedo}>
          Redo
        </button>
        <button onClick={props.onReset}>Reset</button>
      </nav>
    </header>
  );
}
