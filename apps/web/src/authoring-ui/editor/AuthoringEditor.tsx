import { useMemo, useRef, useState } from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import {
  authoringDiagnostics,
  createAuthoredData,
  createWorkflowCommand,
  findOperation,
  operationLabel,
  type OperationReference,
} from '@traquenard/authoring-domain';
import type { GameDefinition, Operation } from '@traquenard/game-ir';
import {
  CURRENT_AUTHORING_BASELINE_ID,
  defaultAuthoringBaselineOverrides,
  type AuthoringExperimentOverrides,
} from '../baseline.js';
import {
  displayName,
  insertAtSlot,
  moveToSlot,
  resolveReferenceSource,
  sequenceById,
  type SemanticSlot,
} from '../document.js';
import { FlowSequence, OperationBlock } from '../flow/FlowSequence.js';
import { Inspector } from '../inspector/Inspector.js';
import { BlockLibrary, SearchableAdd } from '../library/BlockLibrary.js';
import { DataLibrary } from '../library/DataLibrary.js';
import { WorkflowLibrary } from '../library/WorkflowLibrary.js';
import type { InsertableOperationKind } from '../registry/operations.js';
import { operationCatalog } from '../registry/operations.js';
import { useReviewSessionDefinition, type ReviewSessionIdentity } from '../state/review-session.js';
import type { MobilePanel, NavigationContext, RunCommand, Selection } from '../state/types.js';
import { WorkspaceTopbar } from './WorkspaceTopbar.js';

export interface AuthoringEditorProps {
  readonly initialDefinition: GameDefinition;
  readonly reviewSession: ReviewSessionIdentity;
  readonly experimentalAxes?: readonly string[];
  readonly overrides?: AuthoringExperimentOverrides;
  readonly surfaceLabel?: string;
}

