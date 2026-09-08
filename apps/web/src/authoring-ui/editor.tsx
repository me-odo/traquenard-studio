import { useRef, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/react';
import type {
  CompositeDefinition,
  GameDefinition,
  Operation,
  Value,
  VariableDeclaration,
} from '@traquenard/game-ir';
import {
  findOperation,
  insertionCatalog,
  operationLabel,
  type InsertableKind,
} from '../authoring-lab-model.js';
import {
  CURRENT_AUTHORING_BASELINE_ID,
  defaultAuthoringBaselineOverrides,
  type AuthoringExperimentOverrides,
} from './baseline.js';
import {
  displayName,
  expressionLabel,
  insertAtSlot,
  moveToSlot,
  operationSummary,
  referenceNames,
  resolveReferenceSource,
  sequenceById,
  setDrawCollection,
  setForeachItem,
  setIfRightLiteral,
  setInputOptions,
  setInputPrompt,
  setPresentMessage,
  setWaitDuration,
  type SemanticSlot,
} from './document.js';
import { useReviewSessionDefinition, type ReviewSessionIdentity } from './state/review-session.js';

type MobilePanel = 'flow' | 'data' | 'workflows' | 'inspector';
type Selection =
  | { readonly kind: 'operation'; readonly id: string }
  | { readonly kind: 'runtime' }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'workflow'; readonly id: string };

export interface AuthoringEditorProps {
  readonly initialDefinition: GameDefinition;
  readonly reviewSession: ReviewSessionIdentity;
  readonly experimentalAxes?: readonly string[];
  readonly overrides?: AuthoringExperimentOverrides;
  readonly surfaceLabel?: string;
}

