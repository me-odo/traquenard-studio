import { lazy, Suspense, useRef, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/react';
import type { GameDefinition, Operation } from '@traquenard/game-ir';
import {
  findOperation,
  insertionCatalog,
  operationLabel,
  type InsertableKind,
} from './authoring-lab-model.js';
import {
  createFrameworkSpikeDocument,
  createLongFrameworkDocument,
  insertAtSlot,
  moveToSlot,
  operationSummary,
  semanticOrder,
  sequenceById,
  setWaitDuration,
  type SemanticSlot,
} from './framework-spike-model.js';

const BlocklySpike = lazy(() => import('./framework-spike-blockly.js'));
type Candidate = 'custom' | 'blockly';
type MobilePanel = 'library' | 'flow' | 'inspector';

const spikePalette = insertionCatalog.filter((item) =>
  ['present', 'wait', 'if', 'foreach', 'composite'].includes(item.kind),
);

export function FrameworkSpike() {
  const [candidate, setCandidate] = useState<Candidate>('custom');
  return (
    <main className="framework-spike">
      <header className="framework-spike-topbar">
        <div>
          <a href="/lab">← Visual Lab</a>
          <span className="eyebrow">FRAMEWORK SPIKE · ISSUE #7</span>
          <h1>Structured authoring framework comparison</h1>
        </div>
        <nav aria-label="Framework candidate">
          <button aria-pressed={candidate === 'custom'} onClick={() => setCandidate('custom')}>
            Custom + dnd-kit
          </button>
          <button aria-pressed={candidate === 'blockly'} onClick={() => setCandidate('blockly')}>
            Blockly
          </button>
        </nav>
      </header>
      <p className="framework-hypothesis">
        <strong>Hypothesis:</strong> a toolkit reduces nested interaction work while the Traquenard
        document remains the only semantic source of truth.
      </p>
      {candidate === 'custom' ? (
        <CustomDndSpike />
      ) : (
        <Suspense fallback={<p className="framework-loading">Loading isolated Blockly chunk…</p>}>
          <BlocklySpike />
        </Suspense>
      )}
    </main>
  );
}

function CustomDndSpike() {
  const [definition, setDefinition] = useState<GameDefinition>(() =>
    createFrameworkSpikeDocument(),
  );
  const [selectedId, setSelectedId] = useState('each-player');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('flow');
  const [lastCommand, setLastCommand] = useState('No authoring command yet.');
  const nextId = useRef(1);
  const selected = findOperation(definition, selectedId);

  const insert = (kind: InsertableKind, slot: SemanticSlot) => {
    const id = `spike-${kind}-${nextId.current++}`;
    setDefinition((current) => insertAtSlot(current, slot, kind, id));
    setSelectedId(id);
    setLastCommand(`insert ${id} → ${slot.sequenceId}[${slot.index}]`);
    setMobilePanel('inspector');
  };

  const move = (operationId: string, slot: SemanticSlot) => {
    setDefinition((current) => moveToSlot(current, operationId, slot));
    setSelectedId(operationId);
    setLastCommand(`move ${operationId} → ${slot.sequenceId}[${slot.index}]`);
  };

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const sourceId = String(event.operation.source?.id ?? '');
        const targetId = String(event.operation.target?.id ?? '');
        const slot = decodeSlot(targetId);
        if (!slot) return;
        if (sourceId.startsWith('palette:')) {
          insert(sourceId.slice('palette:'.length) as InsertableKind, slot);
        } else if (sourceId.startsWith('operation:')) {
          move(sourceId.slice('operation:'.length), slot);
        }
      }}
    >
      <MobilePanelNav current={mobilePanel} onChange={setMobilePanel} />
      <section
        className={`framework-workspace mobile-${mobilePanel}`}
        aria-label="dnd-kit structured authoring proof"
      >
        <aside className="framework-library" aria-label="Blocks, Data, and Workflows library">
          <h2>Library</h2>
          <LibrarySection label="Blocks">
            {spikePalette.map((item) => (
              <PaletteBlock key={item.kind} kind={item.kind} label={item.label} />
            ))}
          </LibrarySection>
          <LibrarySection label="Data">
            <div className="framework-tree">
              <span>Runtime / Players</span>
              <span>Collections / Questions</span>
              <span>State / Score</span>
            </div>
          </LibrarySection>
          <LibrarySection label="Workflows">
            <div className="framework-tree">
              <span>Main</span>
              <span>Prepare Turn</span>
              <span>Score Round</span>
            </div>
          </LibrarySection>
          <SearchableAdd
            onChoose={(kind) => insert(kind, { sequenceId: 'authoring-root', index: 1 })}
          />
          <p className="framework-note">
            Drag is an accelerator. Every insertion slot and this searchable picker work without
            dragging.
          </p>
        </aside>

        <section className="framework-flow" aria-label="Custom structured flow">
          <header>
            <div>
              <span className="eyebrow">MAIN WORKFLOW</span>
              <h2>Friday Night Challenge</h2>
            </div>
            <div className="framework-flow-actions">
              <button
                onClick={() => {
                  setDefinition(createLongFrameworkDocument());
                  setLastCommand('loaded 40-step nested rendering stress');
                }}
              >
                Load 40-step nested stress
              </button>
              <button onClick={() => setDefinition(createFrameworkSpikeDocument())}>Reset</button>
            </div>
          </header>
          <FlowSequence
            definition={definition}
            sequenceId="authoring-root"
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setMobilePanel('inspector');
            }}
            onInsert={insert}
          />
          <output className="semantic-order" aria-live="polite">
            <strong>Semantic root order</strong>
            <span>{semanticOrder(definition, 'authoring-root').join(' → ')}</span>
            <small>
              For Each body: {semanticOrder(definition, 'each-player-body').join(' → ') || 'empty'}
            </small>
            <small>{lastCommand}</small>
          </output>
        </section>

        <aside className="framework-inspector" aria-label="Editable semantic inspector">
          <h2>Inspector</h2>
          {selected ? (
            <Inspector
              operation={selected}
              onDuration={(seconds) =>
                setDefinition((current) => setWaitDuration(current, selected.id, seconds * 1000))
              }
            />
          ) : (
            <p>Select a block to edit it.</p>
          )}
          <button className="mobile-back-flow" onClick={() => setMobilePanel('flow')}>
            ← Back to Flow
          </button>
        </aside>
      </section>
      <DragOverlay className="framework-drag-overlay" dropAnimation={null}>
        {(source) => <span>{String(source.id).replace(/^(palette|operation):/, '')}</span>}
      </DragOverlay>
    </DragDropProvider>
  );
}

