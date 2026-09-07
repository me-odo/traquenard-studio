import { useMemo, useState } from 'react';
import {
  backReferenceNavigation,
  candidatesForInput,
  compositeForFixture,
  enterComposite,
  initialReferenceNavigation,
  navigateToReferenceSource,
  outlineForFixture,
  parentBinding,
  projectFixture,
  referenceFixtureByKey,
  referenceFixtures,
  scopeLabel,
  sourceForReference,
  typeLabel,
  valuesForFixture,
  type CompositeProjection,
  type LabInput,
  type LabNode,
  type LabValue,
  type ReferenceFixture,
  type ReferenceFixtureKey,
  type ReferenceNavigationState,
  type ReferenceVariant,
  type ReferenceViewport,
} from './reference-lab-model.js';

const variants: readonly {
  readonly key: ReferenceVariant;
  readonly label: string;
  readonly hypothesis: string;
}[] = [
  {
    key: 'cables',
    label: 'Persistent cables',
    hypothesis: 'Always-visible edges make every source explicit enough to justify their space.',
  },
  {
    key: 'chips',
    label: 'Typed inline chips',
    hypothesis: 'Consumer-local identity and type labels preserve control-flow readability.',
  },
  {
    key: 'navigation',
    label: 'Chips + navigation',
    hypothesis: 'Reversible source navigation can replace permanent long edges in nested flows.',
  },
] as const;