const palette = insertionCatalog.filter((item) =>
  ['present', 'wait', 'if', 'foreach', 'composite'].includes(item.kind),
);

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
  const [selectionHistory, setSelectionHistory] = useState<readonly Selection[]>([]);
  const [paletteSlot, setPaletteSlot] = useState<SemanticSlot>();
  const [status, setStatus] = useState('Working copy matches the selected fixture.');
  const nextId = useRef(nextGeneratedOperationId(definition));
  const settings = { ...defaultAuthoringBaselineOverrides, ...overrides };
  const selectedOperation =
    selection.kind === 'operation' ? findOperation(definition, selection.id) : undefined;
  const activeWorkflow = workflowId
    ? definition.composites.find((item) => item.id === workflowId)
    : undefined;
  const sequenceId =
    activeWorkflow?.implementation.kind === 'sequence'
      ? activeWorkflow.implementation.id
      : definition.root.kind === 'sequence'
        ? definition.root.id
        : '';

  const select = (next: Selection) => {
    setSelection(next);
    setSelectionHistory([]);
    setMobilePanel('inspector');
  };

  const insert = (kind: InsertableKind, slot: SemanticSlot) => {
    const id = `baseline-${kind}-${nextId.current++}`;
    setDefinition((current) => insertAtSlot(current, slot, kind, id));
    setSelection({ kind: 'operation', id });
    setPaletteSlot(undefined);
    setMobilePanel('inspector');
    setStatus(
      `${displayName(kind)} inserted in ${displayName(slot.sequenceId)} at boundary ${slot.index + 1}.`,
    );
  };

  const move = (operationId: string, slot: SemanticSlot) => {
    setDefinition((current) => moveToSlot(current, operationId, slot));
    setSelection({ kind: 'operation', id: operationId });
    setStatus(
      `${displayName(operationId)} moved to ${displayName(slot.sequenceId)} boundary ${slot.index + 1}.`,
    );
  };

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const sourceId = String(event.operation.source?.id ?? '');
        const slot = decodeSlot(String(event.operation.target?.id ?? ''));
        if (!slot) return;
        if (sourceId.startsWith('palette:')) insert(sourceId.slice(8) as InsertableKind, slot);
        if (sourceId.startsWith('operation:')) move(sourceId.slice(10), slot);
      }}
    >
      <main
        className="authoring-baseline"
        aria-label={surfaceLabel}
        data-authoring-baseline={CURRENT_AUTHORING_BASELINE_ID}
        data-experimental-axes={experimentalAxes.join(',')}
      >
        <header className="authoring-ui-topbar">
          <div>
            <span className="authoring-ui-eyebrow">CURRENT AUTHORING BASELINE</span>
            <strong>{activeWorkflow?.name ?? 'Main'}</strong>
            <span className="authoring-ui-breadcrumb">
              {definition.title} / {activeWorkflow?.name ?? 'Main'}
            </span>
          </div>
          <nav aria-label="Workspace actions">
            <a href="/lab">Visual Lab</a>
            <a href="/runtime-proof">Runtime proof</a>
            <button
              onClick={() => {
                resetDefinition();
                nextId.current = 1;
                setWorkflowId(undefined);
                setSelectionHistory([]);
                setSelection({ kind: 'operation', id: firstOperationId(initialDefinition) });
                setMobilePanel('flow');
                setPaletteSlot(undefined);
                setStatus('Working copy reset to the selected fixture.');
              }}
            >
              Reset
            </button>
          </nav>
        </header>

        <MobileNavigation current={mobilePanel} onChange={setMobilePanel} />

        <section
          className={`authoring-ui-workspace mobile-${mobilePanel}`}
          aria-label="Shared authoring workspace"
        >
          <aside className="authoring-ui-library" aria-label="Library">
            <h2>Library</h2>
            <LibrarySection label="Blocks">
              <div className="authoring-ui-palette">
                {palette.map((item) => (
                  <PaletteBlock
                    key={item.kind}
                    kind={item.kind}
                    label={item.label}
                    onInsert={() =>
                      insert(item.kind, {
                        sequenceId,
                        index: sequenceById(definition, sequenceId)?.steps.length ?? 0,
                      })
                    }
                  />
                ))}
              </div>
              <SearchableAdd
                onChoose={(kind) =>
                  insert(kind, {
                    sequenceId,
                    index: sequenceById(definition, sequenceId)?.steps.length ?? 0,
                  })
                }
              />
              <p className="authoring-ui-note">
                Drag is an accelerator. Click, search, keyboard, and explicit insertion remain
                available.
              </p>
            </LibrarySection>
            <LibrarySection label="Data">
              <button
                className="authoring-ui-tree-item"
                onClick={() => select({ kind: 'runtime' })}
              >
                Runtime <small>Players · session-provided</small>
              </button>
              <strong className="authoring-ui-tree-label">Collections</strong>
              {definition.variables.filter(isCollection).map((variable) => (
                <button
                  key={variable.name}
                  className="authoring-ui-tree-item"
                  onClick={() => select({ kind: 'resource', id: variable.name })}
                >
                  {displayName(variable.name)} <small>Collection</small>
                </button>
              ))}
              <strong className="authoring-ui-tree-label">State</strong>
              {definition.variables
                .filter((variable) => !isCollection(variable))
                .map((variable) => (
                  <button
                    key={variable.name}
                    className="authoring-ui-tree-item"
                    onClick={() => select({ kind: 'resource', id: variable.name })}
                  >
                    {displayName(variable.name)} <small>{displayName(variable.type.kind)}</small>
                  </button>
                ))}
            </LibrarySection>
            <LibrarySection label="Workflows">
              <button
                className="authoring-ui-tree-item"
                onClick={() => {
                  setWorkflowId(undefined);
                  setMobilePanel('flow');
                }}
              >
                Main <small>Top-level Workflow</small>
              </button>
              {definition.composites.map((workflow) => (
                <button
                  key={workflow.id}
                  className="authoring-ui-tree-item"
                  onClick={() => select({ kind: 'workflow', id: workflow.id })}
                >
                  {workflow.name} <small>Named reusable Workflow</small>
                </button>
              ))}
              <p className="authoring-ui-note">
                Inline THEN, ELSE, foreach, and parallel bodies belong to their structural parent
                and are not global Workflows.
              </p>
            </LibrarySection>
          </aside>

          <section className="authoring-ui-flow" aria-label="Flow">
            <header>
              <div>
                <span className="authoring-ui-eyebrow">
                  {activeWorkflow ? 'NAMED WORKFLOW' : 'MAIN WORKFLOW'}
                </span>
                <h1>{activeWorkflow?.name ?? definition.title}</h1>
              </div>
              {activeWorkflow && <button onClick={() => setWorkflowId(undefined)}>← Main</button>}
            </header>
            {sequenceId ? (
              <FlowSequence
                definition={definition}
                sequenceId={sequenceId}
                selectedId={selection.kind === 'operation' ? selection.id : ''}
                containment={settings.containment ?? 'c-shape'}
                parallelProjection={settings.parallelProjection ?? 'grouped'}
                traceOverlay={settings.traceOverlay ?? false}
                onSelect={(id) => select({ kind: 'operation', id })}
                onOpenPalette={setPaletteSlot}
              />
            ) : activeWorkflow ? (
              <SingleOperation
                operation={activeWorkflow.implementation}
                onSelect={(id) => select({ kind: 'operation', id })}
              />
            ) : null}
            <output className="authoring-ui-status" aria-live="polite">
              {status}
            </output>
          </section>

          <aside className="authoring-ui-inspector" aria-label="Inspector">
            <h2>Inspector</h2>
            {selectionHistory.length > 0 && (
              <button
                className="authoring-ui-back-reference"
                onClick={() => {
                  const previous = selectionHistory.at(-1);
                  if (!previous) return;
                  setSelection(previous);
                  setSelectionHistory((history) => history.slice(0, -1));
                }}
              >
                ← Back to reference
              </button>
            )}
            <Inspector
              definition={definition}
              selection={selection}
              operation={selectedOperation}
              semanticNavigation={settings.semanticNavigation ?? true}
              onDefinition={setDefinition}
              onOpenWorkflow={(id) => {
                setWorkflowId(id);
                setMobilePanel('flow');
              }}
              onNavigateSource={(name) => {
                const source = resolveReferenceSource(definition, name, workflowId);
                if (!source) return;
                setSelectionHistory((history) => [...history, selection]);
                setSelection(
                  source.kind === 'operation'
                    ? { kind: 'operation', id: source.id }
                    : { kind: 'resource', id: source.id },
                );
                if (source.kind === 'operation') setWorkflowId(source.workflowId);
                setMobilePanel('inspector');
              }}
            />
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
                {palette.map((item) => (
                  <button key={item.kind} onClick={() => insert(item.kind, paletteSlot)}>
                    <strong>{item.label}</strong>
                    <small>{item.summary}</small>
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

function FlowSequence(props: {
  readonly definition: GameDefinition;
  readonly sequenceId: string;
  readonly selectedId: string;
  readonly containment: 'c-shape' | 'framed';
  readonly parallelProjection: 'grouped' | 'lanes' | 'fork-join';
  readonly traceOverlay: boolean;
  readonly onSelect: (id: string) => void;
  readonly onOpenPalette: (slot: SemanticSlot) => void;
}) {
  const sequence = sequenceById(props.definition, props.sequenceId);
  if (!sequence) return null;
  return (
    <ol className="authoring-ui-sequence" aria-label={`${displayName(props.sequenceId)} flow`}>
      {sequence.steps.map((operation, index) => (
        <li key={operation.id}>
          <InsertionSlot
            slot={{ sequenceId: props.sequenceId, index }}
            label={`Insert before ${operationLabel(operation)} in ${displayName(props.sequenceId)}`}
            onClick={props.onOpenPalette}
          />
          <OperationBlock
            {...props}
            operation={operation}
            selected={operation.id === props.selectedId}
          />
        </li>
      ))}
      <li>
        <InsertionSlot
          slot={{ sequenceId: props.sequenceId, index: sequence.steps.length }}
          label={`Insert at end of ${displayName(props.sequenceId)}`}
          onClick={props.onOpenPalette}
        />
      </li>
    </ol>
  );
}

function OperationBlock(
  props: Parameters<typeof FlowSequence>[0] & {
    readonly operation: Operation;
    readonly selected: boolean;
  },
) {
  const { ref, handleRef, isDragging } = useDraggable({ id: `operation:${props.operation.id}` });
  const structured =
    props.operation.kind === 'control.foreach' || props.operation.kind === 'control.if';
  return (
    <article
      ref={ref}
      id={`authoring-node-${props.operation.id}`}
      className={`authoring-ui-block ${props.selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${structured ? `is-structured is-${props.containment}` : ''}`}
      data-operation-kind={props.operation.kind}
    >
      <div className="authoring-ui-block-heading">
        <button
          ref={handleRef}
          className="authoring-ui-drag-handle"
          aria-label={`Drag ${operationLabel(props.operation)}`}
        >
          ⠿
        </button>
        <button
          className="authoring-ui-select"
          aria-label={`${operationLabel(props.operation)} step`}
          aria-pressed={props.selected}
          onClick={() => props.onSelect(props.operation.id)}
        >
          <strong>{operationLabel(props.operation)}</strong>
          <small>{operationSummary(props.operation)}</small>
        </button>
      </div>
      <ReferenceRows operation={props.operation} onSelect={props.onSelect} />
      {props.operation.kind === 'control.foreach' && (
        <StructuralSlot label="For each body" branch="BODY">
          <FlowSequence {...props} sequenceId={props.operation.body.id} />
        </StructuralSlot>
      )}
      {props.operation.kind === 'control.if' && (
        <>
          <StructuralSlot label="Then flow" branch="THEN">
            <FlowSequence {...props} sequenceId={props.operation.then.id} />
          </StructuralSlot>
          {props.operation.else && (
            <StructuralSlot label="Else flow" branch="ELSE">
              <FlowSequence {...props} sequenceId={props.operation.else.id} />
            </StructuralSlot>
          )}
        </>
      )}
      {props.operation.kind === 'control.parallel' && (
        <ParallelProjection
          operation={props.operation}
          projection={props.parallelProjection}
          onSelect={props.onSelect}
        />
      )}
      {props.traceOverlay && referenceNames(props.operation).length > 0 && (
        <aside className="authoring-ui-trace" aria-label="Reference trace overlay">
          PROVENANCE · {referenceNames(props.operation).map(displayName).join(', ')} →{' '}
          {operationLabel(props.operation)}
        </aside>
      )}
    </article>
  );
}

function ReferenceRows({
  operation,
  onSelect,
}: {
  readonly operation: Operation;
  readonly onSelect: (id: string) => void;
}) {
  const names = referenceNames(operation);
  if (names.length === 0) return null;
  return (
    <div className="authoring-ui-reference-row">
      {names.map((name) => (
        <button
          key={name}
          className="authoring-ui-reference-chip"
          onClick={() => onSelect(operation.id)}
          title={`Typed reference ${name}`}
        >
          {displayName(name)} <small>typed</small>
        </button>
      ))}
    </div>
  );
}

function StructuralSlot({
  label,
  branch,
  children,
}: {
  readonly label: string;
  readonly branch: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="authoring-ui-structural-slot" aria-label={label}>
      <span>{branch}</span>
      {children}
    </section>
  );
}

function ParallelProjection({
  operation,
  projection,
  onSelect,
}: {
  readonly operation: Extract<Operation, { kind: 'control.parallel' }>;
  readonly projection: 'grouped' | 'lanes' | 'fork-join';
  readonly onSelect: (id: string) => void;
}) {
  return (
    <section
      className={`authoring-ui-parallel projection-${projection}`}
      aria-label={`${displayName(projection)} parallel projection`}
    >
      <span className="authoring-ui-parallel-start">START TOGETHER</span>
      <div className="authoring-ui-parallel-branches">
        {operation.branches.map((branch, index) => (
          <button key={branch.id} onClick={() => onSelect(branch.id)}>
            <small>BRANCH {index + 1}</small>
            <strong>{operationLabel(branch)}</strong>
            <span>{operationSummary(branch)}</span>
          </button>
        ))}
      </div>
      <strong className="authoring-ui-parallel-join">WAIT FOR ALL, THEN CONTINUE</strong>
    </section>
  );
}

function InsertionSlot({
  slot,
  label,
  onClick,
}: {
  readonly slot: SemanticSlot;
  readonly label: string;
  readonly onClick: (slot: SemanticSlot) => void;
}) {
  const id = encodeSlot(slot);
  const { ref, isDropTarget } = useDroppable({ id });
  return (
    <div
      ref={ref}
      className={`authoring-ui-slot ${isDropTarget ? 'is-target' : ''}`}
      data-slot={id}
    >
      <button aria-label={label} onClick={() => onClick(slot)}>
        + <span>DROP / INSERT</span>
      </button>
    </div>
  );
}

function PaletteBlock({
  kind,
  label,
  onInsert,
}: {
  readonly kind: InsertableKind;
  readonly label: string;
  readonly onInsert: () => void;
}) {
  const { ref, isDragging } = useDraggable({ id: `palette:${kind}` });
  return (
    <button
      ref={ref}
      className={`authoring-ui-palette-block ${isDragging ? 'is-dragging' : ''}`}
      onClick={onInsert}
      data-palette-kind={kind}
    >
      <span aria-hidden="true">⠿</span>
      <strong>{label}</strong>
    </button>
  );
}

function SearchableAdd({
  onChoose,
  autoFocus = false,
}: {
  readonly onChoose: (kind: InsertableKind) => void;
  readonly autoFocus?: boolean;
}) {
  const labels = palette.map((item) => item.label);
  return (
    <div className="authoring-ui-search-add">
      <Combobox.Root
        items={labels}
        onValueChange={(label) => {
          const item = palette.find((candidate) => candidate.label === label);
          if (item) onChoose(item.kind);
        }}
      >
        <label htmlFor={autoFocus ? 'dialog-add-search' : 'library-add-search'}>
          Search blocks
        </label>
        <Combobox.InputGroup>
          <Combobox.Input
            autoFocus={autoFocus}
            id={autoFocus ? 'dialog-add-search' : 'library-add-search'}
            placeholder="Present, Wait, If…"
          />
          <Combobox.Trigger aria-label="Open block choices">⌄</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="authoring-ui-combobox-positioner">
            <Combobox.Popup className="authoring-ui-combobox-popup">
              <Combobox.Empty>No matching blocks</Combobox.Empty>
              <Combobox.List>
                {labels.map((label) => (
                  <Combobox.Item key={label} value={label}>
                    {label}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

function Inspector(props: {
  readonly definition: GameDefinition;
  readonly selection: Selection;
  readonly operation: Operation | undefined;
  readonly semanticNavigation: boolean;
  readonly onDefinition: React.Dispatch<React.SetStateAction<GameDefinition>>;
  readonly onOpenWorkflow: (id: string) => void;
  readonly onNavigateSource: (name: string) => void;
}) {
  if (props.selection.kind === 'runtime')
    return (
      <section aria-label="Runtime data details">
        <span className="authoring-ui-badge">SESSION-PROVIDED · READ-ONLY</span>
        <h3>Players</h3>
        <p>
          The authoritative running session supplies joined participants. Authors can reference this
          collection but cannot edit its runtime contents.
        </p>
      </section>
    );
  if (props.selection.kind === 'resource') {
    const resourceId = props.selection.id;
    const variable = props.definition.variables.find((item) => item.name === resourceId);
    return variable ? (
      <ResourceInspector variable={variable} onDefinition={props.onDefinition} />
    ) : null;
  }
  if (props.selection.kind === 'workflow') {
    const workflowId = props.selection.id;
    const workflow = props.definition.composites.find((item) => item.id === workflowId);
    return workflow ? (
      <WorkflowInspector workflow={workflow} onOpen={() => props.onOpenWorkflow(workflow.id)} />
    ) : null;
  }
  const operation = props.operation;
  if (!operation) return <p>Select a block, Data value, or named Workflow.</p>;
  const collections = props.definition.variables.filter(isCollection);
  return (
    <section aria-label={`${operationLabel(operation)} properties`}>
      <span className="authoring-ui-eyebrow">SELECTED STEP</span>
      <h3>{operationLabel(operation)}</h3>
      <p>{operationSummary(operation)}</p>
      {operation.kind === 'time.wait' && (
        <label>
          Duration{' '}
          <span className="authoring-ui-input-unit">
            <input
              aria-label="Duration"
              type="number"
              min="0"
              value={operation.durationMs / 1000}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setWaitDuration(current, operation.id, Number(event.target.value)),
                )
              }
            />{' '}
            seconds
          </span>
        </label>
      )}
      {operation.kind === 'control.foreach' && (
        <>
          <label>
            Collection
            <select aria-label="Collection" value="players" disabled>
              <option value="players">Players</option>
            </select>
          </label>
          <p className="authoring-ui-note">
            This fixture iterates the runtime participant collection; changing expression shape is
            outside the current editor command set.
          </p>
          <label>
            Current item
            <input
              aria-label="Current item"
              value={operation.itemVariable}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setForeachItem(current, operation.id, event.target.value),
                )
              }
            />
          </label>
        </>
      )}
      {operation.kind === 'control.if' && operation.condition.kind === 'equals' && (
        <>
          <label>
            Left
            <input
              aria-label="Condition left"
              value={expressionLabel(operation.condition.left)}
              readOnly
            />
          </label>
          <label>
            Operator
            <input aria-label="Condition operator" value="equals" readOnly />
          </label>
          <label>
            Right
            <input
              aria-label="Condition right"
              value={expressionLabel(operation.condition.right)}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setIfRightLiteral(current, operation.id, event.target.value),
                )
              }
            />
          </label>
        </>
      )}
      {operation.kind === 'collection.draw' && (
        <>
          <label>
            Collection
            <select
              aria-label="Draw collection"
              value={operation.collectionVariable}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setDrawCollection(current, operation.id, event.target.value),
                )
              }
            >
              {collections.map((item) => (
                <option key={item.name} value={item.name}>
                  {displayName(item.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Result
            <input aria-label="Draw result" value={operation.output} readOnly />
          </label>
          <p className="authoring-ui-note">
            Result identity is read-only here because renaming it requires an atomic reference
            migration command.
          </p>
        </>
      )}
      {operation.kind === 'present' && (
        <label>
          Message
          <input
            aria-label="Message"
            value={expressionLabel(operation.message)}
            onChange={(event) =>
              props.onDefinition((current) =>
                setPresentMessage(current, operation.id, event.target.value),
              )
            }
          />
        </label>
      )}
      {operation.kind === 'input.wait' && (
        <>
          <Property label="Participant" value={expressionLabel(operation.participant)} />
          <label>
            Prompt
            <input
              aria-label="Input prompt"
              value={operation.prompt}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setInputPrompt(current, operation.id, event.target.value),
                )
              }
            />
          </label>
          <label>
            Options
            <input
              aria-label="Input options"
              value={operation.options.join(', ')}
              onChange={(event) =>
                props.onDefinition((current) =>
                  setInputOptions(
                    current,
                    operation.id,
                    event.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                  ),
                )
              }
            />
          </label>
          <Property label="Result" value={operation.output} />
          <p className="authoring-ui-note">
            Participant reference and result identity are read-only until atomic reference migration
            commands are available; prompt and choices are editable authored values.
          </p>
        </>
      )}
      {operation.kind === 'random.select' && (
        <>
          <Property label="Collection" value="Players" />
          <Property label="Result" value={operation.output} />
          <p className="authoring-ui-note">
            The v1 source is the runtime participant collection. Result identity is read-only to
            avoid leaving dependent references dangling.
          </p>
        </>
      )}
      {operation.kind === 'composite.invoke' && (
        <>
          <label>
            Workflow
            <select aria-label="Workflow" value={operation.compositeId} disabled>
              {props.definition.composites.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="authoring-ui-note">
            Workflow identity is read-only because changing it requires compatible input/output
            remapping. Current argument bindings remain visible below.
          </p>
          {Object.entries(operation.arguments).map(([name, value]) => (
            <Property key={name} label={name} value={expressionLabel(value)} />
          ))}
          <button
            className="authoring-ui-primary"
            onClick={() => props.onOpenWorkflow(operation.compositeId)}
          >
            Open Workflow
          </button>
        </>
      )}
      {operation.kind === 'control.parallel' && (
        <>
          <Property label="Join" value="All branches" />
          <p className="authoring-ui-note">
            IR v1 permits only the currently validated restricted branch operations. Rich nested
            branch flows are not implied.
          </p>
        </>
      )}
      {operation.kind === 'end' && <p>This terminal step has no editable properties.</p>}
      {referenceNames(operation).map((name) => (
        <div className="authoring-ui-reference-inspector" key={name}>
          <span>Typed reference</span>
          <strong>{displayName(name)}</strong>
          {props.semanticNavigation ? (
            <button onClick={() => props.onNavigateSource(name)}>Go to source</button>
          ) : (
            <small>Semantic navigation is disabled in this experiment configuration.</small>
          )}
        </div>
      ))}
      <small className="authoring-ui-semantic-id">Semantic ID · {operation.id}</small>
    </section>
  );
}

function ResourceInspector({
  variable,
  onDefinition,
}: {
  readonly variable: VariableDeclaration;
  readonly onDefinition: React.Dispatch<React.SetStateAction<GameDefinition>>;
}) {
  const collection = isCollection(variable);
  return (
    <section aria-label={`${displayName(variable.name)} details`}>
      <span className="authoring-ui-badge">AUTHORED DATA · EDITABLE</span>
      <h3>{displayName(variable.name)}</h3>
      <Property label="Kind" value={collection ? 'Collection' : displayName(variable.type.kind)} />
      {typeof variable.initial === 'number' && (
        <label>
          Initial value
          <input
            aria-label="Initial value"
            type="number"
            value={variable.initial}
            onChange={(event) =>
              onDefinition((current) => ({
                ...current,
                variables: current.variables.map((item) =>
                  item.name === variable.name
                    ? { ...item, initial: Number(event.target.value) }
                    : item,
                ),
              }))
            }
          />
        </label>
      )}
      {collection && (
        <>
          <Property
            label="Items"
            value={Array.isArray(variable.initial) ? String(variable.initial.length) : '0'}
          />
          <p>
            A Deck can be a human-facing preset for this generic card collection; the engine
            resource remains a Collection.
          </p>
          <div className="authoring-ui-collection-editor" aria-label="Collection items">
            {collectionValues(variable.initial).map((item, index) => (
              <label key={collectionItemKey(item, index)}>
                Item {index + 1}
                <input
                  aria-label={`Collection item ${index + 1}`}
                  value={collectionItemLabel(item)}
                  onChange={(event) =>
                    onDefinition((current) => ({
                      ...current,
                      variables: current.variables.map((candidate) => {
                        if (candidate.name !== variable.name) return candidate;
                        const values = collectionValues(candidate.initial);
                        return {
                          ...candidate,
                          initial: values.map((value, itemIndex) =>
                            itemIndex === index && isCardValue(value)
                              ? { ...value, rank: event.target.value }
                              : value,
                          ),
                        };
                      }),
                    }))
                  }
                />
              </label>
            ))}
            <button
              className="authoring-ui-primary"
              onClick={() =>
                onDefinition((current) => ({
                  ...current,
                  variables: current.variables.map((candidate) => {
                    if (candidate.name !== variable.name) return candidate;
                    const values = collectionValues(candidate.initial);
                    return {
                      ...candidate,
                      initial: [
                        ...values,
                        {
                          id: `${variable.name}-${values.length + 1}`,
                          suit: 'authored',
                          rank: 'New card',
                        },
                      ],
                    };
                  }),
                }))
              }
            >
              Add collection item
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function WorkflowInspector({
  workflow,
  onOpen,
}: {
  readonly workflow: CompositeDefinition;
  readonly onOpen: () => void;
}) {
  return (
    <section aria-label={`${workflow.name} Workflow details`}>
      <span className="authoring-ui-badge">NAMED REUSABLE WORKFLOW</span>
      <h3>{workflow.name}</h3>
      <Property
        label="Inputs"
        value={workflow.inputs.map((item) => item.name).join(', ') || 'None'}
      />
      <Property
        label="Outputs"
        value={workflow.outputs.map((item) => item.name).join(', ') || 'None'}
      />
      <button className="authoring-ui-primary" onClick={onOpen}>
        Open Workflow
      </button>
      <p className="authoring-ui-note">
        This named Composite is navigable independently. Inline structural bodies stay attached to
        their parent block.
      </p>
    </section>
  );
}

function Property({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <dl className="authoring-ui-property">
      <dt>{displayName(label)}</dt>
      <dd>{displayName(value)}</dd>
    </dl>
  );
}
function LibrarySection({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h3>{label}</h3>
      {children}
    </section>
  );
}
function SingleOperation({
  operation,
  onSelect,
}: {
  readonly operation: Operation;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <button className="authoring-ui-single-operation" onClick={() => onSelect(operation.id)}>
      <strong>{operationLabel(operation)}</strong>
      <small>{operationSummary(operation)}</small>
    </button>
  );
}

function MobileNavigation({
  current,
  onChange,
}: {
  readonly current: MobilePanel;
  readonly onChange: (panel: MobilePanel) => void;
}) {
  return (
    <nav className="authoring-ui-mobile-nav" aria-label="Mobile authoring sections">
      {(['flow', 'data', 'workflows'] as const).map((panel) => (
        <button key={panel} aria-pressed={current === panel} onClick={() => onChange(panel)}>
          {displayName(panel)}
        </button>
      ))}
    </nav>
  );
}

function isCollection(variable: VariableDeclaration): boolean {
  return variable.type.kind === 'collection';
}

function collectionValues(value: Value | undefined): readonly Value[] {
  return Array.isArray(value) ? (value as readonly Value[]) : [];
}

function isCardValue(
  value: unknown,
): value is { readonly id: string; readonly suit: string; readonly rank: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'suit' in value &&
    'rank' in value
  );
}

function collectionItemLabel(value: unknown): string {
  if (isCardValue(value)) return value.rank;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return 'Structured value';
}

function collectionItemKey(value: unknown, index: number): string {
  return isCardValue(value) ? value.id : String(index);
}
function firstOperationId(definition: GameDefinition): string {
  return definition.root.kind === 'sequence'
    ? (definition.root.steps[0]?.id ?? definition.root.id)
    : definition.root.id;
}
function encodeSlot(slot: SemanticSlot): string {
  return `slot:${slot.sequenceId}:${slot.index}`;
}
function decodeSlot(value: string): SemanticSlot | undefined {
  const match = /^slot:(.+):(\d+)$/.exec(value);
  return match?.[1] && match[2] !== undefined
    ? { sequenceId: match[1], index: Number(match[2]) }
    : undefined;
}

function nextGeneratedOperationId(definition: GameDefinition): number {
  let highest = 0;
  const visit = (operation: Operation) => {
    const generated = /^baseline-[a-z-]+-(\d+)$/.exec(operation.id);
    if (generated?.[1]) highest = Math.max(highest, Number(generated[1]));
    switch (operation.kind) {
      case 'sequence':
        operation.steps.forEach(visit);
        break;
      case 'control.foreach':
        visit(operation.body);
        break;
      case 'control.if':
        visit(operation.then);
        if (operation.else) visit(operation.else);
        break;
      case 'control.parallel':
        operation.branches.forEach(visit);
        break;
    }
  };
  visit(definition.root);
  definition.composites.forEach((composite) => visit(composite.implementation));
  return highest + 1;
}
