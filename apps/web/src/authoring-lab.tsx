import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Card, GameDefinition, Operation, VariableDeclaration } from '@traquenard/game-ir';
import {
  addCardToDeck,
  authoringDiagnostics,
  changeDrawSource,
  createAuthoringWorkingDefinition,
  createResource,
  deckDeclarations,
  deleteOperation,
  deleteResource,
  drawSourceCandidates,
  findOperation,
  insertOperation,
  insertionCatalog,
  moveOperation,
  operationLabel,
  resourceLabel,
  resourceUsages,
  setVariableInitial,
  stateDeclarations,
  type AuthoringCandidate,
  type InsertableKind,
  type ResourceKind,
} from './authoring-lab-model.js';

type Projection = 'negative-space' | 'inset';
type Selection =
  | { readonly kind: 'runtime' }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'operation'; readonly id: string }
  | { readonly kind: 'composite'; readonly id: string };
type MobileScreen = 'flow' | 'resources' | 'step' | 'resource' | 'picker';

interface InsertionTarget {
  readonly sequenceId: string;
  readonly index: number;
  readonly label: string;
}

interface ReferenceTarget {
  readonly operationId: string;
  readonly sequenceId: string;
  readonly index: number;
}

export function AuthoringLab() {
  const [definition, setDefinition] = useState<GameDefinition>(() =>
    createAuthoringWorkingDefinition(),
  );
  const [history, setHistory] = useState<readonly GameDefinition[]>([]);
  const [selection, setSelection] = useState<Selection>({
    kind: 'operation',
    id: 'choose-player',
  });
  const [projection, setProjection] = useState<Projection>('negative-space');
  const [insertion, setInsertion] = useState<InsertionTarget>();
  const [referenceTarget, setReferenceTarget] = useState<ReferenceTarget>();
  const [focusedCompositeId, setFocusedCompositeId] = useState<string>();
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>('flow');
  const [resourceCreatorOpen, setResourceCreatorOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const nextId = useRef(1);
  const isMobile = useMediaQuery('(max-width: 760px)');
  const diagnostics = useMemo(() => authoringDiagnostics(definition), [definition]);
  const focusedComposite = definition.composites.find((item) => item.id === focusedCompositeId);
  const displayedFlow = focusedComposite?.implementation ?? definition.root;

  const applySemanticEdit = (next: GameDefinition) => {
    if (next === definition) return;
    setHistory((current) => [...current, definition]);
    setDefinition(next);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setDefinition(previous);
    setHistory((current) => current.slice(0, -1));
    setInsertion(undefined);
    setReferenceTarget(undefined);
  };

  const reset = () => {
    setDefinition(createAuthoringWorkingDefinition());
    setHistory([]);
    setSelection({ kind: 'operation', id: 'choose-player' });
    setInsertion(undefined);
    setReferenceTarget(undefined);
    setFocusedCompositeId(undefined);
    setMobileScreen('flow');
  };

  const selectOperation = (id: string) => {
    setSelection({ kind: 'operation', id });
    setReferenceTarget(undefined);
    if (isMobile) setMobileScreen('step');
  };

  const selectResource = (next: Selection) => {
    setSelection(next);
    setReferenceTarget(undefined);
    if (isMobile) setMobileScreen('resource');
  };

  const openComposite = (id: string) => {
    setFocusedCompositeId(id);
    setSelection({ kind: 'composite', id });
    setReferenceTarget(undefined);
    setMobileScreen('flow');
  };

  const closeComposite = () => {
    setFocusedCompositeId(undefined);
    setSelection({ kind: 'operation', id: 'prepare-turn' });
    setMobileScreen(isMobile ? 'step' : 'flow');
  };

  const openReference = (target: ReferenceTarget) => {
    setReferenceTarget(target);
    if (isMobile) setMobileScreen('picker');
  };

  const insert = (kind: InsertableKind) => {
    if (!insertion) return;
    const id = `authoring-${kind}-${nextId.current++}`;
    applySemanticEdit(insertOperation(definition, insertion.sequenceId, insertion.index, kind, id));
    setInsertion(undefined);
    setSelection({ kind: 'operation', id });
    if (isMobile) setMobileScreen('step');
  };

  const deleteSelected = (id: string) => {
    applySemanticEdit(deleteOperation(definition, id));
    setSelection({ kind: 'operation', id: definition.root.id });
    if (isMobile) setMobileScreen('flow');
  };

  const chooseReference = (candidate: AuthoringCandidate) => {
    if (!referenceTarget || !candidate.compatible) return;
    applySemanticEdit(
      changeDrawSource(definition, referenceTarget.operationId, candidate.value.id),
    );
    setReferenceTarget(undefined);
    setSelection({ kind: 'operation', id: referenceTarget.operationId });
    if (isMobile) setMobileScreen('step');
  };

  const workspaceProps: WorkspaceProps = {
    definition,
    displayedFlow,
    focusedComposite,
    projection,
    selection,
    diagnostics,
    historyCount: history.length,
    insertion,
    referenceTarget,
    advanced,
    onSelectOperation: selectOperation,
    onSelectResource: selectResource,
    onOpenInsertion: setInsertion,
    onCloseInsertion: () => setInsertion(undefined),
    onInsert: insert,
    onOpenReference: openReference,
    onChooseReference: chooseReference,
    onCloseReference: () => setReferenceTarget(undefined),
    onDelete: deleteSelected,
    onMove: (id, direction) => applySemanticEdit(moveOperation(definition, id, direction)),
    onUndo: undo,
    onOpenComposite: openComposite,
    onCloseComposite: closeComposite,
    onCreateResource: (kind, name) => {
      const next = createResource(definition, kind, name);
      applySemanticEdit(next);
      const created = next.variables.find(
        (item) => !definition.variables.some((existing) => existing.name === item.name),
      );
      if (created) setSelection({ kind: 'resource', id: created.name });
      setResourceCreatorOpen(false);
    },
    onAddCard: (deck, label) => applySemanticEdit(addCardToDeck(definition, deck, label)),
    onSetVariable: (name, value) => applySemanticEdit(setVariableInitial(definition, name, value)),
    onDeleteResource: (name) => {
      applySemanticEdit(deleteResource(definition, name));
      setSelection({ kind: 'runtime' });
      if (isMobile) setMobileScreen('resources');
    },
    resourceCreatorOpen,
    onOpenResourceCreator: () => setResourceCreatorOpen(true),
    onCloseResourceCreator: () => setResourceCreatorOpen(false),
  };

  return (
    <main className="authoring-lab">
      <header className="authoring-topbar">
        <div>
          <a href="/lab">← Visual Lab</a>
          <span className="eyebrow">AUTHORING EXPERIMENT · ISSUE #6</span>
          <h1>{definition.title}</h1>
        </div>
        <div className="authoring-status" aria-live="polite">
          <span className={diagnostics.length === 0 ? 'is-valid' : 'has-diagnostics'}>
            {diagnostics.length === 0 ? 'Draft valid' : `${diagnostics.length} diagnostic(s)`}
          </span>
          <button disabled={history.length === 0} onClick={undo}>
            Undo
          </button>
        </div>
      </header>

      <details className="authoring-settings">
        <summary>Experiment settings</summary>
        <div>
          <span>Structured containment</span>
          <button
            aria-pressed={projection === 'negative-space'}
            onClick={() => setProjection('negative-space')}
          >
            C-shaped · negative space
          </button>
          <button aria-pressed={projection === 'inset'} onClick={() => setProjection('inset')}>
            Framed · inset body
          </button>
          <button aria-pressed={advanced} onClick={() => setAdvanced((value) => !value)}>
            Advanced semantics · {advanced ? 'On' : 'Off'}
          </button>
          <button onClick={reset}>Reset fixture</button>
        </div>
      </details>

      {isMobile ? (
        <MobileWorkspace
          {...workspaceProps}
          screen={mobileScreen}
          onNavigate={setMobileScreen}
          onBack={() => {
            if (mobileScreen === 'picker') {
              setReferenceTarget(undefined);
              setMobileScreen('step');
            } else if (mobileScreen === 'resource') setMobileScreen('resources');
            else if (mobileScreen === 'step') setMobileScreen('flow');
          }}
        />
      ) : (
        <DesktopWorkspace {...workspaceProps} />
      )}
    </main>
  );
}

interface WorkspaceProps {
  readonly definition: GameDefinition;
  readonly displayedFlow: Operation;
  readonly focusedComposite: GameDefinition['composites'][number] | undefined;
  readonly projection: Projection;
  readonly selection: Selection;
  readonly diagnostics: ReturnType<typeof authoringDiagnostics>;
  readonly historyCount: number;
  readonly insertion: InsertionTarget | undefined;
  readonly referenceTarget: ReferenceTarget | undefined;
  readonly advanced: boolean;
  readonly resourceCreatorOpen: boolean;
  readonly onSelectOperation: (id: string) => void;
  readonly onSelectResource: (selection: Selection) => void;
  readonly onOpenInsertion: (target: InsertionTarget) => void;
  readonly onCloseInsertion: () => void;
  readonly onInsert: (kind: InsertableKind) => void;
  readonly onOpenReference: (target: ReferenceTarget) => void;
  readonly onChooseReference: (candidate: AuthoringCandidate) => void;
  readonly onCloseReference: () => void;
  readonly onDelete: (id: string) => void;
  readonly onMove: (id: string, direction: -1 | 1) => void;
  readonly onUndo: () => void;
  readonly onOpenComposite: (id: string) => void;
  readonly onCloseComposite: () => void;
  readonly onCreateResource: (kind: ResourceKind, name: string) => void;
  readonly onAddCard: (deck: string, label: string) => void;
  readonly onSetVariable: (name: string, value: number | string | boolean) => void;
  readonly onDeleteResource: (name: string) => void;
  readonly onOpenResourceCreator: () => void;
  readonly onCloseResourceCreator: () => void;
}

function DesktopWorkspace(props: WorkspaceProps) {
  return (
    <section className="authoring-workspace" aria-label="Core authoring workspace">
      <ResourcesPanel {...props} />
      <FlowPanel {...props} />
      <InspectorPanel {...props} />
    </section>
  );
}

function MobileWorkspace(
  props: WorkspaceProps & {
    readonly screen: MobileScreen;
    readonly onNavigate: (screen: MobileScreen) => void;
    readonly onBack: () => void;
  },
) {
  const { screen, onNavigate, onBack } = props;
  const detailScreen = ['step', 'resource', 'picker'].includes(screen);
  return (
    <section className="authoring-mobile" aria-label="Core authoring mobile workspace">
      {!detailScreen && !props.focusedComposite && (
        <nav className="authoring-mobile-tabs" aria-label="Authoring sections">
          <button aria-pressed={screen === 'flow'} onClick={() => onNavigate('flow')}>
            Flow
          </button>
          <button aria-pressed={screen === 'resources'} onClick={() => onNavigate('resources')}>
            Resources
          </button>
        </nav>
      )}
      {detailScreen && (
        <button className="authoring-back" onClick={onBack}>
          ← Back to {screen === 'resource' ? 'Resources' : 'Flow'}
        </button>
      )}
      {props.focusedComposite && screen === 'flow' && (
        <button className="authoring-back" onClick={props.onCloseComposite}>
          ← Back to parent flow
        </button>
      )}
      {screen === 'flow' && <FlowPanel {...props} />}
      {screen === 'resources' && <ResourcesPanel {...props} />}
      {screen === 'step' && <InspectorPanel {...props} />}
      {screen === 'resource' && <InspectorPanel {...props} />}
      {screen === 'picker' && <InspectorPanel {...props} />}
    </section>
  );
}

function ResourcesPanel(props: WorkspaceProps) {
  const decks = deckDeclarations(props.definition);
  const states = stateDeclarations(props.definition);
  return (
    <aside className="authoring-resources" aria-label="Game resources">
      <div className="authoring-panel-heading">
        <div>
          <span className="eyebrow">GAME DATA</span>
          <h2>Resources</h2>
        </div>
        <button onClick={props.onOpenResourceCreator}>＋ Resource</button>
      </div>
      {props.resourceCreatorOpen && (
        <ResourceCreator onCreate={props.onCreateResource} onClose={props.onCloseResourceCreator} />
      )}
      <ResourceSection title="Runtime" hint="Provided by the running session">
        <ResourceButton
          label="Players"
          detail="Joined Participants · read-only"
          selected={props.selection.kind === 'runtime'}
          onClick={() => props.onSelectResource({ kind: 'runtime' })}
        />
      </ResourceSection>
      <ResourceSection title="Decks" hint="Card collections owned by this game">
        {decks.map((deck) => (
          <ResourceButton
            key={deck.name}
            label={resourceLabel(deck.name)}
            detail={`${Array.isArray(deck.initial) ? deck.initial.length : 0} cards`}
            selected={props.selection.kind === 'resource' && props.selection.id === deck.name}
            onClick={() => props.onSelectResource({ kind: 'resource', id: deck.name })}
          />
        ))}
      </ResourceSection>
      <ResourceSection title="Variables" hint="Initialized game state">
        {states.map((state) => (
          <ResourceButton
            key={state.name}
            label={resourceLabel(state.name)}
            detail={`${state.type.kind === 'number' ? 'Number' : state.type.kind} · ${initialValueLabel(state.initial)}`}
            selected={props.selection.kind === 'resource' && props.selection.id === state.name}
            onClick={() => props.onSelectResource({ kind: 'resource', id: state.name })}
          />
        ))}
      </ResourceSection>
      <ResourceSection title="Composites" hint="Reusable structured flows">
        {props.definition.composites.map((composite) => (
          <ResourceButton
            key={composite.id}
            label={composite.name}
            detail={`${composite.inputs.length} inputs · ${composite.outputs.length} output`}
            selected={props.selection.kind === 'composite' && props.selection.id === composite.id}
            onClick={() => props.onSelectResource({ kind: 'composite', id: composite.id })}
          />
        ))}
      </ResourceSection>
    </aside>
  );
}

function ResourceSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="authoring-resource-group">
      <div>
        <h3>{title}</h3>
        <small>{hint}</small>
      </div>
      {children}
    </section>
  );
}