export function AuthoringEditor({
  initialDefinition,
  reviewSession,
  experimentalAxes = [],
  overrides = {},
  surfaceLabel = 'Current authoring editor',
}: AuthoringEditorProps) {
  const { definition, setDefinition, resetDefinition } = useReviewSessionDefinition(
    initialDefinition,
    reviewSession,
  );
  const [selection, setSelection] = useState<Selection>({
    kind: 'operation',
    id: firstOperationId(definition),
  });
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('flow');
  const [workflowId, setWorkflowId] = useState<string>();
  const [navigationHistory, setNavigationHistory] = useState<readonly NavigationContext[]>([]);
  const [undoStack, setUndoStack] = useState<readonly GameDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<readonly GameDefinition[]>([]);
  const [paletteSlot, setPaletteSlot] = useState<SemanticSlot>();
  const [status, setStatus] = useState('Working copy matches the selected fixture.');
  const nextId = useRef(nextGeneratedOperationId(definition));
  const settings = { ...defaultAuthoringBaselineOverrides, ...overrides };
  const selectedOperationId =
    selection.kind === 'operation'
      ? selection.id
      : selection.kind === 'reference'
        ? selection.operationId
        : undefined;
  const selectedOperation = selectedOperationId
    ? findOperation(definition, selectedOperationId)
    : undefined;
  const activeWorkflow = workflowId
    ? definition.composites.find((item) => item.id === workflowId)
    : undefined;
  const activeOperation = activeWorkflow?.implementation ?? definition.root;
  const sequenceId = activeOperation.kind === 'sequence' ? activeOperation.id : '';
  const diagnostics = useMemo(() => authoringDiagnostics(definition), [definition]);

  const run: RunCommand = (command, message) => {
    setDefinition((current) => {
      const next = command(current);
      if (next === current) return current;
      setUndoStack((items) => [...items, current]);
      setRedoStack([]);
      return next;
    });
    setStatus(message);
  };

  const select = (next: Selection) => {
    setSelection(next);
    setMobilePanel('inspector');
  };

  const insert = (kind: InsertableOperationKind, slot: SemanticSlot) => {
    const id = `baseline-${kind.replaceAll('.', '-')}-${nextId.current++}`;
    run(
      (current) => insertAtSlot(current, slot, kind, id),
      `${operationLabel({ id, kind } as Operation)} inserted at boundary ${slot.index + 1}.`,
    );
    setSelection({ kind: 'operation', id });
    setPaletteSlot(undefined);
    setMobilePanel('inspector');
  };

  const move = (operationId: string, slot: SemanticSlot) => {
    run(
      (current) => moveToSlot(current, operationId, slot),
      `${displayName(operationId)} moved to boundary ${slot.index + 1}.`,
    );
    setSelection({ kind: 'operation', id: operationId });
  };

  const projectionProps = {
    definition,
    selectedId: selectedOperationId ?? '',
    containment: settings.containment ?? 'c-shape',
    parallelProjection: settings.parallelProjection ?? 'grouped',
    traceOverlay: settings.traceOverlay ?? false,
    onSelect: (id: string) => select({ kind: 'operation', id }),
    onSelectReference: (reference: OperationReference) => {
      setNavigationHistory((history) => [
        ...history,
        { selection, ...(workflowId ? { workflowId } : {}) },
      ]);
      select({ kind: 'reference', operationId: reference.ownerOperationId, path: reference.path });
    },
    onOpenPalette: setPaletteSlot,
  } as const;

  const navigateSource = (reference: OperationReference) => {
    if (reference.expression.kind === 'participants') {
      setNavigationHistory((history) => [
        ...history,
        { selection, ...(workflowId ? { workflowId } : {}) },
      ]);
      setSelection({ kind: 'runtime' });
      setWorkflowId(undefined);
    } else if (reference.expression.kind === 'variable') {
      const source = resolveReferenceSource(definition, reference.expression.name, workflowId);
      if (!source) return;
      setNavigationHistory((history) => [
        ...history,
        { selection, ...(workflowId ? { workflowId } : {}) },
      ]);
      setSelection(
        source.kind === 'operation'
          ? { kind: 'operation', id: source.id }
          : { kind: 'resource', id: source.id },
      );
      setWorkflowId(source.kind === 'operation' ? source.workflowId : undefined);
    }
    setMobilePanel('inspector');
  };

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const sourceId = String(event.operation.source?.id ?? '');
        const slot = decodeSlot(String(event.operation.target?.id ?? ''));
        if (!slot) return;
        if (sourceId.startsWith('palette:'))
          insert(sourceId.slice(8) as InsertableOperationKind, slot);
        if (sourceId.startsWith('operation:')) move(sourceId.slice(10), slot);
      }}
    >
      <main
        className="authoring-baseline"
        aria-label={surfaceLabel}
        data-authoring-baseline={CURRENT_AUTHORING_BASELINE_ID}
        data-experimental-axes={experimentalAxes.join(',')}
      >
        <WorkspaceTopbar
          title={definition.title}
          workflowName={activeWorkflow?.name}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={() => {
            const previous = undoStack.at(-1);
            if (!previous) return;
            setDefinition((current) => {
              setRedoStack((items) => [...items, current]);
              return previous;
            });
            setUndoStack((items) => items.slice(0, -1));
            setStatus('Undid the last semantic edit.');
          }}
          onRedo={() => {
            const next = redoStack.at(-1);
            if (!next) return;
            setDefinition((current) => {
              setUndoStack((items) => [...items, current]);
              return next;
            });
            setRedoStack((items) => items.slice(0, -1));
            setStatus('Redid the semantic edit.');
          }}
          onReset={() => {
            resetDefinition();
            nextId.current = 1;
            setWorkflowId(undefined);
            setNavigationHistory([]);
            setUndoStack([]);
            setRedoStack([]);
            setSelection({ kind: 'operation', id: firstOperationId(initialDefinition) });
            setMobilePanel('flow');
            setPaletteSlot(undefined);
            setStatus('Working copy reset to the selected fixture.');
          }}
        />
        <MobileNavigation current={mobilePanel} onChange={setMobilePanel} />
        <section
          className={`authoring-ui-workspace mobile-${mobilePanel}`}
          aria-label="Shared authoring workspace"
        >
          <aside className="authoring-ui-library" aria-label="Library">
            <h2>Library</h2>
            <BlockLibrary
              onInsert={(kind) =>
                insert(kind, {
                  sequenceId,
                  index: sequenceById(definition, sequenceId)?.steps.length ?? 0,
                })
              }
            />
            <DataLibrary
              definition={definition}
              onRuntime={() => select({ kind: 'runtime' })}
              onResource={(id) => select({ kind: 'resource', id })}
              onCreate={(kind) => {
                const name = uniqueName(
                  definition.variables.map((item) => item.name),
                  kind === 'collection'
                    ? 'newCollection'
                    : kind === 'string'
                      ? 'newText'
                      : kind === 'boolean'
                        ? 'newFlag'
                        : 'newState',
                );
                run(
                  (current) => createAuthoredData(current, kind, name),
                  `${displayName(name)} created.`,
                );
                setSelection({ kind: 'resource', id: name });
                setMobilePanel('inspector');
              }}
            />
            <WorkflowLibrary
              definition={definition}
              onRoot={() => {
                setWorkflowId(undefined);
                setMobilePanel('flow');
              }}
              onWorkflow={(id) => select({ kind: 'workflow', id })}
              onCreate={() => {
                const id = uniqueName(
                  definition.composites.map((item) => item.id),
                  'newWorkflow',
                );
                run(
                  (current) => createWorkflowCommand(current, displayName(id)),
                  `${displayName(id)} created.`,
                );
                setSelection({ kind: 'workflow', id });
                setMobilePanel('inspector');
              }}
            />
          </aside>
          <section className="authoring-ui-flow" aria-label="Flow">
            <header>
              <div>
                <span className="authoring-ui-eyebrow">
                  {activeWorkflow ? 'REUSABLE WORKFLOW' : 'ROOT WORKFLOW'}
                </span>
                <h1>{activeWorkflow?.name ?? definition.title}</h1>
              </div>
              {activeWorkflow && (
                <button onClick={() => setWorkflowId(undefined)}>← Root workflow</button>
              )}
            </header>
            {sequenceId ? (
              <FlowSequence {...projectionProps} sequenceId={sequenceId} />
            ) : (
              <OperationBlock {...projectionProps} operation={activeOperation} />
            )}
            <output className="authoring-ui-status" aria-live="polite">
              {status}
            </output>
          </section>
          <aside className="authoring-ui-inspector" aria-label="Inspector">
            <h2>Inspector</h2>
            {navigationHistory.length > 0 && (
              <button
                className="authoring-ui-back-reference"
                onClick={() => {
                  const previous = navigationHistory.at(-1);
                  if (!previous) return;
                  setSelection(previous.selection);
                  setWorkflowId(previous.workflowId);
                  setNavigationHistory((history) => history.slice(0, -1));
                }}
              >
                ← Back to reference
              </button>
            )}
            <Inspector
              definition={definition}
              selection={selection}
              {...(selectedOperation ? { operation: selectedOperation } : {})}
              semanticNavigation={settings.semanticNavigation ?? true}
              run={run}
              onOpenWorkflow={(id) => {
                setNavigationHistory((history) => [
                  ...history,
                  { selection, ...(workflowId ? { workflowId } : {}) },
                ]);
                setWorkflowId(id);
                setMobilePanel('flow');
              }}
              onNavigateReference={(reference) => {
                setNavigationHistory((history) => [
                  ...history,
                  { selection, ...(workflowId ? { workflowId } : {}) },
                ]);
                setSelection({
                  kind: 'reference',
                  operationId: reference.ownerOperationId,
                  path: reference.path,
                });
                setMobilePanel('inspector');
              }}
              onNavigateSource={navigateSource}
              onDeleted={() =>
                setSelection({
                  kind: 'operation',
                  id: firstOperationIdExcluding(definition, selectedOperationId),
                })
              }
            />
            {diagnostics.length > 0 && (
              <section className="authoring-ui-diagnostics" aria-label="Draft diagnostics">
                <h3>Draft diagnostics · {diagnostics.length}</h3>
                {diagnostics.map((item, index) => (
                  <button
                    key={`${item.code}-${index}`}
                    onClick={() =>
                      item.operationId && select({ kind: 'operation', id: item.operationId })
                    }
                  >
                    <strong>{displayName(item.code)}</strong>
                    <span>{item.message}</span>
                    {item.field && <small>{item.field}</small>}
                  </button>
                ))}
              </section>
            )}
            <button className="authoring-ui-mobile-back" onClick={() => setMobilePanel('flow')}>
              ← Back to Flow
            </button>
          </aside>
        </section>
        {paletteSlot && (
          <div
            className="authoring-ui-palette-layer"
            role="presentation"
            onMouseDown={() => setPaletteSlot(undefined)}
          >
            <section
              className="authoring-ui-add-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Add step palette"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span className="authoring-ui-eyebrow">INSERT BOUNDARY</span>
                  <h2>Add step</h2>
                </div>
                <button
                  aria-label="Close add step palette"
                  onClick={() => setPaletteSlot(undefined)}
                >
                  ×
                </button>
              </header>
              <SearchableAdd onChoose={(kind) => insert(kind, paletteSlot)} autoFocus />
              <div className="authoring-ui-dialog-list">
                {operationCatalog.map((item) => (
                  <button
                    key={item.kind}
                    onClick={() => insert(item.kind as InsertableOperationKind, paletteSlot)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.explanation}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      <DragOverlay className="authoring-ui-drag-overlay" dropAnimation={null}>
        {(source) => (
          <span>{displayName(String(source.id).replace(/^(palette|operation):/, ''))}</span>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

function MobileNavigation(props: {
  readonly current: MobilePanel;
  readonly onChange: (panel: MobilePanel) => void;
}) {
  return (
    <nav className="authoring-ui-mobile-nav" aria-label="Mobile authoring sections">
      {(['flow', 'data', 'workflows'] as const).map((panel) => (
        <button
          key={panel}
          aria-pressed={props.current === panel}
          onClick={() => props.onChange(panel)}
        >
          {displayName(panel)}
        </button>
      ))}
    </nav>
  );
}

function firstOperationId(definition: GameDefinition): string {
  return definition.root.kind === 'sequence'
    ? (definition.root.steps[0]?.id ?? definition.root.id)
    : definition.root.id;
}
function firstOperationIdExcluding(
  definition: GameDefinition,
  excludedId: string | undefined,
): string {
  return definition.root.kind === 'sequence'
    ? (definition.root.steps.find((item) => item.id !== excludedId)?.id ?? definition.root.id)
    : definition.root.id;
}
function decodeSlot(value: string): SemanticSlot | undefined {
  const match = /^slot:(.+):(\d+)$/.exec(value);
  return match?.[1] && match[2] !== undefined
    ? { sequenceId: match[1], index: Number(match[2]) }
    : undefined;
}
function uniqueName(existing: readonly string[], base: string): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}
function nextGeneratedOperationId(definition: GameDefinition): number {
  let highest = 0;
  const visit = (operation: Operation) => {
    const generated = /^baseline-[a-z.-]+-(\d+)$/.exec(operation.id);
    if (generated?.[1]) highest = Math.max(highest, Number(generated[1]));
    if (operation.kind === 'sequence') operation.steps.forEach(visit);
    if (operation.kind === 'control.foreach') visit(operation.body);
    if (operation.kind === 'control.if') {
      visit(operation.then);
      if (operation.else) visit(operation.else);
    }
    if (operation.kind === 'control.parallel') operation.branches.forEach(visit);
  };
  visit(definition.root);
  definition.composites.forEach((item) => visit(item.implementation));
  return highest + 1;
}
