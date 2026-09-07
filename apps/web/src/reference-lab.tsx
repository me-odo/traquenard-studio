import { useEffect, useMemo, useState } from 'react';
import {
  addWorkingCopyBlock,
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
  workingCopyDiagnostics,
  type LabCandidate,
  type LabInput,
  type LabNode,
  type LabValue,
  type ReferenceFixture,
  type ReferenceFixtureKey,
  type ReferenceLabStepKind,
  type ReferenceNavigationState,
  type ReferenceViewport,
  type ReferenceWorkingCopy,
} from './reference-lab-model.js';

interface PickerState {
  readonly nodeId: string;
  readonly inputName: string;
}

interface InspectionState extends PickerState {
  readonly valueId: string;
}

const evidenceRows = [
  ['Typed references', 'The normal local representation at every non-literal input.'],
  [
    'Semantic navigation',
    'An explicit capability: inspect locally, then Go to source or enter a Composite.',
  ],
  ['Trace overlay', 'An optional provenance aid, never the primary editor grammar.'],
] as const;

export function ReferenceLab() {
  const [fixtureKey, setFixtureKey] = useState<ReferenceFixtureKey>('composite');
  const [viewport, setViewport] = useState<ReferenceViewport>('desktop');
  const [showProvenance, setShowProvenance] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [narrowBrowser, setNarrowBrowser] = useState(() => window.innerWidth <= 650);
  const [navigation, setNavigation] = useState<ReferenceNavigationState>(() =>
    initialReferenceNavigation(),
  );
  const [workingCopy, setWorkingCopy] = useState<ReferenceWorkingCopy>(() =>
    initialReferenceWorkingCopy(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [inspection, setInspection] = useState<InspectionState>();
  const [inspectionBeforeNavigation, setInspectionBeforeNavigation] = useState<InspectionState>();
  const [picker, setPicker] = useState<PickerState>();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Readonly<Record<string, string>>>({});
  const [addOpen, setAddOpen] = useState(false);

  const fixture = referenceFixtureByKey(fixtureKey);
  const activeCompositeId = navigation.context === 'composite' ? navigation.compositeId : undefined;
  const composite = activeCompositeId
    ? fixture.definition.composites.find((item) => item.id === activeCompositeId)
    : compositeForFixture(fixture);
  const nodes = useMemo(
    () => projectWorkingCopy(fixture, workingCopy, activeCompositeId),
    [activeCompositeId, fixture, workingCopy],
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
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
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
  const sourceContextValue =
    navigation.context === 'source' && navigation.sourceValueId
      ? sourceForReference(fixture, navigation.sourceValueId, navigation.sourceCompositeId)
      : undefined;
  const mobile = viewport === 'mobile' || narrowBrowser;
  const workingCopyChanged =
    workingCopy.deletedNodeIds.length > 0 || workingCopy.addedNodes.length > 0;

  useEffect(() => {
    const updateViewport = () => setNarrowBrowser(window.innerWidth <= 650);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const selectionKey = (node: LabNode, input: LabInput) =>
    `${activeCompositeId ?? 'parent'}:${node.id}:${input.name}`;
  const selectedValueId = (node: LabNode, input: LabInput) =>
    selection[selectionKey(node, input)] ?? input.selectedValueId;

  const resetScreens = () => {
    setNavigation(initialReferenceNavigation());
    setSelectedNodeId(undefined);
    setInspection(undefined);
    setInspectionBeforeNavigation(undefined);
    setPicker(undefined);
    setAddOpen(false);
    setQuery('');
  };

  const chooseFixture = (key: ReferenceFixtureKey) => {
    setFixtureKey(key);
    setWorkingCopy(initialReferenceWorkingCopy());
    setSelection({});
    setShowOutline(false);
    resetScreens();
    closeExperimentSettings();
  };

  const selectNode = (node: LabNode) => {
    setSelectedNodeId(node.id);
    setInspection(undefined);
    setPicker(undefined);
    setAddOpen(false);
  };

  const inspectInput = (node: LabNode, input: LabInput) => {
    setSelectedNodeId(node.id);
    setInspection({
      nodeId: node.id,
      inputName: input.name,
      valueId: selectedValueId(node, input),
    });
    setPicker(undefined);
    focusSoon('reference-panel-heading');
  };

  const inspectOutput = (node: LabNode, valueId: string) => {
    setSelectedNodeId(node.id);
    setInspection({ nodeId: node.id, inputName: '__output', valueId });
    setPicker(undefined);
    focusSoon('reference-panel-heading');
  };

  const openPicker = (node: LabNode, input: LabInput) => {
    setPicker({ nodeId: node.id, inputName: input.name });
    setQuery('');
    focusSoon('source-picker-heading');
  };

  const enter = (node: LabNode) => {
    if (!node.compositeId) return;
    setNavigation((current) => enterComposite(current, node.compositeId!, node.id));
    setSelectedNodeId(undefined);
    setInspection(undefined);
    setPicker(undefined);
    focusSoon('reference-context-heading');
  };

  const goToSource = (value: LabValue) => {
    setInspectionBeforeNavigation(inspection);
    setNavigation((current) => navigateToReferenceSource(fixture, current, value));
    setInspection(undefined);
    setPicker(undefined);
    focusSoon('reference-context-heading');
  };

  const semanticBack = () => {
    const wasSource = navigation.context === 'source';
    const next = backReferenceNavigation(navigation);
    setNavigation(next);
    setSelectedNodeId(next.focusedNodeId);
    if (wasSource && inspectionBeforeNavigation) {
      setSelectedNodeId(inspectionBeforeNavigation.nodeId);
      setInspection(inspectionBeforeNavigation);
      setInspectionBeforeNavigation(undefined);
      focusSoon('reference-panel-heading');
    } else {
      setInspection(undefined);
      focusSoon(
        next.focusedNodeId ? `ref-node-${next.focusedNodeId}` : 'reference-context-heading',
      );
    }
  };

  const screenBack = () => {
    if (
      navigation.context === 'source' ||
      (navigation.context === 'composite' && !selectedNodeId)
    ) {
      semanticBack();
    } else if (picker) {
      setPicker(undefined);
      focusSoon('reference-panel-heading');
    } else if (inspection) {
      setInspection(undefined);
      focusSoon(`ref-node-${inspection.nodeId}`);
    } else if (addOpen) {
      setAddOpen(false);
      focusSoon('add-step');
    } else {
      setSelectedNodeId(undefined);
      focusSoon('reference-context-heading');
    }
  };

  const deleteBlock = (node: LabNode) => {
    setWorkingCopy((current) => deleteWorkingCopyBlock(current, node.id));
    setSelectedNodeId(undefined);
    setInspection(undefined);
    setPicker(undefined);
    focusSoon('working-copy-status');
  };

  const addBlock = (kind: ReferenceLabStepKind) => {
    setWorkingCopy((current) => addWorkingCopyBlock(current, kind, activeCompositeId));
    setAddOpen(false);
    focusSoon('working-copy-status');
  };

  const resetWorkingCopy = () => {
    setWorkingCopy(initialReferenceWorkingCopy());
    setSelection({});
    resetScreens();
    focusSoon('working-copy-status');
  };

  const mobileScreen =
    navigation.context === 'source'
      ? 'source'
      : pickerNode && pickerInput
        ? 'picker'
        : inspectedValue
          ? 'reference'
          : addOpen
            ? 'add'
            : selectedNode
              ? 'block'
              : 'flow';

  const commonProps: EditorProps = {
    fixture,
    nodes,
    ...(selectedNode ? { selectedNode } : {}),
    ...(inspectedValue ? { inspectedValue } : {}),
    ...(inspectedInput ? { inspectedInput } : {}),
    ...(pickerNode ? { pickerNode } : {}),
    ...(pickerInput ? { pickerInput } : {}),
    ...(activeCompositeId ? { activeCompositeId } : {}),
    ...(composite ? { composite } : {}),
    query,
    selection,
    diagnostics,
    workingCopy,
    showProvenance,
    selectedValueId,
    onSelect: selectNode,
    onInspect: inspectInput,
    onInspectOutput: inspectOutput,
    onOpenPicker: openPicker,
    onCandidate: (value) => {
      if (!pickerNode || !pickerInput) return;
      setSelection((current) => ({
        ...current,
        [selectionKey(pickerNode, pickerInput)]: value.id,
      }));
      setInspection({
        nodeId: pickerNode.id,
        inputName: pickerInput.name,
        valueId: value.id,
      });
      setPicker(undefined);
    },
    onQuery: setQuery,
    onEnter: enter,
    onDelete: deleteBlock,
    onGoToSource: goToSource,
    onAddOpen: () => setAddOpen(true),
    onAdd: addBlock,
    onReset: resetWorkingCopy,
    ...(sourceContextValue ? { sourceContextValue } : {}),
    ...(navigation.sourceCompositeId ? { sourceCompositeId: navigation.sourceCompositeId } : {}),
  };

  return (
    <main className="references-lab editor-first-reference-lab">
      <header className="topbar references-topbar">
        <div>
          <span className="eyebrow">VISUAL LAB · ISSUE #2</span>
          <h1>Reference editor</h1>
        </div>
        <nav aria-label="Lab navigation">
          <a href="/lab">Experiments</a>
          <a href="/">Studio</a>
        </nav>
      </header>

      <div className="reference-editor-shell">
        <header className="reference-editor-title">
          <div>
            <span>GAME</span>
            <h2>{fixture.definition.title}</h2>
          </div>
          <details className="experiment-settings">
            <summary>Experiment settings</summary>
            <div>
              <ControlGroup label="Example game">
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
              <ControlGroup label="Preview">
                {(['desktop', 'mobile'] as const).map((item) => (
                  <button
                    key={item}
                    aria-pressed={viewport === item}
                    onClick={() => {
                      setViewport(item);
                      closeExperimentSettings();
                    }}
                  >
                    {item === 'desktop' ? 'Desktop' : 'Mobile · 390 px'}
                  </button>
                ))}
                <button
                  aria-pressed={showProvenance}
                  onClick={() => setShowProvenance((shown) => !shown)}
                >
                  Show reference traces · {showProvenance ? 'On' : 'Off'}
                </button>
                <button
                  aria-pressed={showOutline}
                  onClick={() => setShowOutline((shown) => !shown)}
                >
                  Semantic outline · {showOutline ? 'On' : 'Off'}
                </button>
              </ControlGroup>
              <button disabled={!workingCopyChanged} onClick={resetWorkingCopy}>
                Reset working copy
              </button>
            </div>
          </details>
        </header>

        <section
          className={`reference-prototype editor-reference-prototype viewport-${mobile ? 'mobile' : viewport}`}
          aria-label="Scoped reference editor prototype"
        >
          <AppBreadcrumb
            fixture={fixture}
            navigation={navigation}
            mobileScreen={mobileScreen}
            {...(selectedNode ? { selectedNode } : {})}
            {...(inspectedValue ? { inspectedValue } : {})}
            {...(mobile && mobileScreen !== 'flow'
              ? { onBack: screenBack }
              : navigation.history.length
                ? { onBack: semanticBack }
                : {})}
          />

          {showOutline ? (
            <Outline fixture={fixture} />
          ) : mobile ? (
            <MobileScreen {...commonProps} screen={mobileScreen} />
          ) : (
            <DesktopEditor
              {...commonProps}
              addOpen={addOpen}
              onClosePanel={() => {
                setInspection(undefined);
                setPicker(undefined);
              }}
              onAddOpen={() => setAddOpen((shown) => !shown)}
            />
          )}
        </section>

        <details className="experiment-evidence">
          <summary>Experiment evidence</summary>
          <div>
            <section>
              <span>FALSIFIABLE HYPOTHESIS</span>
              <h3>Authors can understand and edit references without persistent cables.</h3>
              <p>
                A first-time reviewer should discover block selection, add/delete, reference
                replacement, and reversible Composite/source navigation without reading research
                instructions first.
              </p>
            </section>
            <section className="evidence-layers">
              {evidenceRows.map(([name, description]) => (
                <article key={name}>
                  <strong>{name}</strong>
                  <p>{description}</p>
                </article>
              ))}
            </section>
            <section>
              <span>HUMAN REVIEW REFRAME</span>
              <p>
                The previous dashboard was too cognitively heavy: instrumentation obscured the
                editor, engine vocabulary dominated game language, and mobile panels did not form a
                genuine navigation stack. The grouped-parallel cross-check remains future work
                tracked by Issues #1 and #2.
              </p>
            </section>
          </div>
        </details>
      </div>
    </main>
  );
}

interface EditorProps {
  readonly fixture: ReferenceFixture;
  readonly nodes: readonly LabNode[];
  readonly selectedNode?: LabNode;
  readonly inspectedValue?: LabValue;
  readonly inspectedInput?: LabInput;
  readonly pickerNode?: LabNode;
  readonly pickerInput?: LabInput;
  readonly activeCompositeId?: string;
  readonly composite?: ReturnType<typeof compositeForFixture>;
  readonly query: string;
  readonly selection: Readonly<Record<string, string>>;
  readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
  readonly workingCopy: ReferenceWorkingCopy;
  readonly showProvenance: boolean;
  readonly selectedValueId: (node: LabNode, input: LabInput) => string;
  readonly onSelect: (node: LabNode) => void;
  readonly onInspect: (node: LabNode, input: LabInput) => void;
  readonly onInspectOutput: (node: LabNode, valueId: string) => void;
  readonly onOpenPicker: (node: LabNode, input: LabInput) => void;
  readonly onCandidate: (value: LabValue) => void;
  readonly onQuery: (query: string) => void;
  readonly onEnter: (node: LabNode) => void;
  readonly onDelete: (node: LabNode) => void;
  readonly onGoToSource: (value: LabValue) => void;
  readonly onAddOpen: () => void;
  readonly onAdd: (kind: ReferenceLabStepKind) => void;
  readonly onReset: () => void;
  readonly sourceContextValue?: LabValue;
  readonly sourceCompositeId?: string;
}

function DesktopEditor(
  props: EditorProps & { readonly addOpen: boolean; readonly onClosePanel: () => void },
) {
  const panelOpen = Boolean(props.pickerNode || props.inspectedValue);
  if (props.sourceContextValue) {
    return (
      <div className="editor-workbench">
        <SourceContextView
          fixture={props.fixture}
          value={props.sourceContextValue}
          {...(props.sourceCompositeId ? { sourceCompositeId: props.sourceCompositeId } : {})}
        />
      </div>
    );
  }
  return (
    <div className={`editor-workbench ${panelOpen ? 'has-panel' : ''}`}>
      <div className="editor-canvas">
        <EditorStatus {...props} />
        <ContextHeading
          fixture={props.fixture}
          {...(props.activeCompositeId && props.composite
            ? { compositeName: props.composite.name }
            : {})}
        />
        {props.activeCompositeId && props.composite && (
          <CompositePorts fixture={props.fixture} composite={props.composite} />
        )}
        {props.showProvenance && <TraceOverlay {...props} />}
        <Flow {...props} />
        <AddStep open={props.addOpen} onOpen={props.onAddOpen} onAdd={props.onAdd} />
      </div>
      {panelOpen && (
        <aside className="editor-panel" aria-label="Reference details">
          {props.pickerNode && props.pickerInput ? (
            <CandidatePicker
              {...props}
              node={props.pickerNode}
              input={props.pickerInput}
              onClose={props.onClosePanel}
            />
          ) : props.inspectedValue ? (
            <SourceInspector
              {...props}
              value={props.inspectedValue}
              canChange={Boolean(props.inspectedInput)}
              onChange={() => {
                const node = props.selectedNode;
                if (node && props.inspectedInput) props.onOpenPicker(node, props.inspectedInput);
              }}
              onClose={props.onClosePanel}
            />
          ) : null}
        </aside>
      )}
    </div>
  );
}

function MobileScreen(props: EditorProps & { readonly screen: string }) {
  switch (props.screen) {
    case 'source':
      return props.sourceContextValue ? (
        <SourceContextView
          fixture={props.fixture}
          value={props.sourceContextValue}
          {...(props.sourceCompositeId ? { sourceCompositeId: props.sourceCompositeId } : {})}
        />
      ) : null;
    case 'picker':
      return props.pickerNode && props.pickerInput ? (
        <CandidatePicker {...props} node={props.pickerNode} input={props.pickerInput} />
      ) : null;
    case 'reference':
      return props.inspectedValue ? (
        <SourceInspector
          {...props}
          value={props.inspectedValue}
          canChange={Boolean(props.inspectedInput)}
          onChange={() => {
            if (props.selectedNode && props.inspectedInput)
              props.onOpenPicker(props.selectedNode, props.inspectedInput);
          }}
        />
      ) : null;
    case 'add':
      return <AddStep open onOpen={props.onAddOpen} onAdd={props.onAdd} />;
    case 'block':
      return props.selectedNode ? <BlockEditor {...props} node={props.selectedNode} /> : null;
    default:
      return (
        <div className="mobile-flow-screen">
          <EditorStatus {...props} />
          <ContextHeading
            fixture={props.fixture}
            {...(props.activeCompositeId && props.composite
              ? { compositeName: props.composite.name }
              : {})}
          />
          {props.activeCompositeId && props.composite && (
            <CompositePorts fixture={props.fixture} composite={props.composite} />
          )}
          {props.showProvenance && <TraceOverlay {...props} />}
          <Flow {...props} />
          <AddStep open={false} onOpen={props.onAddOpen} onAdd={props.onAdd} />
        </div>
      );
  }
}

function EditorStatus(props: Pick<EditorProps, 'workingCopy' | 'diagnostics' | 'onReset'>) {
  const changed = props.workingCopy.deletedNodeIds.length + props.workingCopy.addedNodes.length > 0;
  if (!changed && props.diagnostics.length === 0) return null;
  return (
    <section id="working-copy-status" className="editor-diagnostics" tabIndex={-1}>
      <div>
        <strong>
          {props.diagnostics.some((item) => item.code === 'dangling_reference')
            ? 'This draft needs attention'
            : 'Working copy changed'}
        </strong>
        <button onClick={props.onReset}>Reset</button>
      </div>
      {props.diagnostics.length > 0 && (
        <ul aria-label="Working copy diagnostics">
          {props.diagnostics.map((item, index) => (
            <li key={`${item.code}-${index}`}>{item.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContextHeading({
  fixture,
  compositeName,
}: {
  readonly fixture: ReferenceFixture;
  readonly compositeName?: string;
}) {
  return (
    <header className="editor-context-heading">
      <span>{compositeName ? 'COMPOSITE' : 'FLOW'}</span>
      <h2 id="reference-context-heading" tabIndex={-1}>
        {compositeName ?? fixture.definition.title}
      </h2>
      {compositeName && <p>Editing this reusable sub-flow.</p>}
    </header>
  );
}

function Flow(props: EditorProps) {
  return (
    <ol className="editor-flow" aria-label="Game flow, top to bottom">
      {props.nodes.map((node, index) => (
        <li key={node.id}>
          {index > 0 && <span className="editor-connector" aria-hidden="true" />}
          <NodeCard {...props} node={node} />
        </li>
      ))}
    </ol>
  );
}

function NodeCard(props: EditorProps & { readonly node: LabNode }) {
  const { node } = props;
  const selected = props.selectedNode?.id === node.id;
  return (
    <article
      id={`ref-node-${node.id}`}
      className={`editor-node ${selected ? 'is-selected' : ''}`}
      tabIndex={0}
      aria-label={`${node.label} step${selected ? ', selected' : ''}`}
      onClick={() => props.onSelect(node)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
          return;
        event.preventDefault();
        props.onSelect(node);
      }}
    >
      <div className="editor-node-heading">
        <h3>{node.label}</h3>
        {node.compositeId && <span>Composite</span>}
      </div>
      <NodeFields {...props} node={node} />
      {selected && <BlockActions {...props} node={node} />}
    </article>
  );
}

function NodeFields(props: EditorProps & { readonly node: LabNode }) {
  return (
    <div className="editor-fields">
      {props.node.inputs.map((input) => {
        const value = sourceForReference(
          props.fixture,
          props.selectedValueId(props.node, input),
          props.activeCompositeId,
        );
        return value ? (
          <div className="editor-field" key={input.name}>
            <span>{friendlyInputLabel(input.label)}</span>
            <ReferenceChip
              value={value}
              inputLabel={input.label}
              onClick={() => props.onInspect(props.node, input)}
            />
          </div>
        ) : null;
      })}
      {props.node.operation.kind === 'time.wait' && (
        <div className="editor-literal">
          <span>Duration</span>
          <strong>{formatDuration(props.node.operation.durationMs)}</strong>
        </div>
      )}
      {props.node.operation.kind === 'present' &&
        props.node.operation.message.kind === 'literal' && (
          <div className="editor-literal">
            <span>Message</span>
            <strong>
              {typeof props.node.operation.message.value === 'string'
                ? props.node.operation.message.value
                : 'Public message'}
            </strong>
          </div>
        )}
      {props.node.operation.kind === 'input.wait' && (
        <div className="editor-literal">
          <span>Prompt</span>
          <strong>{props.node.operation.prompt}</strong>
        </div>
      )}
      {props.node.outputIds.map((output) => {
        const value = sourceForReference(props.fixture, output, props.activeCompositeId);
        return value ? (
          <div className="editor-result" key={output}>
            <span>Result</span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                props.onInspectOutput(props.node, value.id);
              }}
            >
              [{value.label}]
            </button>
          </div>
        ) : null;
      })}
    </div>
  );
}

function BlockEditor(props: EditorProps & { readonly node: LabNode }) {
  return (
    <section className="mobile-block-editor" aria-label={`Editing ${props.node.label}`}>
      <span>STEP</span>
      <h2>{props.node.label}</h2>
      <NodeFields {...props} />
      <BlockActions {...props} />
    </section>
  );
}

function BlockActions(props: EditorProps & { readonly node: LabNode }) {
  return (
    <div className="editor-block-actions" onClick={(event) => event.stopPropagation()}>
      {props.node.compositeId && (
        <button className="primary" onClick={() => props.onEnter(props.node)}>
          Enter Composite
        </button>
      )}
      <button className="danger" onClick={() => props.onDelete(props.node)}>
        Delete step
      </button>
      <details>
        <summary>Technical details</summary>
        <dl>
          <div>
            <dt>Operation</dt>
            <dd>{props.node.operation.kind}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{props.node.id}</dd>
          </div>
        </dl>
      </details>
    </div>
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
      className="editor-reference-chip"
      aria-label={`Inspect ${value.label} reference for ${inputLabel}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <strong>{value.label}</strong>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function SourceInspector(
  props: EditorProps & {
    readonly value: LabValue;
    readonly canChange: boolean;
    readonly onChange: () => void;
    readonly onClose?: () => void;
  },
) {
  const consumers = projectWorkingCopy(
    props.fixture,
    props.workingCopy,
    props.activeCompositeId,
  ).filter((node) =>
    node.inputs.some((input) => props.selectedValueId(node, input) === props.value.id),
  );
  return (
    <section
      className="editor-reference-inspector"
      aria-label={`Reference inspector for ${props.value.label}`}
    >
      <header>
        <div>
          <span>REFERENCE</span>
          <h2 id="reference-panel-heading" tabIndex={-1}>
            {props.value.label}
          </h2>
        </div>
        {props.onClose && (
          <button aria-label="Close reference inspector" onClick={props.onClose}>
            ×
          </button>
        )}
      </header>
      <p className="editor-type">{typeLabel(props.value.type)}</p>
      <dl>
        <div>
          <dt>Produced by</dt>
          <dd>{props.value.sourceLabel}</dd>
        </div>
        <div>
          <dt>Used by</dt>
          <dd>
            {consumers.length
              ? consumers.map((node) => node.label).join(', ')
              : 'No steps in this view'}
          </dd>
        </div>
      </dl>
      <div className="editor-panel-actions">
        {props.canChange && <button onClick={props.onChange}>Change source</button>}
        <button className="primary" onClick={() => props.onGoToSource(props.value)}>
          Go to source
        </button>
      </div>
      <details className="editor-technical-details">
        <summary>Type, scope, and identifier</summary>
        <dl>
          <div>
            <dt>Type</dt>
            <dd>{typeLabel(props.value.type)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{scopeLabel(props.value.scope)}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{props.value.id}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

function CandidatePicker(
  props: EditorProps & {
    readonly node: LabNode;
    readonly input: LabInput;
    readonly onClose?: () => void;
  },
) {
  const candidates = candidatesForInput(
    props.fixture,
    props.node,
    props.input,
    props.query,
    props.activeCompositeId,
  );
  return (
    <section className="editor-source-picker" aria-label={`Choose source for ${props.input.label}`}>
      <header>
        <div>
          <span>{friendlyInputLabel(props.input.label)}</span>
          <h2 id="source-picker-heading" tabIndex={-1}>
            Choose source
          </h2>
        </div>
        {props.onClose && (
          <button aria-label="Close source picker" onClick={props.onClose}>
            ×
          </button>
        )}
      </header>
      <label>
        Search
        <input
          autoFocus
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          placeholder="Search values…"
        />
      </label>
      <CandidateGroup
        label="Compatible"
        candidates={candidates.filter((item) => item.compatible)}
        onSelect={props.onCandidate}
      />
      <CandidateGroup
        label="Unavailable"
        candidates={candidates.filter((item) => !item.compatible)}
        onSelect={props.onCandidate}
      />
    </section>
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
    <section className="editor-candidate-group">
      <h3>{label}</h3>
      <div>
        {candidates.map((candidate) => (
          <button
            key={candidate.value.id}
            aria-label={`${candidate.value.label} · ${candidate.compatible ? 'Compatible' : 'Unavailable'}`}
            disabled={!candidate.compatible}
            onClick={() => onSelect(candidate.value)}
          >
            <strong>{candidate.value.label}</strong>
            <span>{typeLabel(candidate.value.type)}</span>
            {candidate.reason && <small>{candidate.reason}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

function AddStep({
  open,
  onOpen,
  onAdd,
}: {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onAdd: (kind: ReferenceLabStepKind) => void;
}) {
  return (
    <section className={`editor-add-step ${open ? 'is-open' : ''}`} aria-label="Add step">
      {!open ? (
        <button id="add-step" onClick={onOpen}>
          + Add step
        </button>
      ) : (
        <>
          <span>ADD A STEP</span>
          <h2>What happens next?</h2>
          <div>
            <button onClick={() => onAdd('present')}>
              <strong>Present</strong>
              <small>Show a public message</small>
            </button>
            <button onClick={() => onAdd('wait')}>
              <strong>Wait</strong>
              <small>Pause for 3 seconds</small>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function TraceOverlay(
  props: Pick<EditorProps, 'fixture' | 'nodes' | 'activeCompositeId' | 'selectedValueId'>,
) {
  const edges = props.nodes.flatMap((node) =>
    node.inputs.flatMap((input) => {
      const source = sourceForReference(
        props.fixture,
        props.selectedValueId(node, input),
        props.activeCompositeId,
      );
      return source ? [{ source, node, input }] : [];
    }),
  );
  return (
    <aside className="editor-trace-overlay" aria-label="Reference trace overlay">
      <header>
        <strong>Reference traces</strong>
        <span>Data provenance · not execution order</span>
      </header>
      {edges.map((edge) => (
        <div key={`${edge.node.id}-${edge.input.name}`}>
          <span>{edge.source.label}</span>
          <i aria-hidden="true" />
          <span>
            {edge.node.label} · {friendlyInputLabel(edge.input.label)}
          </span>
        </div>
      ))}
    </aside>
  );
}

function CompositePorts({
  fixture,
  composite,
}: {
  readonly fixture: ReferenceFixture;
  readonly composite: NonNullable<ReturnType<typeof compositeForFixture>>;
}) {
  return (
    <section className="editor-composite-ports" aria-label="Composite inputs">
      <span>INPUTS</span>
      {composite.inputs.map((port) => {
        const parent = parentBinding(fixture, composite.id, port.name);
        return (
          <div key={port.name}>
            <small>{friendlyInputLabel(port.name)}</small>
            <strong>[{parent?.label ?? port.name}]</strong>
          </div>
        );
      })}
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
  readonly sourceCompositeId?: string;
}) {
  const consumers = projectFixture(fixture, sourceCompositeId).filter((node) =>
    node.inputs.some((input) => input.selectedValueId === value.id),
  );
  return (
    <section className="editor-source-context" aria-label={`Source context for ${value.label}`}>
      <span>SOURCE</span>
      <h2 id="reference-context-heading" tabIndex={-1}>
        {value.label}
      </h2>
      <p>{typeLabel(value.type)}</p>
      <article>
        <span>Produced by</span>
        <h3>{value.sourceLabel}</h3>
        {consumers.length > 0 && <p>Used by {consumers.map((node) => node.label).join(', ')}</p>}
        <details>
          <summary>Technical details</summary>
          <dl>
            <div>
              <dt>Scope</dt>
              <dd>{scopeLabel(value.scope)}</dd>
            </div>
            <div>
              <dt>ID</dt>
              <dd>{value.id}</dd>
            </div>
          </dl>
        </details>
      </article>
    </section>
  );
}

function AppBreadcrumb({
  fixture,
  navigation,
  mobileScreen,
  selectedNode,
  inspectedValue,
  onBack,
}: {
  readonly fixture: ReferenceFixture;
  readonly navigation: ReferenceNavigationState;
  readonly mobileScreen: string;
  readonly selectedNode?: LabNode;
  readonly inspectedValue?: LabValue;
  readonly onBack?: () => void;
}) {
  const compositeName =
    navigation.context === 'composite'
      ? fixture.definition.composites.find((item) => item.id === navigation.compositeId)?.name
      : undefined;
  const current =
    navigation.context === 'source'
      ? navigation.sourceValueId
        ? sourceForReference(fixture, navigation.sourceValueId, navigation.sourceCompositeId)?.label
        : undefined
      : mobileScreen === 'picker'
        ? 'Choose source'
        : mobileScreen === 'reference'
          ? inspectedValue?.label
          : mobileScreen === 'block'
            ? selectedNode?.label
            : compositeName;
  return (
    <nav className="editor-breadcrumb" aria-label="Semantic location">
      {onBack && (
        <button id="semantic-back" onClick={onBack}>
          ← Back
        </button>
      )}
      <ol>
        <li>Game</li>
        <li>{fixture.definition.title}</li>
        {compositeName && <li>{compositeName}</li>}
        {current && current !== compositeName && <li aria-current="page">{current}</li>}
      </ol>
    </nav>
  );
}

function Outline({ fixture }: { readonly fixture: ReferenceFixture }) {
  return (
    <section className="reference-outline" aria-label={`Outline · ${fixture.definition.title}`}>
      <header>
        <span className="eyebrow">SEMANTIC OUTLINE</span>
        <h3>Derived from the unchanged fixture</h3>
      </header>
      <pre>{outlineForFixture(fixture).join('\n')}</pre>
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

function friendlyInputLabel(label: string): string {
  if (label === 'PRIVATE AUDIENCE') return 'To';
  if (label === 'PARTICIPANT') return 'Player';
  if (label === 'COLLECTION') return 'From';
  return label[0]!.toUpperCase() + label.slice(1).toLowerCase();
}

function formatDuration(durationMs: number): string {
  const seconds = durationMs / 1000;
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

function focusSoon(id: string): void {
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}

function closeExperimentSettings(): void {
  const settings = document.querySelector<HTMLDetailsElement>('.experiment-settings');
  if (settings) settings.open = false;
}