function ResourceButton({
  label,
  detail,
  selected,
  onClick,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className="authoring-resource" aria-pressed={selected} onClick={onClick}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function ResourceCreator({
  onCreate,
  onClose,
}: {
  onCreate: (kind: ResourceKind, name: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ResourceKind>('deck');
  const [name, setName] = useState('Bonus Deck');
  return (
    <form
      className="authoring-resource-creator"
      aria-label="Create resource"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(kind, name);
      }}
    >
      <div className="authoring-form-title">
        <strong>Create resource</strong>
        <button type="button" aria-label="Close resource creator" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        Kind
        <select value={kind} onChange={(event) => setKind(event.target.value as ResourceKind)}>
          <option value="deck">Deck</option>
          <option value="variable">Variable</option>
        </select>
      </label>
      <label>
        {kind === 'deck' ? 'Deck name' : 'Variable name'}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button className="authoring-primary" type="submit">
        Create
      </button>
    </form>
  );
}

function FlowPanel(props: WorkspaceProps) {
  return (
    <section className="authoring-flow-panel" aria-label="Game flow">
      <div className="authoring-flow-heading">
        <div>
          <span className="eyebrow">STRUCTURED FLOW</span>
          <h2>{props.focusedComposite?.name ?? 'Main flow'}</h2>
        </div>
        {props.focusedComposite && (
          <button onClick={props.onCloseComposite}>← Back to parent</button>
        )}
      </div>
      <nav className="authoring-breadcrumb" aria-label="Semantic location">
        <span>Game</span>
        <span aria-hidden="true">/</span>
        <strong>{props.focusedComposite?.name ?? 'Main flow'}</strong>
      </nav>
      <DiagnosticBanner
        diagnostics={props.diagnostics}
        onUndo={props.onUndo}
        canUndo={props.historyCount > 0}
      />
      {props.displayedFlow.kind === 'sequence' ? (
        <FlowSequence
          operation={props.displayedFlow}
          label={props.focusedComposite?.name ?? 'Main flow'}
          {...props}
        />
      ) : (
        <OperationBlock operation={props.displayedFlow} sequenceId="" index={0} {...props} />
      )}
      {props.insertion && (
        <InsertionPalette
          target={props.insertion}
          onInsert={props.onInsert}
          onClose={props.onCloseInsertion}
        />
      )}
    </section>
  );
}

function FlowSequence(
  props: WorkspaceProps & {
    readonly operation: Extract<Operation, { kind: 'sequence' }>;
    readonly label: string;
  },
) {
  return (
    <ol className="authoring-sequence" aria-label={`${props.label} sequence`}>
      {props.operation.steps.map((operation, index) => (
        <li key={operation.id}>
          <InsertionBoundary
            label={`Insert before ${operationLabel(operation)} in ${props.label}`}
            onClick={() =>
              props.onOpenInsertion({
                sequenceId: props.operation.id,
                index,
                label: `Between steps ${index} and ${index + 1} · ${props.label}`,
              })
            }
          />
          <OperationBlock
            {...props}
            operation={operation}
            sequenceId={props.operation.id}
            index={index}
          />
        </li>
      ))}
      <li>
        <InsertionBoundary
          label={`Insert at end of ${props.label}`}
          onClick={() =>
            props.onOpenInsertion({
              sequenceId: props.operation.id,
              index: props.operation.steps.length,
              label: `End of ${props.label}`,
            })
          }
        />
      </li>
    </ol>
  );
}

function InsertionBoundary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="authoring-insertion" aria-label={label} title={label} onClick={onClick}>
      <span aria-hidden="true">＋</span>
    </button>
  );
}

