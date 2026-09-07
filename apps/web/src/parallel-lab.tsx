import { useMemo, useState } from 'react';
import { blockCatalog } from '@traquenard/authoring-domain';
import {
  addEmptyBranch,
  branchesFromFixture,
  continuationLabel,
  fixtureByKey,
  insertBranchOperation,
  operationName,
  operationOwner,
  operationSummary,
  parallelContext,
  parallelFixtures,
  removeBranch,
  type InsertableBranchKind,
  type LabBranch,
  type LabViewport,
  type ParallelFixtureKey,
  type ParallelVariant,
} from './parallel-lab-model.js';

const variants: readonly {
  key: ParallelVariant;
  label: string;
  hypothesis: string;
}[] = [
  {
    key: 'lanes',
    label: 'Parallel lanes',
    hypothesis: 'Explicit lanes make membership and the shared join immediately scannable.',
  },
  {
    key: 'graph',
    label: 'Fork / join graph',
    hypothesis:
      'Literal control-flow nodes explain execution precisely enough to justify connector cost.',
  },
  {
    key: 'grouped',
    label: 'Grouped cards',
    hypothesis: 'A labeled container can explain all-join behavior without graph geometry.',
  },
] as const;

const operationChoices: readonly {
  kind: InsertableBranchKind;
  draftKind: 'ask-selected' | 'wait' | 'display';
  icon: string;
  label: string;
}[] = [
  { kind: 'input.wait', draftKind: 'ask-selected', icon: '↳', label: 'Participant input' },
  { kind: 'time.wait', draftKind: 'wait', icon: '◷', label: 'Logical timer' },
  { kind: 'present', draftKind: 'display', icon: '◫', label: 'Presentation' },
] as const;

const rubric = [
  ['Parallelism recognition', 'Strong', 'Strong', 'Strong'],
  ['Join-condition clarity', 'Strong', 'Strong', 'Strong'],
  ['Branch ownership clarity', 'Strong', 'Strong', 'Strong'],
  ['Data/control-flow readability', 'Strong', 'Strong', 'Mixed'],
  ['Add-branch discoverability', 'Strong', 'Mixed', 'Strong'],
  ['Insert-operation discoverability', 'Strong', 'Mixed', 'Strong'],
  ['Desktop scalability', 'Mixed', 'Weak', 'Strong'],
  ['Mobile scalability', 'Mixed', 'Weak', 'Strong'],
  ['Visual clutter', 'Mixed', 'Weak', 'Strong'],
  ['Future zoom/composites', 'Strong', 'Mixed', 'Strong'],
  ['Accessibility / non-color', 'Strong', 'Mixed', 'Strong'],
  ['Outline parity', 'Strong', 'Strong', 'Strong'],
] as const;