function FlowSequence({
  definition,
  sequenceId,
  selectedId,
  onSelect,
  onInsert,
}: {
  readonly definition: GameDefinition;
  readonly sequenceId: string;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly onInsert: (kind: InsertableKind, slot: SemanticSlot) => void;
}) {
  const sequence = sequenceById(definition, sequenceId);
  if (!sequence) return null;
  return (
    <ol className="framework-sequence" aria-label={`${sequenceId} semantic sequence`}>
      {sequence.steps.map((operation, index) => (
        <li key={operation.id}>
          <InsertionSlot
            slot={{ sequenceId, index }}
            label={`Insert before ${operationLabel(operation)} in ${sequenceId}`}
            onInsert={onInsert}
          />
          <OperationBlock
            definition={definition}
            operation={operation}
            selected={operation.id === selectedId}
            selectedId={selectedId}
            onSelect={onSelect}
            onInsert={onInsert}
          />
        </li>
      ))}
      <li>
        <InsertionSlot
          slot={{ sequenceId, index: sequence.steps.length }}
          label={`Insert at end of ${sequenceId}`}
          onInsert={onInsert}
        />
      </li>
    </ol>
  );
}

function OperationBlock({
  definition,
  operation,
  selected,
  selectedId,
  onSelect,
  onInsert,
}: {
  readonly definition: GameDefinition;
  readonly operation: Operation;
  readonly selected: boolean;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly onInsert: (kind: InsertableKind, slot: SemanticSlot) => void;
}) {
  const { ref, handleRef, isDragging } = useDraggable({ id: `operation:${operation.id}` });
  const content = (
    <>
      <div className="framework-block-heading">
        <button
          ref={handleRef}
          className="framework-drag-handle"
          aria-label={`Drag ${operationLabel(operation)}`}
        >
          ⠿
        </button>
        <button className="framework-select" onClick={() => onSelect(operation.id)}>
          <strong>{operationLabel(operation)}</strong>
          <small>{operationSummary(operation)}</small>
        </button>
      </div>
      {operation.kind === 'control.foreach' && (
        <div className="c-slot">
          <span>DO FOR EACH PLAYER</span>
          <FlowSequence
            definition={definition}
            sequenceId={operation.body.id}
            selectedId={selectedId}
            onSelect={onSelect}
            onInsert={onInsert}
          />
        </div>
      )}
      {operation.kind === 'control.if' && (
        <>
          <div className="c-slot">
            <span>THEN</span>
            <FlowSequence
              definition={definition}
              sequenceId={operation.then.id}
              selectedId={selectedId}
              onSelect={onSelect}
              onInsert={onInsert}
            />
          </div>
          {operation.else && (
            <div className="c-slot c-slot-else">
              <span>ELSE</span>
              <FlowSequence
                definition={definition}
                sequenceId={operation.else.id}
                selectedId={selectedId}
                onSelect={onSelect}
                onInsert={onInsert}
              />
            </div>
          )}
        </>
      )}
    </>
  );
  return (
    <article
      ref={ref}
      className={`framework-block ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${operation.kind === 'control.foreach' || operation.kind === 'control.if' ? 'is-c-shape' : ''}`}
      data-operation-id={operation.id}
    >
      {content}
    </article>
  );
}