function OperationBlock(
  props: WorkspaceProps & {
    readonly operation: Operation;
    readonly sequenceId: string;
    readonly index: number;
  },
) {
  const { operation } = props;
  const selected = props.selection.kind === 'operation' && props.selection.id === operation.id;
  if (operation.kind === 'control.foreach')
    return <ForeachBlock {...props} operation={operation} selected={selected} />;
  if (operation.kind === 'control.if')
    return <IfBlock {...props} operation={operation} selected={selected} />;
  if (operation.kind === 'control.parallel')
    return <ParallelBlock {...props} operation={operation} selected={selected} />;
  return (
    <article
      className="authoring-block"
      data-selected={selected}
      id={`authoring-node-${operation.id}`}
    >
      <BlockHeader {...props} />
      <OperationFields {...props} />
    </article>
  );
}

function BlockHeader(
  props: WorkspaceProps & {
    readonly operation: Operation;
    readonly sequenceId: string;
    readonly index: number;
  },
) {
  return (
    <div className="authoring-block-header">
      <button
        className="authoring-block-select"
        aria-label={`${operationLabel(props.operation)} step${
          props.selection.kind === 'operation' && props.selection.id === props.operation.id
            ? ', selected'
            : ''
        }`}
        onClick={() => props.onSelectOperation(props.operation.id)}
      >
        <strong>{operationLabel(props.operation)}</strong>
        <small>{operationSummary(props.operation)}</small>
      </button>
      <button
        className="authoring-delete"
        aria-label={`Delete ${operationLabel(props.operation)} step`}
        onClick={() => props.onDelete(props.operation.id)}
      >
        ×
      </button>
    </div>
  );
}

