import { useMemo, useState } from 'react';
import {
  backReferenceNavigation,
  candidatesForInput,
  compositeForFixture,
  deleteWorkingCopyBlock,
  enterComposite,
  initialReferenceNavigation,
  initialReferenceWorkingCopy,
  navigateToReferenceSource,
  outlineForFixture,
  parentBinding,
  projectFixture,
  projectWorkingCopy,
  referenceFixtureByKey,
  referenceFixtures,
  scopeLabel,
  sourceForReference,
  typeLabel,
  valuesForFixture,
  workingCopyDiagnostics,
  type CompositeProjection,
  type LabCandidate,
  type LabInput,
  type LabNode,
  type LabValue,
  type ReferenceFixture,
  type ReferenceFixtureKey,
  type ReferenceNavigationState,
  type ReferenceVariant,
  type ReferenceViewport,
  type ReferenceWorkingCopy,
} from './reference-lab-model.js';

const variants: readonly {
  key: ReferenceVariant;
  label: string;
  question: string;
}[] = [
  {
    key: 'chips',
    label: 'Typed inline references',
    question: 'Can local type, identity, scope, and source preview provide enough provenance?',
  },
  {
    key: 'navigation',
    label: 'References + semantic navigation',
    question: 'Does reversible context navigation clarify distant and nested references?',
  },
];

const rubric = [
  ['Source discoverability', 'Explicit, noisy', 'Preview', 'Dedicated context'],
  ['Type clarity', 'Endpoint labels', 'Inline', 'Inline + source'],
  ['Same-type identity', 'Named endpoints', 'Named chip', 'Named chip'],
  ['Scope clarity', 'Endpoint labels', 'Inline label', 'Boundary + context'],
  ['Invalid explanation', 'Picker text', 'Picker text', 'Picker text'],
  ['Control readability', 'Overlay competes', 'Clear', 'Clear'],
  ['Visual clutter', 'High', 'Low', 'Low'],
  ['Multiple consumers', 'Many rows', 'Local', 'Local + source'],
  ['Long-flow scale', 'Weak', 'Strong', 'Strong'],
  ['Composite entry / exit', 'Not primary', 'Collapsed only', 'Focused + Back'],
  ['Context preservation', 'Not applicable', 'No transition', 'History-backed'],
  ['Desktop usability', 'Debug only', 'Strong', 'Strong'],
  ['Mobile usability', 'Known limitation', 'Strong', 'Strong'],
  ['Keyboard access', 'Toggle/list', 'Buttons', 'Buttons + focus'],
  ['Non-color dependence', 'Text + endpoints', 'Text', 'Text + context'],
  ['Outline parity', 'Same fixture', 'Same fixture', 'Same fixture'],
  ['Grouped parallel fit', 'Weak', 'Strong', 'Strong'],
] as const;

const manualTests = [
  ['1 · Same-type source', 'Switch Draw from Questions Deck to Challenges Deck.'],
  ['2 · Source tracing', 'Find where Current Player came from and who consumes it.'],
  ['3 · Composite', 'Enter Prepare Turn, follow Deck to its source, then return twice.'],
  ['4 · Mobile', 'Repeat the Composite task at 390 px without horizontal scrolling.'],
  ['5 · Deletion', 'Delete Choose Player, understand the dangling references, then reset.'],
] as const;

interface PickerState {
  readonly nodeId: string;
  readonly inputName: string;
}

interface InspectionState extends PickerState {
  readonly valueId: string;
}