const rubric = [
  ['Source discoverability', 'Strong', 'Mixed', 'Strong'],
  ['Type clarity', 'Mixed', 'Strong', 'Strong'],
  ['Same-type source disambiguation', 'Strong', 'Strong', 'Strong'],
  ['Scope clarity', 'Mixed', 'Strong', 'Strong'],
  ['Incompatible-value explanation', 'Mixed', 'Strong', 'Strong'],
  ['Main control-flow readability', 'Weak', 'Strong', 'Strong'],
  ['Cable / visual clutter', 'Weak', 'Strong', 'Strong'],
  ['Multiple-consumer scalability', 'Weak', 'Strong', 'Strong'],
  ['Long-flow scalability', 'Weak', 'Strong', 'Strong'],
  ['Composite entry / exit clarity', 'Mixed', 'Mixed', 'Strong'],
  ['Context preservation', 'Mixed', 'Mixed', 'Strong'],
  ['Desktop usability', 'Mixed', 'Strong', 'Strong'],
  ['Mobile usability', 'Weak', 'Strong', 'Strong'],
  ['Keyboard accessibility', 'Mixed', 'Strong', 'Strong'],
  ['Non-color dependence', 'Strong', 'Strong', 'Strong'],
  ['Outline parity', 'Strong', 'Strong', 'Strong'],
  ['Grouped-parallel compatibility', 'Weak', 'Strong', 'Strong'],
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
  const [variant, setVariant] = useState<ReferenceVariant>('cables');
  const [viewport, setViewport] = useState<ReferenceViewport>('desktop');
  const [projection, setProjection] = useState<CompositeProjection>('collapsed');
  const [navigation, setNavigation] = useState<ReferenceNavigationState>(() =>
    initialReferenceNavigation(),
  );
  const [picker, setPicker] = useState<PickerState>();
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState<InspectionState>();
  const [selection, setSelection] = useState<Readonly<Record<string, string>>>({});
  const fixture = referenceFixtureByKey(fixtureKey);
  const composite = compositeForFixture(fixture);
  const activeCompositeId = navigation.context === 'composite' ? navigation.compositeId : undefined;
  const nodes = useMemo(
    () => projectFixture(fixture, activeCompositeId),
    [fixture, activeCompositeId],
  );
  const currentVariant = variants.find((item) => item.key === variant)!;

  const resetContext = (nextFixture: ReferenceFixture) => {
    setNavigation(initialReferenceNavigation());
    setProjection('collapsed');
    setPicker(
      nextFixture.defaultInput
        ? {
            nodeId: nextFixture.defaultInput.nodeId,
            inputName: nextFixture.defaultInput.portName,
          }
        : undefined,
    );
    setInspection(undefined);
    setQuery('');
    setSelection({});
  };

  const chooseFixture = (key: ReferenceFixtureKey) => {
    const next = referenceFixtureByKey(key);
    setFixtureKey(key);
    resetContext(next);
  };

  const selectedId = (node: LabNode, input: LabInput): string =>
    selection[selectionKey(activeCompositeId, node.id, input.name)] ?? input.selectedValueId;

  const inspect = (node: LabNode, input: LabInput) => {
    const valueId = selectedId(node, input);
    setInspection({ nodeId: node.id, inputName: input.name, valueId });
    setPicker(undefined);
    focusSoon(`ref-node-${sourceForReference(fixture, valueId, activeCompositeId)?.sourceNodeId}`);
  };

  const openPicker = (node: LabNode, input: LabInput) => {
    setPicker({ nodeId: node.id, inputName: input.name });
    setInspection(undefined);
    setQuery('');
  };

  const enter = (node: LabNode) => {
    if (!node.compositeId) return;
    setNavigation((current) => enterComposite(current, node.compositeId!, node.id));
    setProjection('focused');
    setPicker(undefined);
    setInspection(undefined);
  };

  const back = () => {
    const next = backReferenceNavigation(navigation);
    setNavigation(next);
    setProjection(next.context === 'composite' ? 'focused' : 'collapsed');
    setInspection(undefined);
    setPicker(undefined);
    focusSoon(next.focusedNodeId ? `ref-node-${next.focusedNodeId}` : undefined);
  };

  const goToSource = (value: LabValue) => {
    const next = navigateToReferenceSource(fixture, navigation, value);
    setNavigation(next);
    setProjection(next.context === 'composite' ? 'focused' : 'collapsed');
    setInspection(undefined);
    focusSoon(`ref-node-${next.focusedNodeId ?? value.sourceNodeId}`);
  };

  const setProjectionMode = (next: CompositeProjection) => {
    setProjection(next);
    setPicker(undefined);
    setInspection(undefined);
    if (next === 'focused' && composite) {
      const invocation = projectFixture(fixture).find((node) => node.compositeId === composite.id);
      if (invocation)
        setNavigation((current) => enterComposite(current, composite.id, invocation.id));
    } else if (next === 'collapsed') setNavigation(initialReferenceNavigation());
  };

  const pickerNode = picker ? nodes.find((node) => node.id === picker.nodeId) : undefined;
  const pickerInput = pickerNode?.inputs.find((input) => input.name === picker?.inputName);
  const inspectedValue = inspection
    ? sourceForReference(fixture, inspection.valueId, activeCompositeId)
    : undefined;

  return (
    <main className="references-lab">
      <header className="topbar references-topbar">
        <div>
          <span className="eyebrow">VISUAL LAB · ISSUE #2</span>
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
          <span className="experiment-kicker">CONTROL FLOW ≠ DATA REFERENCES</span>
          <h2>Where did this value come from—and is it valid here?</h2>
          <p>
            Six typed Game IR fixtures projected through three reference grammars. Selection, focus,
            viewport, and navigation history remain presentation-only state.
          </p>
        </div>
        <div className="hypothesis-card">
          <span>FALSIFIABLE HYPOTHESIS</span>
          <p>
            Typed chips plus reversible semantic navigation preserve source, type, identity, and
            scope better than persistent edges once flows become long or nested.
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
        <ControlGroup label="Reference grammar">
          {variants.map((item) => (
            <button
              key={item.key}
              aria-pressed={variant === item.key}
              onClick={() => setVariant(item.key)}
            >
              {item.label}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Composite projection">
          {(['collapsed', 'focused', 'outline'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={projection === item}
              disabled={item === 'focused' && !composite}
              title={
                item === 'focused' && !composite ? 'This fixture has no Composite.' : undefined
              }
              onClick={() => setProjectionMode(item)}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Viewport">
          {(['desktop', 'mobile'] as const).map((item) => (
            <button key={item} aria-pressed={viewport === item} onClick={() => setViewport(item)}>
              {item === 'desktop' ? '▰ Desktop' : '▯ Mobile'}
            </button>
          ))}
        </ControlGroup>
      </section>

      <section className="reference-meta">
        <div>
          <span className="eyebrow">FIXTURE</span>
          <h2>{fixture.definition.title}</h2>
          <p>{fixture.description}</p>
        </div>
        <div>
          <span className="eyebrow">STRESS QUESTION</span>
          <p>{fixture.stress}</p>
        </div>
        <div>
          <span className="eyebrow">CURRENT GRAMMAR</span>
          <strong>{currentVariant.label}</strong>
          <p>{currentVariant.hypothesis}</p>
        </div>
      </section>

      <section
        className={`reference-prototype viewport-${viewport}`}
        aria-label={`${currentVariant.label} reference prototype`}
      >
        <div className="reference-device-chrome" aria-hidden="true">
          <i />
          <span>
            {viewport === 'mobile' ? '390 px focused navigation' : 'Desktop authoring canvas'}
          </span>
          <i />
        </div>
        <Breadcrumb
          fixture={fixture}
          navigation={navigation}
          compositeName={composite?.name}
          onBack={navigation.history.length ? back : undefined}
        />

        {projection === 'outline' ? (
          <Outline fixture={fixture} />
        ) : (
          <div className="reference-workbench">
            <div className="reference-canvas-wrap">
              {activeCompositeId && composite && (
                <CompositeBoundary
                  fixture={fixture}
                  composite={composite}
                  onInspect={(portName) => {
                    const value = sourceForReference(fixture, portName, activeCompositeId);
                    if (value)
                      setInspection({
                        nodeId: `${activeCompositeId}:boundary`,
                        inputName: portName,
                        valueId: portName,
                      });
                  }}
                />
              )}
              <FlowProjection
                fixture={fixture}
                nodes={nodes}
                variant={variant}
                activeCompositeId={activeCompositeId}
                selection={selection}
                focusedNodeId={navigation.focusedNodeId}
                onInspect={inspect}
                onChoose={openPicker}
                onEnter={enter}
              />
            </div>

            {(pickerNode && pickerInput) || inspectedValue ? (
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
                    onGoToSource={() => {
                      if (variant === 'navigation') goToSource(inspectedValue);
                      else {
                        setNavigation((current) => ({
                          ...current,
                          focusedNodeId: inspectedValue.sourceNodeId,
                        }));
                        setInspection(undefined);
                        focusSoon(`ref-node-${inspectedValue.sourceNodeId}`);
                      }
                    }}
                    onClose={() => setInspection(undefined)}
                  />
                ) : null}
              </aside>
            ) : (
              <aside className="reference-side-panel reference-guide" aria-label="Experiment guide">
                <span className="eyebrow">TRY IT</span>
                <h3>Select a reference</h3>
                <p>
                  Click a value at its consumer to inspect the producer, scope, type, and other
                  uses. Choose the input label to search for another compatible value.
                </p>
                <ol>
                  <li>Compare Questions Deck and Challenges Deck.</li>
                  <li>Trace Current Player across the long flow.</li>
                  <li>Open Prepare Turn and follow an input back to its parent.</li>
                </ol>
              </aside>
            )}
          </div>
        )}
      </section>

      <section className="parallel-reference-preview">
        <div>
          <span className="eyebrow">PRESENTATION STRESS PREVIEW · NOT EXECUTABLE IR V1</span>
          <h2>Grouped parallel compatibility check</h2>
          <p>
            The leading Issue #1 direction can keep each branch collapsed while exposing typed
            bindings. This does not add nested multi-operation parallel semantics.
          </p>
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

      <section className="reference-evaluation">
        <div>
          <span className="eyebrow">STRUCTURED DESIGN EVIDENCE · NOT USER RESEARCH</span>
          <h2>Evaluation rubric</h2>
          <p>
            The long-flow and mobile projections make cable cost visible. Ratings describe this
            prototype pass, not measured author performance.
          </p>
        </div>
        <div className="reference-rubric-scroll">
          <table>
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Persistent cables</th>
                <th>Typed chips</th>
                <th>Chips + navigation</th>
              </tr>
            </thead>
            <tbody>
              {rubric.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={`${row[0]}-${index}`}
                      data-rating={index ? cell.toLowerCase() : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="reference-recommendation">
          <span>PROVISIONAL RECOMMENDATION</span>
          <strong>CHIPS + SEMANTIC NAVIGATION LEADING</strong>
          <p>
            Typed chips protect the control sequence; source preview, breadcrumbs, and reversible
            navigation recover the context that inline chips alone cannot fully explain.
          </p>
        </div>
      </section>
    </main>
  );
}

function FlowProjection({
  fixture,
  nodes,
  variant,
  activeCompositeId,
  selection,
  focusedNodeId,
  onInspect,
  onChoose,
  onEnter,
}: {
  readonly fixture: ReferenceFixture;
  readonly nodes: readonly LabNode[];
  readonly variant: ReferenceVariant;
  readonly activeCompositeId?: string | undefined;
  readonly selection: Readonly<Record<string, string>>;
  readonly focusedNodeId?: string | undefined;
  readonly onInspect: (node: LabNode, input: LabInput) => void;
  readonly onChoose: (node: LabNode, input: LabInput) => void;
  readonly onEnter: (node: LabNode) => void;
}) {
  const values = valuesForFixture(fixture, activeCompositeId);
  const selectedId = (node: LabNode, input: LabInput) =>
    selection[selectionKey(activeCompositeId, node.id, input.name)] ?? input.selectedValueId;
  const edges = nodes.flatMap((node) =>
    node.inputs.flatMap((input) => {
      const source = sourceForReference(fixture, selectedId(node, input), activeCompositeId);
      return source ? [{ source, consumer: node, input }] : [];
    }),
  );
  return (
    <div className={`reference-flow variant-${variant}`}>
      {variant === 'cables' && (
        <div className="cable-layer" aria-label={`${edges.length} persistent data connections`}>
          <svg viewBox="0 0 1200 250" preserveAspectRatio="none" aria-hidden="true">
            {edges.map((edge, index) => {
              const sourceIndex = Math.max(
                0,
                nodes.findIndex((node) => node.id === edge.source.sourceNodeId) + 1,
              );
              const sourceX = 55 + sourceIndex * 78;
              const targetX = 180 + edge.consumer.index * 72;
              const height = 25 + (index % 5) * 32;
              return (
                <path
                  key={`${edge.consumer.id}-${edge.input.name}`}
                  d={`M ${sourceX} 220 C ${sourceX} ${height}, ${targetX} ${height}, ${targetX} 220`}
                  className={`cable-type-${edge.source.type.kind}`}
                />
              );
            })}
          </svg>
          <ul className="sr-only">
            {edges.map((edge) => (
              <li key={`${edge.consumer.id}-${edge.input.name}`}>
                {edge.source.label} connects to {edge.consumer.label}, {edge.input.label}
              </li>
            ))}
          </ul>
        </div>
      )}
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
      <ol className="reference-control-flow" aria-label="Control flow">
        {nodes.map((node, index) => (
          <li key={node.id}>
            {index > 0 && (
              <span className="control-arrow" aria-label="then">
                →
              </span>
            )}
            <article
              id={`ref-node-${node.id}`}
              className={`reference-node ${focusedNodeId === node.id ? 'source-focused' : ''}`}
              tabIndex={focusedNodeId === node.id ? 0 : -1}
            >
              <header>
                <span>{String(index + 1).padStart(2, '0')} · CONTROL</span>
                <code>{node.operation.kind}</code>
              </header>
              <h3>{node.label}</h3>
              <p>{node.detail}</p>
              <div className="node-ports">
                {node.inputs.map((input) => {
                  const value = sourceForReference(
                    fixture,
                    selectedId(node, input),
                    activeCompositeId,
                  );
                  if (!value) return null;
                  return (
                    <div className="node-port" key={input.name}>
                      <button className="port-label" onClick={() => onChoose(node, input)}>
                        {input.label} <span>change</span>
                      </button>
                      <ReferenceChip
                        value={value}
                        variant={variant}
                        onClick={() => onInspect(node, input)}
                      />
                    </div>
                  );
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
              {node.compositeId && (
                <button className="open-composite" onClick={() => onEnter(node)}>
                  Open {node.label} →
                </button>
              )}
            </article>
          </li>
        ))}
      </ol>
    </div>
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

function ReferenceChip({
  value,
  variant,
  onClick,
}: {
  readonly value: LabValue;
  readonly variant: ReferenceVariant;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={`reference-chip scope-${value.scope}`}
      onClick={onClick}
      title={`Inspect source: ${value.sourceLabel}`}
    >
      <span>
        {variant === 'cables' ? '● ' : ''}
        {typeLabel(value.type)} · {value.label}
      </span>
      {variant !== 'cables' && <small>{scopeLabel(value.scope)}</small>}
    </button>
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
            CHOOSE VALUE FOR {node.label.toUpperCase()} → {input.label}
          </span>
          <h3>Requires {typeLabel(input.type)}</h3>
        </div>
        <button aria-label="Close value picker" onClick={onClose}>
          ×
        </button>
      </header>
      <label>
        Search available values
        <input
          autoFocus
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Name, type, or scope…"
        />
      </label>
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
              {candidate.compatible ? 'Compatible' : 'Unavailable'}
            </span>
            {!candidate.compatible && (
              <small className="candidate-reason">{candidate.reason}</small>
            )}
          </button>
        ))}
        {!candidates.length && <p>No available value matches this search.</p>}
      </div>
      <p className="candidate-note">
        Compatibility uses Game IR TypeRef equality. Names identify values; they never override
        type.
      </p>
    </div>
  );
}

function SourceInspector({
  fixture,
  value,
  compositeId,
  variant,
  consumerCount,
  onGoToSource,
  onClose,
}: {
  readonly fixture: ReferenceFixture;
  readonly value: LabValue;
  readonly compositeId?: string | undefined;
  readonly variant: ReferenceVariant;
  readonly consumerCount: number;
  readonly onGoToSource: () => void;
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
          <span className="eyebrow">REFERENCE SOURCE</span>
          <h3>{value.label}</h3>
        </div>
        <button aria-label="Close source details" onClick={onClose}>
          ×
        </button>
      </header>
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
          <dd>{consumerCount} in this working projection</dd>
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
      {variant === 'navigation' ? (
        <button className="primary" onClick={onGoToSource}>
          Go to source
        </button>
      ) : (
        <button onClick={onGoToSource}>
          {variant === 'cables' ? 'Follow cable to source' : 'Temporarily reveal source'}
        </button>
      )}
      <p>Use Back after navigation to return to the original consumer and editing context.</p>
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
        <span className="eyebrow">SCOPE BOUNDARY</span>
        <h3>{composite.name}</h3>
        <p>Only declared ports are visible inside. Parent values are shown as explicit bindings.</p>
      </div>
      <div className="boundary-ports">
        {composite.inputs.map((port) => {
          const parent = parentBinding(fixture, composite.id, port.name);
          return (
            <button key={port.name} onClick={() => onInspect(port.name)}>
              <span>INPUT · {port.name}</span>
              <strong>{typeLabel(port.type)}</strong>
              <small>From parent: {parent?.label ?? 'unbound'}</small>
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

function Breadcrumb({
  fixture,
  navigation,
  compositeName,
  onBack,
}: {
  readonly fixture: ReferenceFixture;
  readonly navigation: ReferenceNavigationState;
  readonly compositeName?: string | undefined;
  readonly onBack?: (() => void) | undefined;
}) {
  return (
    <nav className="semantic-breadcrumb" aria-label="Semantic location">
      {onBack && <button onClick={onBack}>← Back</button>}
      <ol>
        <li>Game</li>
        <li>{fixture.definition.title}</li>
        {navigation.context === 'composite' && <li aria-current="page">{compositeName}</li>}
      </ol>
      <span>{navigation.context === 'composite' ? 'Focused Composite' : 'Parent flow'}</span>
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

function focusSoon(id: string | undefined): void {
  if (!id) return;
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}