function OperationFields(
  props: WorkspaceProps & {
    readonly operation: Operation;
    readonly sequenceId: string;
    readonly index: number;
  },
) {
  const operation = props.operation;
  if (operation.kind === 'collection.draw')
    return (
      <div className="authoring-block-fields">
        <span>From</span>
        <button
          className="authoring-reference-chip"
          aria-label={`Change ${resourceLabel(operation.collectionVariable)} reference`}
          onClick={() =>
            props.onOpenReference({
              operationId: operation.id,
              sequenceId: props.sequenceId,
              index: props.index,
            })
          }
        >
          {resourceLabel(operation.collectionVariable)} <span aria-hidden="true">▾</span>
        </button>
      </div>
    );
  if (operation.kind === 'random.select')
    return <OutputRow input="From" value="Players" output="Current Player" />;
  if (operation.kind === 'input.wait')
    return <OutputRow input="Player" value="Current Player" output="Answer" />;
  if (operation.kind === 'composite.invoke')
    return (
      <div className="authoring-composite-fields">
        <span>Player</span>
        <span className="authoring-reference-chip static">Current Player</span>
        <span>Deck</span>
        <span className="authoring-reference-chip static">
          {operation.arguments.deck?.kind === 'variable'
            ? resourceLabel(operation.arguments.deck.name)
            : 'Questions Deck'}
        </span>
        <button onClick={() => props.onOpenComposite(operation.compositeId)}>Open Composite</button>
      </div>
    );
  return null;
}