export function ParallelLab() {
  const [fixtureKey, setFixtureKey] = useState<ParallelFixtureKey>('group-vote');
  const [variant, setVariant] = useState<ParallelVariant>('lanes');
  const [viewport, setViewport] = useState<LabViewport>('desktop');
  const fixture = fixtureByKey(fixtureKey);
  const [branches, setBranches] = useState<readonly LabBranch[]>(() =>
    branchesFromFixture(fixture.definition),
  );
  const [selectedParallel, setSelectedParallel] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>();
  const [focusedBranchId, setFocusedBranchId] = useState<string>();
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const focusedBranch =
    viewport === 'mobile' ? branches.find((branch) => branch.id === focusedBranchId) : undefined;
  const context = useMemo(() => parallelContext(fixture.definition), [fixture]);
  const currentVariant = variants.find((item) => item.key === variant)!;

  const chooseFixture = (key: ParallelFixtureKey) => {
    const next = fixtureByKey(key);
    setFixtureKey(key);
    setBranches(branchesFromFixture(next.definition));
    setSelectedParallel(false);
    setSelectedBranchId(undefined);
    setFocusedBranchId(undefined);
  };

  const selectBranch = (branchId: string) => {
    setSelectedParallel(true);
    setSelectedBranchId(branchId);
    if (viewport === 'mobile') setFocusedBranchId(branchId);
  };

  const addBranch = () => {
    const next = addEmptyBranch(branches);
    const added = next.at(-1)!;
    setBranches(next);
    setSelectedParallel(true);
    setSelectedBranchId(added.id);
    if (viewport === 'mobile') setFocusedBranchId(added.id);
  };

  const deleteSelectedBranch = () => {
    if (!selectedBranchId || branches.length === 1) return;
    setBranches(removeBranch(branches, selectedBranchId));
    setSelectedBranchId(undefined);
    setFocusedBranchId(undefined);
  };

  const insertOperation = (kind: InsertableBranchKind) => {
    if (!selectedBranchId) return;
    setBranches(insertBranchOperation(branches, selectedBranchId, kind));
  };

  const showMobileOverview = () => {
    setFocusedBranchId(undefined);
    setSelectedBranchId(undefined);
    setSelectedParallel(true);
  };

  const reset = () => chooseFixture(fixtureKey);

  return (
    <main className="parallel-lab">
      <header className="topbar parallel-topbar">
        <div>
          <span className="eyebrow">VISUAL LAB · ISSUE #1</span>
          <h1>Parallel, three ways</h1>
        </div>
        <nav aria-label="Lab navigation">
          <a href="/lab">All experiments</a>
          <a href="/">Studio</a>
        </nav>
      </header>

      <section className="parallel-hero">
        <div>
          <span className="experiment-kicker">CONTROL.PARALLEL · JOIN: ALL</span>
          <h2>What runs together—and when do we move on?</h2>
          <p>
            One canonical semantic fixture, projected through three visual grammars. Layout and
            interaction state never enter Game IR.
          </p>
        </div>
        <div className="hypothesis-card">
          <span>FALSIFIABLE HYPOTHESIS</span>
          <p>
            Authors can identify concurrent scope, every owner, the all-join, and continuation in
            each fixture without instruction.
          </p>
        </div>
      </section>

      <section className="lab-controls" aria-label="Experiment controls">
        <ControlGroup label="Fixture">
          {parallelFixtures.map((item) => (
            <button
              key={item.key}
              aria-pressed={fixtureKey === item.key}
              onClick={() => chooseFixture(item.key)}
            >
              {item.shortLabel}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Grammar">
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
        <ControlGroup label="Viewport">
          {(['desktop', 'mobile'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={viewport === item}
              onClick={() => {
                setViewport(item);
                setFocusedBranchId(undefined);
                if (item === 'mobile') setSelectedBranchId(undefined);
              }}
            >
              {item === 'desktop' ? '▰ Desktop' : '▯ Mobile'}
            </button>
          ))}
        </ControlGroup>
      </section>

      <section className="experiment-meta">
        <div>
          <span className="eyebrow">FIXTURE</span>
          <h2>{fixture.definition.title}</h2>
          <p>{fixture.description}</p>
        </div>
        <div>
          <span className="eyebrow">CURRENT HYPOTHESIS</span>
          <p>{currentVariant.hypothesis}</p>
        </div>
        <div className="source-status" aria-label="Semantic source status">
          <span>Source artifact</span>
          <strong>{context.parallel.branches.length} canonical branches</strong>
          <small>{branches.length} in working projection</small>
        </div>
      </section>

      <section
        className={`prototype-frame viewport-${viewport}`}
        aria-label={`${currentVariant.label} prototype`}
      >
        <div className="device-chrome" aria-hidden="true">
          <i />
          <span>
            {viewport === 'mobile' ? '390 px tap prototype' : 'Responsive desktop canvas'}
          </span>
          <i />
        </div>
        <div className="prototype-canvas">
          {focusedBranch ? (
            <MobileBranchEditor
              branch={focusedBranch}
              branchIndex={branches.indexOf(focusedBranch)}
              onBack={showMobileOverview}
              onInsert={insertOperation}
              onRemove={deleteSelectedBranch}
              canRemove={branches.length > 1}
            />
          ) : (
            <>
              <SequenceStep label="Before" detail="Start the round together." />
              {variant === 'lanes' && (
                <LanesVariant
                  branches={branches}
                  selectedParallel={selectedParallel}
                  selectedBranchId={selectedBranchId}
                  onSelectParallel={() => setSelectedParallel(true)}
                  onSelectBranch={selectBranch}
                  onAddBranch={addBranch}
                />
              )}
              {variant === 'graph' && (
                <GraphVariant
                  branches={branches}
                  selectedParallel={selectedParallel}
                  selectedBranchId={selectedBranchId}
                  onSelectParallel={() => setSelectedParallel(true)}
                  onSelectBranch={selectBranch}
                  onAddBranch={addBranch}
                />
              )}
              {variant === 'grouped' && (
                <GroupedVariant
                  branches={branches}
                  selectedParallel={selectedParallel}
                  selectedBranchId={selectedBranchId}
                  onSelectParallel={() => setSelectedParallel(true)}
                  onSelectBranch={selectBranch}
                  onAddBranch={addBranch}
                />
              )}
              <SequenceStep
                label="Continue"
                detail={continuationLabel(fixture.definition)}
                accent
              />
            </>
          )}
        </div>
      </section>

      {viewport === 'desktop' && (
        <section className="authoring-tray" aria-label="Parallel authoring actions">
          <div className="tray-heading">
            <div>
              <span className="eyebrow">CONTEXTUAL AUTHORING</span>
              <h2>
                {selectedBranch
                  ? `Branch ${branches.indexOf(selectedBranch) + 1}`
                  : 'Select a branch'}
              </h2>
            </div>
            <div className="tray-actions">
              <button onClick={addBranch}>＋ Add branch</button>
              <button
                disabled={!selectedBranchId || branches.length === 1}
                onClick={deleteSelectedBranch}
              >
                Remove branch
              </button>
              <button onClick={reset}>Reset fixture</button>
            </div>
          </div>
          {selectedBranch ? (
            <OperationPalette onInsert={insertOperation} />
          ) : (
            <p className="tray-empty">
              Select any labeled branch. On mobile, selection opens a focused tap-to-insert view.
            </p>
          )}
        </section>
      )}

      <Outline
        fixtureTitle={fixture.definition.title}
        branches={branches}
        continuation={continuationLabel(fixture.definition)}
      />
      <EvaluationRubric />

      <section className="experiment-conclusion">
        <span className="eyebrow">PROVISIONAL RECOMMENDATION</span>
        <h2>Variant C leading · more testing needed</h2>
        <p>
          Grouped cards preserve the strongest hierarchy at six branches and on mobile. Lanes remain
          the best explicit teaching view; the graph is precise but pays heavily in connector noise.
          No production editor decision is made by this lab.
        </p>
      </section>
    </main>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

interface VariantProps {
  readonly branches: readonly LabBranch[];
  readonly selectedParallel: boolean;
  readonly selectedBranchId: string | undefined;
  readonly onSelectParallel: () => void;
  readonly onSelectBranch: (branchId: string) => void;
  readonly onAddBranch: () => void;
}

function LanesVariant(props: VariantProps) {
  return (
    <section className={`parallel-construct lanes ${props.selectedParallel ? 'selected' : ''}`}>
      <ParallelHeader label="Parallel lanes" onSelect={props.onSelectParallel} />
      <div className="fork-bar">
        <span>FORK · start together</span>
      </div>
      <div className="lane-grid">
        {props.branches.map((branch, index) => (
          <article key={branch.id} className="lane">
            <span className="lane-label">LANE {index + 1}</span>
            <BranchCard
              branch={branch}
              index={index}
              selected={props.selectedBranchId === branch.id}
              onSelect={props.onSelectBranch}
            />
          </article>
        ))}
        <button className="inline-add" onClick={props.onAddBranch}>
          ＋ Add lane
        </button>
      </div>
      <JoinBar />
    </section>
  );
}

function GraphVariant(props: VariantProps) {
  return (
    <section className={`parallel-construct graph ${props.selectedParallel ? 'selected' : ''}`}>
      <ParallelHeader label="Fork / join graph" onSelect={props.onSelectParallel} />
      <div className="graph-node fork-node">
        <span>FORK</span>
        <strong>Start all branches</strong>
      </div>
      <div className="graph-branches">
        {props.branches.map((branch, index) => (
          <div className="graph-path" key={branch.id}>
            <span className="connector-label">path {index + 1}</span>
            <BranchCard
              branch={branch}
              index={index}
              selected={props.selectedBranchId === branch.id}
              onSelect={props.onSelectBranch}
            />
          </div>
        ))}
      </div>
      <button className="inline-add graph-add" onClick={props.onAddBranch}>
        ＋ Add path
      </button>
      <div className="graph-node join-node">
        <span>JOIN · ALL</span>
        <strong>Wait for every path</strong>
      </div>
    </section>
  );
}

function GroupedVariant(props: VariantProps) {
  return (
    <section className={`parallel-construct grouped ${props.selectedParallel ? 'selected' : ''}`}>
      <ParallelHeader label="Parallel group" onSelect={props.onSelectParallel} />
      <div className="group-rule">
        <strong>All {props.branches.length} branches start together</strong>
        <span>Continue only when every branch is complete</span>
      </div>
      <div className="card-grid">
        {props.branches.map((branch, index) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            index={index}
            selected={props.selectedBranchId === branch.id}
            onSelect={props.onSelectBranch}
          />
        ))}
        <button className="inline-add" onClick={props.onAddBranch}>
          ＋ Add branch
        </button>
      </div>
      <div className="group-status">
        <span aria-hidden="true">✓</span> Wait for all, then continue
      </div>
    </section>
  );
}

function ParallelHeader({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <header className="parallel-header">
      <div>
        <span className="semantic-chip">∥ PARALLEL</span>
        <strong>{label}</strong>
      </div>
      <button onClick={onSelect}>Select parallel construct</button>
    </header>
  );
}

function BranchCard({
  branch,
  index,
  selected,
  onSelect,
}: {
  branch: LabBranch;
  index: number;
  selected: boolean;
  onSelect: (branchId: string) => void;
}) {
  const icon =
    branch.operation?.kind === 'time.wait'
      ? '◷'
      : branch.operation?.kind === 'present'
        ? '◫'
        : branch.operation
          ? '↳'
          : '＋';
  return (
    <div
      className={`branch-card branch-${branch.operation?.kind ?? 'empty'} ${selected ? 'selected' : ''}`}
    >
      <div className="branch-topline">
        <span className="branch-number">BRANCH {index + 1}</span>
        <span className="operation-kind">{branch.operation?.kind ?? 'needs operation'}</span>
      </div>
      <div className="operation-title">
        <span aria-hidden="true">{icon}</span>
        <strong>{operationName(branch.operation)}</strong>
      </div>
      <p>{operationSummary(branch.operation)}</p>
      <span className="owner-label">{operationOwner(branch.operation)}</span>
      <button
        aria-label={`${selected ? 'Editing' : 'Edit'} branch ${index + 1}`}
        aria-pressed={selected}
        onClick={() => onSelect(branch.id)}
      >
        {selected ? 'Editing branch' : `Edit branch ${index + 1}`}
      </button>
    </div>
  );
}

function JoinBar() {
  return (
    <div className="join-bar">
      <span>JOIN · ALL</span>
      <strong>Every lane must complete</strong>
    </div>
  );
}

function SequenceStep({
  label,
  detail,
  accent = false,
}: {
  label: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`sequence-step ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{detail}</strong>
    </div>
  );
}

function OperationPalette({ onInsert }: { onInsert: (kind: InsertableBranchKind) => void }) {
  return (
    <div className="operation-palette">
      {operationChoices.map((choice) => {
        const authoringEntry = blockCatalog.find((entry) => entry.kind === choice.draftKind)!;
        return (
          <button key={choice.kind} onClick={() => onInsert(choice.kind)}>
            <span aria-hidden="true">{choice.icon}</span>
            <strong>{choice.label}</strong>
            <small>{authoringEntry.summary}</small>
            <em>Compatible · IR v1 independent branch</em>
          </button>
        );
      })}
      <button disabled title="Sequential control cannot be nested in an IR v1 parallel branch.">
        <span aria-hidden="true">⇢</span>
        <strong>Sequence / composite</strong>
        <small>Runs multiple operations in order.</small>
        <em>Unavailable · v1 branches allow input, timer, or presentation only</em>
      </button>
    </div>
  );
}

function MobileBranchEditor({
  branch,
  branchIndex,
  onBack,
  onInsert,
  onRemove,
  canRemove,
}: {
  branch: LabBranch;
  branchIndex: number;
  onBack: () => void;
  onInsert: (kind: InsertableBranchKind) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <section className="mobile-editor" aria-label={`Focused editor for branch ${branchIndex + 1}`}>
      <button className="back-button" onClick={onBack}>
        ← Parallel overview
      </button>
      <span className="eyebrow">FOCUSED BRANCH {branchIndex + 1}</span>
      <h2>{operationName(branch.operation)}</h2>
      <p>
        {operationOwner(branch.operation)} · {operationSummary(branch.operation)}
      </p>
      <OperationPalette onInsert={onInsert} />
      <button className="remove-mobile" disabled={!canRemove} onClick={onRemove}>
        Remove this branch
      </button>
    </section>
  );
}

function Outline({
  fixtureTitle,
  branches,
  continuation,
}: {
  fixtureTitle: string;
  branches: readonly LabBranch[];
  continuation: string;
}) {
  return (
    <details className="outline" open>
      <summary>Outline fallback · {fixtureTitle}</summary>
      <div className="outline-tree">
        <strong>Parallel — wait for all</strong>
        <ol>
          {branches.map((branch, index) => (
            <li key={branch.id}>
              <span>
                Branch {index + 1} · {operationOwner(branch.operation)}
              </span>
              <strong>
                {operationName(branch.operation)} — {operationSummary(branch.operation)}
              </strong>
            </li>
          ))}
        </ol>
        <div>
          <span>Continue</span>
          <strong>{continuation}</strong>
        </div>
      </div>
    </details>
  );
}

function EvaluationRubric() {
  return (
    <section className="rubric-section">
      <div>
        <span className="eyebrow">STRUCTURED DESIGN REASONING · NOT USER RESEARCH</span>
        <h2>Evaluation rubric</h2>
        <p>
          Provisional ratings after exercising 2, 3, and 6 branches in desktop and mobile frames.
        </p>
      </div>
      <div className="rubric-scroll">
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th>A · Lanes</th>
              <th>B · Graph</th>
              <th>C · Grouped</th>
            </tr>
          </thead>
          <tbody>
            {rubric.map(([criterion, lanes, graph, grouped]) => (
              <tr key={criterion}>
                <th>{criterion}</th>
                {[lanes, graph, grouped].map((score, index) => (
                  <td key={`${criterion}-${index}`}>
                    <span className={`rating rating-${score.toLowerCase()}`}>{score}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tradeoff-grid">
        <article>
          <strong>A · Lanes</strong>
          <p>
            Best balance of explicit membership and edit targets; horizontal density becomes a
            mobile and six-branch problem.
          </p>
        </article>
        <article>
          <strong>B · Graph</strong>
          <p>
            Most literal fork/join explanation; connector repetition competes with branch content
            and collapses poorly.
          </p>
        </article>
        <article>
          <strong>C · Grouped</strong>
          <p>
            Strongest responsive container and scale behavior; needs persistent text to avoid
            looking like an ordinary card collection.
          </p>
        </article>
      </div>
    </section>
  );
}