export function ReferenceLab() {
  const [fixtureKey, setFixtureKey] = useState<ReferenceFixtureKey>('long-flow');
  const [variant, setVariant] = useState<ReferenceVariant>('chips');
  const [viewport, setViewport] = useState<ReferenceViewport>('desktop');
  const [projection, setProjection] = useState<CompositeProjection>('collapsed');
  const [showProvenance, setShowProvenance] = useState(false);
  const [navigation, setNavigation] = useState<ReferenceNavigationState>(() =>
    initialReferenceNavigation(),
  );
  const [workingCopy, setWorkingCopy] = useState<ReferenceWorkingCopy>(() =>
    initialReferenceWorkingCopy(),
  );
  const [picker, setPicker] = useState<PickerState>();
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState<InspectionState>();
  const [selection, setSelection] = useState<Readonly<Record<string, string>>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  const fixture = referenceFixtureByKey(fixtureKey);
  const composite = compositeForFixture(fixture);
  const activeCompositeId = navigation.context === 'composite' ? navigation.compositeId : undefined;
  const nodes = useMemo(
    () => projectWorkingCopy(fixture, workingCopy, activeCompositeId),
    [fixture, workingCopy, activeCompositeId],
  );
  const diagnostics = useMemo(
    () => [
      ...workingCopyDiagnostics(fixture, workingCopy),
      ...fixture.definition.composites.flatMap((item) =>
        workingCopyDiagnostics(fixture, workingCopy, item.id),
      ),
    ],
    [fixture, workingCopy],
  );
  const currentVariant = variants.find((item) => item.key === variant)!;
  const sourceContextValue =
    navigation.context === 'source' && navigation.sourceValueId
      ? sourceForReference(fixture, navigation.sourceValueId, navigation.sourceCompositeId)
      : undefined;

  const resetInteraction = (nextFixture: ReferenceFixture) => {
    setNavigation(initialReferenceNavigation());
    setWorkingCopy(initialReferenceWorkingCopy());
    setProjection('collapsed');
    setShowProvenance(false);
    setPicker(
      nextFixture.defaultInput
        ? {
            nodeId: nextFixture.defaultInput.nodeId,
            inputName: nextFixture.defaultInput.portName,
          }
        : undefined,
    );
    setInspection(undefined);
    setSelectedNodeId(undefined);
    setQuery('');
    setSelection({});
  };

  const chooseFixture = (key: ReferenceFixtureKey) => {
    const next = referenceFixtureByKey(key);
    setFixtureKey(key);
    resetInteraction(next);
  };

  const chooseVariant = (next: ReferenceVariant) => {
    setVariant(next);
    setNavigation(initialReferenceNavigation());
    setProjection('collapsed');
    setInspection(undefined);
    setPicker(undefined);
    setSelectedNodeId(undefined);
  };

  const selectedId = (node: LabNode, input: LabInput): string =>
    selection[selectionKey(activeCompositeId, node.id, input.name)] ?? input.selectedValueId;

  const inspect = (node: LabNode, input: LabInput) => {
    setSelectedNodeId(node.id);
    setInspection({
      nodeId: node.id,
      inputName: input.name,
      valueId: selectedId(node, input),
    });
    setPicker(undefined);
    focusSoon('reference-panel-heading');
  };

  const openPicker = (node: LabNode, input: LabInput) => {
    setSelectedNodeId(node.id);
    setPicker({ nodeId: node.id, inputName: input.name });
    setInspection(undefined);
    setQuery('');
  };

  const enter = (node: LabNode) => {
    if (variant !== 'navigation' || !node.compositeId) return;
    setNavigation((current) => enterComposite(current, node.compositeId!, node.id));
    setProjection('focused');
    setPicker(undefined);
    setInspection(undefined);
    setSelectedNodeId(undefined);
    focusSoon('reference-context-heading');
  };

  const back = () => {
    const next = backReferenceNavigation(navigation);
    setNavigation(next);
    setProjection(next.context === 'composite' ? 'focused' : 'collapsed');
    setInspection(undefined);
    setPicker(undefined);
    setSelectedNodeId(next.focusedNodeId);
    focusSoon(next.focusedNodeId ? `ref-node-${next.focusedNodeId}` : 'reference-context-heading');
  };

  const goToSource = (value: LabValue) => {
    setNavigation((current) => navigateToReferenceSource(fixture, current, value));
    setInspection(undefined);
    setPicker(undefined);
    setSelectedNodeId(undefined);
    focusSoon('reference-context-heading');
  };

  const revealSource = (value: LabValue) => {
    setNavigation((current) => ({ ...current, focusedNodeId: value.sourceNodeId }));
    setInspection(undefined);
    focusSoon(`ref-node-${value.sourceNodeId}`);
  };

  const deleteBlock = (node: LabNode) => {
    setWorkingCopy((current) => deleteWorkingCopyBlock(current, node.id));
    setSelectedNodeId(undefined);
    setInspection(undefined);
    setPicker(undefined);
    focusSoon('working-copy-status');
  };

  const resetWorkingCopy = () => {
    setWorkingCopy(initialReferenceWorkingCopy());
    setSelection({});
    setSelectedNodeId(undefined);
    setInspection(undefined);
    setPicker(undefined);
    focusSoon('working-copy-status');
  };

  const setProjectionMode = (next: CompositeProjection) => {
    setPicker(undefined);
    setInspection(undefined);
    setSelectedNodeId(undefined);
    if (next === 'focused' && composite && variant === 'navigation') {
      const invocation = projectFixture(fixture).find((node) => node.compositeId === composite.id);
      if (invocation) {
        setNavigation((current) => enterComposite(current, composite.id, invocation.id));
        setProjection('focused');
        focusSoon('reference-context-heading');
      }
      return;
    }
    setProjection(next);
    if (next === 'collapsed') setNavigation(initialReferenceNavigation());
  };

  const pickerNode = picker ? nodes.find((node) => node.id === picker.nodeId) : undefined;
  const pickerInput = pickerNode?.inputs.find((input) => input.name === picker?.inputName);
  const inspectedNode = inspection
    ? nodes.find((node) => node.id === inspection.nodeId)
    : undefined;
  const inspectedInput = inspectedNode?.inputs.find(
    (input) => input.name === inspection?.inputName,
  );
  const inspectedValue = inspection
    ? sourceForReference(fixture, inspection.valueId, activeCompositeId)
    : undefined;
  const hasPanel = Boolean((pickerNode && pickerInput) || inspectedValue);

  return (
    <main className="references-lab">
      <header className="topbar references-topbar">
        <div>
          <span className="eyebrow">VISUAL LAB · ISSUE #2 · REPAIR PASS</span>
          <h1>References without cable spaghetti</h1>
        </div>
        <nav aria-label="Lab navigation">
          <a href="/lab">All experiments</a>
          <a href="/lab/parallel">Parallel experiment</a>
          <a href="/">Studio</a>
        </nav>
      </header>

      <section className="references-hero">
        <div>
          <span className="experiment-kicker">TWO PRIMARY HYPOTHESES</span>
          <h2>Is local provenance enough—or should authors navigate?</h2>
          <p>
            Inline references keep authors in one flow. Semantic navigation deliberately replaces
            that flow with a focused Composite or source context, then restores it with Back.
          </p>
        </div>
        <div className="hypothesis-card">
          <span>HUMAN FEEDBACK DRIVES THIS PASS</span>
          <p>
            Calmer vertical flow, obvious source selection, real focused navigation, mobile width
            safety, consistent control arrows, and realistic working-copy deletion.
          </p>
        </div>
      </section>

      <section className="reference-controls" aria-label="Reference experiment controls">
        <ControlGroup label="Semantic fixture">
          {referenceFixtures.map((item) => (
            <button
              key={item.key}
              aria-pressed={fixtureKey === item.key}
              onClick={() => chooseFixture(item.key)}
            >
              {item.shortLabel}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Primary hypothesis">
          {variants.map((item) => (
            <button
              key={item.key}
              aria-pressed={variant === item.key}
              onClick={() => chooseVariant(item.key)}
            >
              {item.label}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Projection">
          {(['collapsed', 'focused', 'outline'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={projection === item}
              disabled={
                (item === 'focused' && !composite) ||
                (item === 'focused' && variant !== 'navigation')
              }
              title={
                item === 'focused' && variant !== 'navigation'
                  ? 'Focused semantic context belongs to the navigation hypothesis.'
                  : item === 'focused' && !composite
                    ? 'This fixture has no Composite.'
                    : undefined
              }
              onClick={() => setProjectionMode(item)}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Viewport and baseline">
          {(['desktop', 'mobile'] as const).map((item) => (
            <button key={item} aria-pressed={viewport === item} onClick={() => setViewport(item)}>
              {item === 'desktop' ? '▰ Desktop' : '▯ Mobile'}
            </button>
          ))}
          <button
            className="provenance-toggle"
            aria-pressed={showProvenance}
            onClick={() => setShowProvenance((shown) => !shown)}
          >
            Provenance overlay · {showProvenance ? 'On' : 'Off'}
          </button>
        </ControlGroup>
      </section>

      <section className="reference-meta">
        <div>
          <span className="eyebrow">FIXTURE</span>
          <h2>{fixture.definition.title}</h2>
          <p>{fixture.description}</p>
        </div>
        <div>
          <span className="eyebrow">PRIMARY QUESTION</span>
          <p>{currentVariant.question}</p>
        </div>
        <div>
          <span className="eyebrow">CONTEXT BEHAVIOR</span>
          <strong>
            {variant === 'chips' ? 'Stays in current flow' : 'History-backed navigation'}
          </strong>
          <p>
            {variant === 'chips'
              ? 'Inspect and change references locally; no semantic transition occurs.'
              : 'Enter Composite and Go to source replace the active editing context.'}
          </p>
        </div>
      </section>

      <section
        className={`reference-prototype repaired-reference-prototype viewport-${viewport}`}
        aria-label={`${currentVariant.label} reference prototype`}
      >
        <div className="reference-device-chrome" aria-hidden="true">
          <i />
          <span>
            {viewport === 'mobile' ? '390 px focused navigation' : 'Constrained desktop flow'}
          </span>
          <i />
        </div>
        <Breadcrumb
          fixture={fixture}
          navigation={navigation}
          compositeName={composite?.name}
          sourceName={sourceContextValue?.label}
          onBack={navigation.history.length ? back : undefined}
        />

        {projection === 'outline' ? (
          <Outline fixture={fixture} />
        ) : (
          <div className={`reference-workbench ${hasPanel ? 'has-panel' : ''}`}>
            <div className="reference-canvas-wrap">
              <WorkingCopyStatus
                workingCopy={workingCopy}
                diagnostics={diagnostics}
                onReset={resetWorkingCopy}
              />
              {navigation.context === 'source' && sourceContextValue ? (
                <SourceContextView
                  fixture={fixture}
                  value={sourceContextValue}
                  sourceCompositeId={navigation.sourceCompositeId}
                />
              ) : (
                <>
                  <ContextHeading
                    fixture={fixture}
                    compositeName={activeCompositeId ? composite?.name : undefined}
                    navigated={navigation.context === 'composite'}
                  />
                  {activeCompositeId && composite && (
                    <CompositeBoundary
                      fixture={fixture}
                      composite={composite}
                      onInspect={(portName) => {
                        const value = sourceForReference(fixture, portName, activeCompositeId);
                        if (value) {
                          setInspection({
                            nodeId: `${activeCompositeId}:boundary`,
                            inputName: portName,
                            valueId: portName,
                          });
                          focusSoon('reference-panel-heading');
                        }
                      }}
                    />
                  )}
                  {showProvenance && (
                    <ProvenanceOverlay
                      fixture={fixture}
                      nodes={nodes}
                      compositeId={activeCompositeId}
                      selection={selection}
                    />
                  )}
                  <FlowProjection
                    fixture={fixture}
                    nodes={nodes}
                    variant={variant}
                    activeCompositeId={activeCompositeId}
                    selection={selection}
                    selectedNodeId={selectedNodeId}
                    focusedNodeId={navigation.focusedNodeId}
                    onInspect={inspect}
                    onChoose={openPicker}
                    onSelect={(node) => {
                      setSelectedNodeId(node.id);
                      setInspection(undefined);
                      setPicker(undefined);
                    }}
                    onEnter={enter}
                    onDelete={deleteBlock}
                  />
                </>
              )}
            </div>

            {hasPanel && (
              <aside className="reference-side-panel" aria-label="Reference details">
                {pickerNode && pickerInput ? (
                  <CandidatePicker
                    fixture={fixture}
                    node={pickerNode}
                    input={pickerInput}
                    compositeId={activeCompositeId}
                    query={query}
                    onQuery={setQuery}
                    onSelect={(value) => {
                      setSelection((current) => ({
                        ...current,
                        [selectionKey(activeCompositeId, pickerNode.id, pickerInput.name)]:
                          value.id,
                      }));
                      setInspection({
                        nodeId: pickerNode.id,
                        inputName: pickerInput.name,
                        valueId: value.id,
                      });
                      setPicker(undefined);
                      focusSoon('reference-panel-heading');
                    }}
                    onClose={() => setPicker(undefined)}
                  />
                ) : inspectedValue ? (
                  <SourceInspector
                    fixture={fixture}
                    value={inspectedValue}
                    compositeId={activeCompositeId}
                    variant={variant}
                    consumerCount={
                      nodes.filter((node) =>
                        node.inputs.some((input) => selectedId(node, input) === inspectedValue.id),
                      ).length
                    }
                    canChange={Boolean(inspectedNode && inspectedInput)}
                    onChange={() => {
                      if (inspectedNode && inspectedInput)
                        openPicker(inspectedNode, inspectedInput);
                    }}
                    onGoToSource={() => goToSource(inspectedValue)}
                    onReveal={() => revealSource(inspectedValue)}
                    onClose={() => setInspection(undefined)}
                  />
                ) : null}
              </aside>
            )}
          </div>
        )}
      </section>

      <ManualRetest />
      <ParallelPreview />
      <Evaluation />
    </main>
  );
}

function WorkingCopyStatus({
  workingCopy,
  diagnostics,
  onReset,
}: {
  readonly workingCopy: ReferenceWorkingCopy;
  readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
  readonly onReset: () => void;
}) {
  const changed = workingCopy.deletedNodeIds.length > 0;
  return (
    <section
      id="working-copy-status"
      className={`working-copy-status ${changed ? 'is-dirty' : ''}`}
      tabIndex={-1}
      aria-label="Lab working copy status"
    >
      <div>
        <span>
          LAB WORKING COPY · {changed ? 'TEMPORARILY INVALID' : 'MATCHES CANONICAL FIXTURE'}
        </span>
        <strong>
          {changed
            ? `${workingCopy.deletedNodeIds.length} block removed · canonical source unchanged`
            : 'Safe to edit: all changes stay in this experiment'}
        </strong>
      </div>
      <button disabled={!changed} onClick={onReset}>
        Reset to canonical fixture
      </button>
      {diagnostics.length > 0 && (
        <ul aria-label="Working copy diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContextHeading({
  fixture,
  compositeName,
  navigated,
}: {
  readonly fixture: ReferenceFixture;
  readonly compositeName?: string | undefined;
  readonly navigated: boolean;
}) {
  return (
    <header className={`reference-context-heading ${navigated ? 'is-navigated' : ''}`}>
      <span>{navigated ? 'NAVIGATED SEMANTIC CONTEXT' : 'CURRENT FLOW CONTEXT'}</span>
      <h2 id="reference-context-heading" tabIndex={-1}>
        {compositeName ?? fixture.definition.title}
      </h2>
      <p>
        {navigated
          ? 'The parent flow is inactive. Only this Composite sub-flow is being edited.'
          : 'Control executes from top to bottom. Data references stay inside each consumer.'}
      </p>
    </header>
  );
}

function FlowProjection({
  fixture,
  nodes,
  variant,
  activeCompositeId,
  selection,
  selectedNodeId,
  focusedNodeId,
  onInspect,
  onChoose,
  onSelect,
  onEnter,
  onDelete,
}: {
  readonly fixture: ReferenceFixture;
  readonly nodes: readonly LabNode[];
  readonly variant: ReferenceVariant;
  readonly activeCompositeId?: string | undefined;
  readonly selection: Readonly<Record<string, string>>;
  readonly selectedNodeId?: string | undefined;
  readonly focusedNodeId?: string | undefined;
  readonly onInspect: (node: LabNode, input: LabInput) => void;
  readonly onChoose: (node: LabNode, input: LabInput) => void;
  readonly onSelect: (node: LabNode) => void;
  readonly onEnter: (node: LabNode) => void;
  readonly onDelete: (node: LabNode) => void;
}) {
  const values = valuesForFixture(fixture, activeCompositeId);
  const selectedId = (node: LabNode, input: LabInput) =>
    selection[selectionKey(activeCompositeId, node.id, input.name)] ?? input.selectedValueId;
  return (
    <div className="reference-flow">
      <div className="reference-source-row">
        <SourceGroup
          id="runtime-values"
          label="Runtime"
          values={values.filter((value) => value.scope === 'runtime')}
          focused={focusedNodeId === 'runtime-values'}
        />
        <SourceGroup
          id="game-values"
          label={activeCompositeId ? 'Composite ports' : 'Game values'}
          values={values.filter(
            (value) =>
              value.scope === 'game' ||
              value.scope === 'composite-input' ||
              value.scope === 'composite-output',
          )}
          focused={focusedNodeId === 'game-values'}
        />
      </div>
      <ol className="reference-control-flow" aria-label="Control flow, top to bottom">
        {nodes.map((node, index) => {
          const selected = node.id === selectedNodeId;
          return (
            <li key={node.id}>
              {index > 0 && (
                <span className="control-arrow" aria-label="Then">
                  <small>THEN</small>↓
                </span>
              )}
              <article
                id={`ref-node-${node.id}`}
                className={`reference-node ${selected ? 'is-selected' : ''} ${focusedNodeId === node.id ? 'source-focused' : ''}`}
                tabIndex={focusedNodeId === node.id ? 0 : -1}
              >
                <header>
                  <span>{String(index + 1).padStart(2, '0')} · CONTROL BLOCK</span>
                  <code>{node.operation.kind}</code>
                </header>
                <div className="node-title-row">
                  <div>
                    <h3>{node.label}</h3>
                    <p>{node.detail}</p>
                  </div>
                  <button
                    className="select-block"
                    aria-pressed={selected}
                    onClick={() => onSelect(node)}
                  >
                    {selected ? 'Selected' : 'Select block'}
                  </button>
                </div>
                <div className="node-ports">
                  {node.inputs.map((input) => {
                    const value = sourceForReference(
                      fixture,
                      selectedId(node, input),
                      activeCompositeId,
                    );
                    return value ? (
                      <div className="node-port" key={input.name}>
                        <span className="port-label">{input.label}</span>
                        <ReferenceChip
                          value={value}
                          inputLabel={input.label}
                          onClick={() => onInspect(node, input)}
                        />
                      </div>
                    ) : null;
                  })}
                  {node.outputIds.map((output) => {
                    const value = sourceForReference(fixture, output, activeCompositeId);
                    return value ? (
                      <div className="node-output" key={output}>
                        <span>OUTPUT</span>
                        <strong>{value.label}</strong>
                        <small>
                          {typeLabel(value.type)} · {scopeLabel(value.scope)}
                        </small>
                      </div>
                    ) : null;
                  })}
                </div>
                {selected && (
                  <div className="block-actions" aria-label={`Actions for ${node.label}`}>
                    <span>SELECTED BLOCK ACTIONS</span>
                    <div>
                      {node.inputs[0] && (
                        <button onClick={() => onChoose(node, node.inputs[0]!)}>
                          Change source
                        </button>
                      )}
                      {node.compositeId && variant === 'navigation' && (
                        <button className="enter-composite" onClick={() => onEnter(node)}>
                          Enter Composite
                        </button>
                      )}
                      {node.compositeId && variant === 'chips' && (
                        <small>Inline hypothesis keeps this Composite collapsed.</small>
                      )}
                      <button className="delete-block" onClick={() => onDelete(node)}>
                        Delete block
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ProvenanceOverlay({
  fixture,
  nodes,
  compositeId,
  selection,
}: {
  readonly fixture: ReferenceFixture;
  readonly nodes: readonly LabNode[];
  readonly compositeId?: string | undefined;
  readonly selection: Readonly<Record<string, string>>;
}) {
  const edges = nodes.flatMap((node) =>
    node.inputs.flatMap((input) => {
      const selected =
        selection[selectionKey(compositeId, node.id, input.name)] ?? input.selectedValueId;
      const source = sourceForReference(fixture, selected, compositeId);
      return source ? [{ source, node, input }] : [];
    }),
  );
  return (
    <aside className="provenance-overlay" aria-label="Provenance cable baseline">
      <header>
        <div>
          <span>DEBUG BASELINE · DATA REFERENCES</span>
          <strong>Provenance overlay</strong>
        </div>
        <small>Dashed cables are data—not execution order.</small>
      </header>
      <div className="provenance-edges">
        {edges.map((edge) => (
          <div className="provenance-edge" key={`${edge.node.id}-${edge.input.name}`}>
            <span className="data-endpoint source-endpoint">● SOURCE · {edge.source.label}</span>
            <i aria-hidden="true">
              <span>DATA</span>
            </i>
            <span className="data-endpoint consumer-endpoint">
              ◇ INPUT · {edge.node.label} / {edge.input.label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function ReferenceChip({
  value,
  inputLabel,
  onClick,
}: {
  readonly value: LabValue;
  readonly inputLabel: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={`reference-chip scope-${value.scope}`}
      onClick={onClick}
      aria-label={`Inspect ${value.label} reference for ${inputLabel}`}
    >
      <strong>{value.label}</strong>
      <span>{typeLabel(value.type)}</span>
      <small>{scopeLabel(value.scope)} · Inspect</small>
    </button>
  );
}

function SourceGroup({
  id,
  label,
  values,
  focused,
}: {
  readonly id: string;
  readonly label: string;
  readonly values: readonly LabValue[];
  readonly focused: boolean;
}) {
  if (!values.length) return null;
  return (
    <section
      id={`ref-node-${id}`}
      className={`reference-source-group ${focused ? 'source-focused' : ''}`}
      tabIndex={focused ? 0 : -1}
    >
      <span>{label}</span>
      <div>
        {values.map((value) => (
          <small key={value.id}>
            <strong>{value.label}</strong> · {typeLabel(value.type)}
          </small>
        ))}
      </div>
    </section>
  );
}

function CandidatePicker({
  fixture,
  node,
  input,
  compositeId,
  query,
  onQuery,
  onSelect,
  onClose,
}: {
  readonly fixture: ReferenceFixture;
  readonly node: LabNode;
  readonly input: LabInput;
  readonly compositeId?: string | undefined;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly onSelect: (value: LabValue) => void;
  readonly onClose: () => void;
}) {
  const candidates = candidatesForInput(fixture, node, input, query, compositeId);
  return (
    <div className="candidate-picker">
      <header>
        <div>
          <span className="eyebrow">
            {node.label.toUpperCase()} · {input.label}
          </span>
          <h3>Choose source</h3>
          <p>Requires {typeLabel(input.type)}</p>
        </div>
        <button aria-label="Close source picker" onClick={onClose}>
          ×
        </button>
      </header>
      <label>
        Search by name, type, or scope
        <input
          autoFocus
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search available values…"
        />
      </label>
      <CandidateGroup
        label="COMPATIBLE"
        candidates={candidates.filter((item) => item.compatible)}
        onSelect={onSelect}
      />
      <CandidateGroup
        label="UNAVAILABLE"
        candidates={candidates.filter((item) => !item.compatible)}
        onSelect={onSelect}
      />
      <p className="candidate-note">
        Compatibility uses Game IR TypeRef equality. Names identify values; they never override
        type.
      </p>
    </div>
  );
}

function CandidateGroup({
  label,
  candidates,
  onSelect,
}: {
  readonly label: string;
  readonly candidates: readonly LabCandidate[];
  readonly onSelect: (value: LabValue) => void;
}) {
  if (!candidates.length) return null;
  return (
    <section className="candidate-group">
      <h4>{label}</h4>
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <button
            key={candidate.value.id}
            disabled={!candidate.compatible}
            onClick={() => onSelect(candidate.value)}
          >
            <span>
              <strong>{candidate.value.label}</strong>
              <small>
                {typeLabel(candidate.value.type)} · {scopeLabel(candidate.value.scope)}
              </small>
            </span>
            <span className={candidate.compatible ? 'candidate-valid' : 'candidate-invalid'}>
              {candidate.compatible ? '✓ Compatible' : '× Unavailable'}
            </span>
            {!candidate.compatible && (
              <small className="candidate-reason">{candidate.reason}</small>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function SourceInspector({
  fixture,
  value,
  compositeId,
  variant,
  consumerCount,
  canChange,
  onChange,
  onGoToSource,
  onReveal,
  onClose,
}: {
  readonly fixture: ReferenceFixture;
  readonly value: LabValue;
  readonly compositeId?: string | undefined;
  readonly variant: ReferenceVariant;
  readonly consumerCount: number;
  readonly canChange: boolean;
  readonly onChange: () => void;
  readonly onGoToSource: () => void;
  readonly onReveal: () => void;
  readonly onClose: () => void;
}) {
  const parent =
    value.scope === 'composite-input' && compositeId
      ? parentBinding(fixture, compositeId, value.id)
      : undefined;
  return (
    <div className="source-inspector">
      <header>
        <div>
          <span className="eyebrow">SELECTED REFERENCE</span>
          <h3 id="reference-panel-heading" tabIndex={-1}>
            {value.label}
          </h3>
        </div>
        <button aria-label="Close reference details" onClick={onClose}>
          ×
        </button>
      </header>
      <div className={`context-effect context-effect-${variant}`}>
        {variant === 'chips'
          ? 'INLINE INSPECTION · semantic context will not change'
          : 'NAVIGATION AVAILABLE · Go to source opens another semantic context'}
      </div>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{typeLabel(value.type)}</dd>
        </div>
        <div>
          <dt>Valid here</dt>
          <dd>Yes · exact type match</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{scopeLabel(value.scope)}</dd>
        </div>
        <div>
          <dt>Produced by</dt>
          <dd>{value.sourceLabel}</dd>
        </div>
        <div>
          <dt>Uses here</dt>
          <dd>{consumerCount} in this working copy</dd>
        </div>
      </dl>
      {parent && (
        <div className="parent-binding-callout">
          <span>FROM PARENT SCOPE</span>
          <strong>{parent.label}</strong>
          <small>
            {typeLabel(parent.type)} · {scopeLabel(parent.scope)}
          </small>
        </div>
      )}
      <div className="inspector-actions">
        {canChange && <button onClick={onChange}>Change source</button>}
        {variant === 'navigation' ? (
          <button className="primary" onClick={onGoToSource}>
            Go to source
          </button>
        ) : (
          <button onClick={onReveal}>Temporarily highlight producer</button>
        )}
      </div>
    </div>
  );
}

function CompositeBoundary({
  fixture,
  composite,
  onInspect,
}: {
  readonly fixture: ReferenceFixture;
  readonly composite: NonNullable<ReturnType<typeof compositeForFixture>>;
  readonly onInspect: (portName: string) => void;
}) {
  return (
    <section id={`ref-node-${composite.id}:boundary`} className="composite-boundary">
      <div>
        <span className="eyebrow">DECLARED SCOPE BOUNDARY</span>
        <h3>{composite.name}</h3>
        <p>Only declared ports are visible. Parent values cross through explicit bindings.</p>
      </div>
      <div className="boundary-ports">
        {composite.inputs.map((port) => {
          const parent = parentBinding(fixture, composite.id, port.name);
          return (
            <button key={port.name} onClick={() => onInspect(port.name)}>
              <span>INPUT · {port.name}</span>
              <strong>{typeLabel(port.type)}</strong>
              <small>From parent: {parent?.label ?? 'unbound'} · Inspect</small>
            </button>
          );
        })}
        {composite.outputs.map((port) => (
          <div key={port.name}>
            <span>OUTPUT · {port.name}</span>
            <strong>{typeLabel(port.type)}</strong>
            <small>Returns to parent invocation</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceContextView({
  fixture,
  value,
  sourceCompositeId,
}: {
  readonly fixture: ReferenceFixture;
  readonly value: LabValue;
  readonly sourceCompositeId?: string | undefined;
}) {
  const consumers = projectFixture(fixture, sourceCompositeId).filter((node) =>
    node.inputs.some((input) => input.selectedValueId === value.id),
  );
  return (
    <section className="source-context-view" aria-label={`Source context for ${value.label}`}>
      <span>NAVIGATED SEMANTIC CONTEXT · SOURCE</span>
      <h2 id="reference-context-heading" tabIndex={-1}>
        {value.label}
      </h2>
      <p>The prior flow is inactive. Back returns to the exact reference inspection context.</p>
      <article>
        <header>
          <span>VALUE SOURCE</span>
          <strong>{typeLabel(value.type)}</strong>
        </header>
        <h3>{value.label}</h3>
        <dl>
          <div>
            <dt>Semantic scope</dt>
            <dd>{scopeLabel(value.scope)}</dd>
          </div>
          <div>
            <dt>Produced by</dt>
            <dd>{value.sourceLabel}</dd>
          </div>
          <div>
            <dt>Source identifier</dt>
            <dd>{value.id}</dd>
          </div>
        </dl>
      </article>
      <div className="source-consumers">
        <span>KNOWN CONSUMERS IN THIS CONTEXT</span>
        {consumers.length ? (
          <ul>
            {consumers.map((node) => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        ) : (
          <p>No other canonical consumers in this context.</p>
        )}
      </div>
    </section>
  );
}

function Breadcrumb({
  fixture,
  navigation,
  compositeName,
  sourceName,
  onBack,
}: {
  readonly fixture: ReferenceFixture;
  readonly navigation: ReferenceNavigationState;
  readonly compositeName?: string | undefined;
  readonly sourceName?: string | undefined;
  readonly onBack?: (() => void) | undefined;
}) {
  const current =
    navigation.context === 'composite'
      ? compositeName
      : navigation.context === 'source'
        ? sourceName
        : undefined;
  return (
    <nav className="semantic-breadcrumb" aria-label="Semantic location">
      {onBack && (
        <button id="semantic-back" onClick={onBack}>
          ← Back
        </button>
      )}
      <ol>
        <li>Game</li>
        <li aria-current={current ? undefined : 'page'}>{fixture.definition.title}</li>
        {current && <li aria-current="page">{current}</li>}
      </ol>
      <span>
        {navigation.context === 'source'
          ? 'Source context'
          : navigation.context === 'composite'
            ? 'Focused Composite'
            : 'Parent flow'}
      </span>
    </nav>
  );
}

function Outline({ fixture }: { readonly fixture: ReferenceFixture }) {
  return (
    <section className="reference-outline" aria-label={`Outline · ${fixture.definition.title}`}>
      <header>
        <span className="eyebrow">ACCESSIBLE / DEBUG PROJECTION</span>
        <h3>Same semantic fixture, no canvas geometry</h3>
      </header>
      <pre>{outlineForFixture(fixture).join('\n')}</pre>
    </section>
  );
}

function ManualRetest() {
  return (
    <section className="manual-retest">
      <div>
        <span className="eyebrow">STRUCTURED HUMAN INSPECTION · NOT FORMAL RESEARCH</span>
        <h2>Five tasks for the next review</h2>
        <p>
          Try each without reading implementation notes. Record hesitation, wrong turns, and
          overflow.
        </p>
      </div>
      <ol>
        {manualTests.map(([title, instruction]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{instruction}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ParallelPreview() {
  return (
    <section className="parallel-reference-preview">
      <div>
        <span className="eyebrow">PRESENTATION STRESS PREVIEW — NOT EXECUTABLE IR V1</span>
        <h2>Grouped parallel compatibility check</h2>
        <p>Kept unchanged in scope: collapsed branch cards expose typed bindings.</p>
      </div>
      <div className="parallel-reference-group">
        <header>
          <strong>Parallel · wait for all</strong>
          <span>3 collapsed sub-flows</span>
        </header>
        {['Player A', 'Player B', 'Player C'].map((player) => (
          <article key={player}>
            <span>{player} · Prepare Turn</span>
            <small>PLAYER · Participant · {player}</small>
            <small>DECK · Collection&lt;Card&gt; · Questions Deck</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Evaluation() {
  return (
    <section className="reference-evaluation">
      <div>
        <span className="eyebrow">REPAIRED COMPARISON</span>
        <h2>Evidence rubric</h2>
        <p>The overlay is now a debug baseline; only inline and navigation remain candidates.</p>
      </div>
      <div className="reference-rubric-scroll">
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Provenance overlay</th>
              <th>Inline</th>
              <th>Navigation</th>
            </tr>
          </thead>
          <tbody>
            {rubric.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="reference-recommendation">
        <span>STATUS AFTER REPAIR</span>
        <strong>TWO DISTINCT HYPOTHESES · HUMAN RETEST REQUIRED</strong>
        <p>Do not adopt until this pass is cross-checked with the richer Issue #1 flow.</p>
      </div>
    </section>
  );
}

function ControlGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

function selectionKey(compositeId: string | undefined, nodeId: string, inputName: string): string {
  return `${compositeId ?? 'parent'}:${nodeId}:${inputName}`;
}

function focusSoon(id: string): void {
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}