function OutputRow({ input, value, output }: { input: string; value: string; output: string }) {
  return (
    <div className="authoring-block-fields">
      <span>{input}</span>
      <span className="authoring-reference-chip static">{value}</span>
      <span className="authoring-output">Produces · {output}</span>
    </div>
  );
}

function ForeachBlock(
  props: WorkspaceProps & {
    readonly operation: Extract<Operation, { kind: 'control.foreach' }>;
    readonly sequenceId: string;
    readonly index: number;
    readonly selected: boolean;
  },
) {
  const body = props.operation.body;
  return (
    <article
      className={`authoring-structure foreach ${props.projection}`}
      data-selected={props.selected}
      id={`authoring-node-${props.operation.id}`}
    >
      <BlockHeader {...props} />
      <div className="authoring-structure-rule">
        For each <span className="authoring-reference-chip static">Player</span> in{' '}
        <span className="authoring-reference-chip static">Players</span>
      </div>
      <section className="authoring-structure-body" aria-label="For Each body">
        <span className="authoring-branch-label">REPEAT FOR EACH PLAYER</span>
        {body.kind === 'sequence' && (
          <FlowSequence {...props} operation={body} label="For Each body" />
        )}
      </section>
    </article>
  );
}

function IfBlock(
  props: WorkspaceProps & {
    readonly operation: Extract<Operation, { kind: 'control.if' }>;
    readonly sequenceId: string;
    readonly index: number;
    readonly selected: boolean;
  },
) {
  return (
    <article
      className={`authoring-structure if ${props.projection}`}
      data-selected={props.selected}
      id={`authoring-node-${props.operation.id}`}
    >
      <BlockHeader {...props} />
      <div className="authoring-structure-rule">
        If <span className="authoring-reference-chip static">Answer</span> = “Yes”
      </div>
      <div className="authoring-if-branches">
        <section className="authoring-structure-body" aria-label="If THEN body">
          <span className="authoring-branch-label">THEN · YES</span>
          {props.operation.then.kind === 'sequence' && (
            <FlowSequence {...props} operation={props.operation.then} label="THEN body" />
          )}
        </section>
        <section className="authoring-structure-body" aria-label="If ELSE body">
          <span className="authoring-branch-label">ELSE · NO</span>
          {props.operation.else?.kind === 'sequence' && (
            <FlowSequence {...props} operation={props.operation.else} label="ELSE body" />
          )}
        </section>
      </div>
    </article>
  );
}