function InsertionSlot({
  slot,
  label,
  onInsert,
}: {
  readonly slot: SemanticSlot;
  readonly label: string;
  readonly onInsert: (kind: InsertableKind, slot: SemanticSlot) => void;
}) {
  const id = encodeSlot(slot);
  const { ref, isDropTarget } = useDroppable({ id });
  return (
    <div ref={ref} className={`framework-slot ${isDropTarget ? 'is-target' : ''}`} data-slot={id}>
      <button aria-label={label} onClick={() => onInsert('wait', slot)}>
        + <span>Add Wait here</span>
      </button>
    </div>
  );
}

function PaletteBlock({ kind, label }: { readonly kind: InsertableKind; readonly label: string }) {
  const { ref, isDragging } = useDraggable({ id: `palette:${kind}` });
  return (
    <button
      ref={ref}
      className={`framework-palette-block ${isDragging ? 'is-dragging' : ''}`}
      data-palette-kind={kind}
    >
      <span aria-hidden="true">⠿</span> {label}
    </button>
  );
}

function SearchableAdd({ onChoose }: { readonly onChoose: (kind: InsertableKind) => void }) {
  const labels = spikePalette.map((item) => item.label);
  return (
    <div className="framework-search-add">
      <Combobox.Root
        items={labels}
        onValueChange={(label) => {
          const item = spikePalette.find((candidate) => candidate.label === label);
          if (item) onChoose(item.kind);
        }}
      >
        <label htmlFor="framework-add-search">Search and add after first step</label>
        <Combobox.InputGroup>
          <Combobox.Input id="framework-add-search" placeholder="Present, Wait, If…" />
          <Combobox.Trigger aria-label="Open add-step choices">⌄</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="framework-combobox-positioner">
            <Combobox.Popup className="framework-combobox-popup">
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

function Inspector({
  operation,
  onDuration,
}: {
  readonly operation: Operation;
  readonly onDuration: (seconds: number) => void;
}) {
  return (
    <section aria-label={`${operationLabel(operation)} semantic properties`}>
      <span className="eyebrow">SELECTED BLOCK</span>
      <h3>{operationLabel(operation)}</h3>
      <p>{operationSummary(operation)}</p>
      {operation.kind === 'time.wait' && (
        <label>
          Duration in seconds
          <input
            type="number"
            min="0"
            value={operation.durationMs / 1000}
            onChange={(event) => onDuration(Number(event.target.value))}
          />
        </label>
      )}
      {operation.kind === 'control.if' && (
        <dl>
          <div>
            <dt>Left</dt>
            <dd>Answer</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>equals</dd>
          </div>
          <div>
            <dt>Right</dt>
            <dd>Yes</dd>
          </div>
        </dl>
      )}
      {operation.kind === 'control.foreach' && (
        <dl>
          <div>
            <dt>Collection</dt>
            <dd>Players</dd>
          </div>
          <div>
            <dt>Current item</dt>
            <dd>Player</dd>
          </div>
        </dl>
      )}
      {operation.kind === 'collection.draw' && (
        <dl>
          <div>
            <dt>Collection</dt>
            <dd>{operation.collectionVariable}</dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd>{operation.output}</dd>
          </div>
        </dl>
      )}
      {operation.kind === 'composite.invoke' && (
        <dl>
          <div>
            <dt>Workflow</dt>
            <dd>Prepare Turn</dd>
          </div>
          <div>
            <dt>player</dt>
            <dd>Current Player</dd>
          </div>
          <div>
            <dt>data</dt>
            <dd>Questions</dd>
          </div>
        </dl>
      )}
      <small>Semantic ID: {operation.id}</small>
    </section>
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

function MobilePanelNav({
  current,
  onChange,
}: {
  readonly current: MobilePanel;
  readonly onChange: (panel: MobilePanel) => void;
}) {
  return (
    <nav className="framework-mobile-nav" aria-label="Mobile authoring panels">
      {(['library', 'flow', 'inspector'] as const).map((panel) => (
        <button key={panel} aria-pressed={current === panel} onClick={() => onChange(panel)}>
          {panel[0]!.toUpperCase() + panel.slice(1)}
        </button>
      ))}
    </nav>
  );
}

function encodeSlot(slot: SemanticSlot): string {
  return `slot:${slot.sequenceId}:${slot.index}`;
}

function decodeSlot(value: string): SemanticSlot | undefined {
  const match = /^slot:(.+):(\d+)$/.exec(value);
  if (!match?.[1] || match[2] === undefined) return undefined;
  return { sequenceId: match[1], index: Number(match[2]) };
}

export default FrameworkSpike;