function ParallelBlock(
  props: WorkspaceProps & {
    readonly operation: Extract<Operation, { kind: 'control.parallel' }>;
    readonly sequenceId: string;
    readonly index: number;
    readonly selected: boolean;
  },
) {
  return (
    <article
      className="authoring-structure parallel"
      data-selected={props.selected}
      id={`authoring-node-${props.operation.id}`}
    >
      <BlockHeader {...props} />
      <div className="authoring-parallel-branches">
        {props.operation.branches.map((branch, index) => (
          <div key={branch.id}>
            <span>BRANCH {index + 1}</span>
            <strong>{operationLabel(branch)}</strong>
          </div>
        ))}
      </div>
      <strong className="authoring-join">JOIN · WAIT FOR ALL</strong>
      <small>Executable IR v1: independent presentation or wait branches only.</small>
    </article>
  );
}

function InsertionPalette({
  target,
  onInsert,
  onClose,
}: {
  target: InsertionTarget;
  onInsert: (kind: InsertableKind) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const visible = insertionCatalog.filter((item) =>
    `${item.label} ${item.category} ${item.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="authoring-palette-popover" aria-label="Add step palette">
      <div className="authoring-form-title">
        <div>
          <strong>Add step</strong>
          <small>{target.label}</small>
        </div>
        <button aria-label="Close add step palette" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        Search operations
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="authoring-palette-list">
        {visible.map((item) => (
          <button key={item.kind} onClick={() => onInsert(item.kind)}>
            <span>{item.category}</span>
            <strong>{item.label}</strong>
            <small>{item.summary}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function InspectorPanel(props: WorkspaceProps) {
  return (
    <aside className="authoring-inspector" aria-label="Inspector">
      <span className="eyebrow">CONTEXT</span>
      <h2>Inspector</h2>
      {props.referenceTarget ? (
        <ReferencePicker {...props} target={props.referenceTarget} />
      ) : props.selection.kind === 'runtime' ? (
        <RuntimeInspector definition={props.definition} />
      ) : props.selection.kind === 'resource' ? (
        <ResourceInspector {...props} id={props.selection.id} />
      ) : props.selection.kind === 'composite' ? (
        <CompositeInspector {...props} id={props.selection.id} />
      ) : (
        <OperationInspector {...props} id={props.selection.id} />
      )}
    </aside>
  );
}

function RuntimeInspector({ definition }: { definition: GameDefinition }) {
  return (
    <section className="authoring-inspector-content" aria-label="Players resource details">
      <h3>Players</h3>
      <span className="authoring-readonly">Provided by session · Read-only</span>
      <DefinitionRow label="Type" value="Collection of Participants" />
      <UsageList usages={['Choose Player', 'For Each Player']} />
      <p className="authoring-note">
        The running session supplies joined players. Game authors can reference this value, but do
        not create, edit, or delete it.
      </p>
      <small>{definition.title}</small>
    </section>
  );
}

function ResourceInspector(props: WorkspaceProps & { id: string }) {
  const declaration = props.definition.variables.find((item) => item.name === props.id);
  if (!declaration) return <p>This resource no longer exists.</p>;
  const isDeck = declaration.type.kind === 'collection';
  const cards = Array.isArray(declaration.initial) ? (declaration.initial as readonly Card[]) : [];
  return (
    <section
      className="authoring-inspector-content"
      aria-label={`${resourceLabel(props.id)} details`}
    >
      <h3>{resourceLabel(props.id)}</h3>
      <span className="authoring-resource-kind">{isDeck ? 'Deck' : 'Game state'}</span>
      <DefinitionRow
        label={isDeck ? 'Cards' : 'Initial value'}
        value={isDeck ? String(cards.length) : initialValueLabel(declaration.initial)}
      />
      <UsageList usages={resourceUsages(props.definition, props.id)} />
      {isDeck ? (
        <DeckEditor declaration={declaration} onAdd={(label) => props.onAddCard(props.id, label)} />
      ) : (
        <StateEditor
          declaration={declaration}
          onSave={(value) => props.onSetVariable(props.id, value)}
        />
      )}
      <button
        className="authoring-delete-resource"
        onClick={() => props.onDeleteResource(props.id)}
      >
        Delete resource
      </button>
      {props.advanced && <code>{declaration.type.kind}</code>}
    </section>
  );
}

function DeckEditor({
  declaration,
  onAdd,
}: {
  declaration: VariableDeclaration;
  onAdd: (label: string) => void;
}) {
  const [label, setLabel] = useState('New card');
  const cards = Array.isArray(declaration.initial) ? (declaration.initial as readonly Card[]) : [];
  return (
    <section className="authoring-deck-editor" aria-label="Deck editor">
      <h4>Cards</h4>
      <ol>
        {cards.map((card, index) => (
          <li key={card.id || index}>
            Card {index + 1}
            <small>{card.rank}</small>
          </li>
        ))}
      </ol>
      <label>
        Card label
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <button onClick={() => onAdd(label)}>＋ Add card</button>
      <p className="authoring-note">
        The current Card shape is intentionally minimal; this experiment tests collection authoring,
        not a final party-card content schema.
      </p>
    </section>
  );
}

function StateEditor({
  declaration,
  onSave,
}: {
  declaration: VariableDeclaration;
  onSave: (value: number | string | boolean) => void;
}) {
  const [value, setValue] = useState(initialValueLabel(declaration.initial));
  return (
    <form
      className="authoring-state-editor"
      aria-label="Edit variable"
      onSubmit={(event) => {
        event.preventDefault();
        if (declaration.type.kind === 'number') onSave(Number(value));
        else if (declaration.type.kind === 'boolean') onSave(value === 'true');
        else onSave(value);
      }}
    >
      <label>
        Initial value
        <input
          type={declaration.type.kind === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit">Save value</button>
      <p className="authoring-note">A simple initialized value owned by this game.</p>
    </form>
  );
}

function CompositeInspector(props: WorkspaceProps & { id: string }) {
  const composite = props.definition.composites.find((item) => item.id === props.id);
  if (!composite) return <p>This Composite no longer exists.</p>;
  return (
    <section className="authoring-inspector-content" aria-label={`${composite.name} details`}>
      <h3>{composite.name}</h3>
      <span className="authoring-resource-kind">Reusable Composite</span>
      <DefinitionRow label="Inputs" value="Player, Deck" />
      <DefinitionRow label="Output" value="Card" />
      <button className="authoring-primary" onClick={() => props.onOpenComposite(composite.id)}>
        Open Composite
      </button>
    </section>
  );
}

function OperationInspector(props: WorkspaceProps & { id: string }) {
  const operation = findOperation(props.definition, props.id);
  if (!operation || operation.kind === 'sequence')
    return <p>Select a step in the flow to inspect and edit it.</p>;
  return (
    <section
      className="authoring-inspector-content"
      aria-label={`${operationLabel(operation)} step details`}
    >
      <h3>{operationLabel(operation)}</h3>
      <p>{operationSummary(operation)}</p>
      {operation.kind === 'collection.draw' && (
        <button
          className="authoring-reference-chip"
          onClick={() =>
            props.onOpenReference({
              operationId: operation.id,
              sequenceId: 'authoring-root',
              index: 1,
            })
          }
        >
          From · {resourceLabel(operation.collectionVariable)}
        </button>
      )}
      {operation.kind === 'control.foreach' && (
        <DefinitionRow label="Repeats" value="Body once for each Player in Players" />
      )}
      {operation.kind === 'control.if' && (
        <DefinitionRow label="Branches" value="THEN (Yes) and ELSE (No)" />
      )}
      {operation.kind === 'control.parallel' && (
        <DefinitionRow label="Join" value="All safe branches" />
      )}
      {operation.kind === 'composite.invoke' && (
        <button
          className="authoring-primary"
          onClick={() => props.onOpenComposite(operation.compositeId)}
        >
          Open Composite
        </button>
      )}
      <div className="authoring-step-actions" aria-label="Step actions">
        <button onClick={() => props.onMove(operation.id, -1)}>↑ Move up</button>
        <button onClick={() => props.onMove(operation.id, 1)}>↓ Move down</button>
        <button className="danger" onClick={() => props.onDelete(operation.id)}>
          Delete step
        </button>
      </div>
      {props.advanced && (
        <details open>
          <summary>Semantic details</summary>
          <code>{operation.kind}</code>
          <small>ID · {operation.id}</small>
        </details>
      )}
    </section>
  );
}

function ReferencePicker(props: WorkspaceProps & { target: ReferenceTarget }) {
  const candidates = drawSourceCandidates(
    props.definition,
    props.target.sequenceId,
    props.target.index,
  );
  const groups: readonly { family: AuthoringCandidate['value']['family']; label: string }[] = [
    { family: 'resource', label: 'Game resources' },
    { family: 'flow', label: 'Flow values' },
    { family: 'runtime', label: 'Runtime' },
    { family: 'composite', label: 'Composite context' },
  ];
  return (
    <section className="authoring-reference-picker" aria-label="Choose Draw Card source">
      <button className="authoring-back" onClick={props.onCloseReference}>
        ← Step details
      </button>
      <span className="eyebrow">AVAILABLE HERE</span>
      <h3>Choose source</h3>
      <p>Draw Card needs a Deck of Cards.</p>
      {groups.map((group) => {
        const values = candidates.filter((item) => item.value.family === group.family);
        if (values.length === 0) return null;
        return (
          <section key={group.family}>
            <h4>{group.label}</h4>
            {values.map((candidate) => (
              <button
                key={candidate.value.id}
                disabled={!candidate.compatible}
                title={candidate.reason}
                onClick={() => props.onChooseReference(candidate)}
              >
                <strong>{candidate.value.label}</strong>
                <small>
                  {candidate.compatible ? '✓ Compatible' : `× ${candidate.reason ?? 'Unavailable'}`}
                </small>
              </button>
            ))}
          </section>
        );
      })}
    </section>
  );
}

function DiagnosticBanner({
  diagnostics,
  onUndo,
  canUndo,
}: {
  diagnostics: WorkspaceProps['diagnostics'];
  onUndo: () => void;
  canUndo: boolean;
}) {
  if (diagnostics.length === 0) return null;
  return (
    <section className="authoring-diagnostics" aria-label="Working copy diagnostics">
      <div>
        <strong>This draft needs attention</strong>
        <span>{diagnostics.length} issue(s) preserved in the working copy.</span>
      </div>
      <ul>
        {diagnostics.slice(0, 3).map((diagnostic, index) => (
          <li key={`${diagnostic.code}-${diagnostic.operationId ?? index}`}>
            {diagnostic.message}
          </li>
        ))}
      </ul>
      <button disabled={!canUndo} onClick={onUndo}>
        Undo last edit
      </button>
    </section>
  );
}

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="authoring-definition-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UsageList({ usages }: { usages: readonly string[] }) {
  return (
    <div className="authoring-usages">
      <span>Used by</span>
      {usages.length === 0 ? (
        <small>Not used in the current flow</small>
      ) : (
        <ul>
          {usages.map((usage, index) => (
            <li key={`${usage}-${index}`}>{usage}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function operationSummary(operation: Operation): string {
  switch (operation.kind) {
    case 'random.select':
      return 'Choose one participant from the running session.';
    case 'collection.draw':
      return 'Draw the first card from a game-owned deck.';
    case 'present':
      return 'Show a server-filtered message.';
    case 'input.wait':
      return operation.prompt;
    case 'time.wait':
      return `Wait ${operation.durationMs} logical ms.`;
    case 'control.foreach':
      return 'Repeat the contained flow for each player.';
    case 'control.if':
      return 'Choose exactly one structured branch.';
    case 'control.parallel':
      return 'Run restricted safe branches, then wait for all.';
    case 'composite.invoke':
      return 'Use a reusable structured flow.';
    case 'end':
      return 'Complete execution.';
    case 'set':
      return 'Update game state.';
    case 'collection.shuffle':
      return 'Shuffle a collection deterministically.';
    case 'sequence':
      return 'Run steps in order.';
  }
}

function initialValueLabel(value: VariableDeclaration['initial']): string {
  if (value === undefined) return 'Not initialized';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return 'Card';
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
