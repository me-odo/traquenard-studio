import { useDraggable, useDroppable } from '@dnd-kit/react';
import {
  operationLabel,
  operationReferences,
  type OperationReference,
} from '@traquenard/authoring-domain';
import type { GameDefinition, Operation } from '@traquenard/game-ir';
import { displayName, operationSummary, sequenceById, type SemanticSlot } from '../document.js';

export interface FlowProjectionProps {
  readonly definition: GameDefinition;
  readonly selectedId: string;
  readonly containment: 'c-shape' | 'framed';
  readonly parallelProjection: 'grouped' | 'lanes' | 'fork-join';
  readonly traceOverlay: boolean;
  readonly onSelect: (id: string) => void;
  readonly onSelectReference: (reference: OperationReference) => void;
  readonly onOpenPalette: (slot: SemanticSlot) => void;
}

export function FlowSequence(props: FlowProjectionProps & { readonly sequenceId: string }) {
  const sequence = sequenceById(props.definition, props.sequenceId);
  if (!sequence) return null;
  return (
    <ol className="authoring-ui-sequence" aria-label={`${displayName(props.sequenceId)} flow`}>
      {sequence.steps.length === 0 && (
        <li>
          <InsertionBoundary
            slot={{ sequenceId: props.sequenceId, index: 0 }}
            label={`Add first step to ${displayName(props.sequenceId)}`}
            empty
            onClick={props.onOpenPalette}
          />
        </li>
      )}
      {sequence.steps.map((operation, index) => (
        <li key={operation.id}>
          <InsertionBoundary
            slot={{ sequenceId: props.sequenceId, index }}
            label={`Insert before ${operationLabel(operation)} in ${displayName(props.sequenceId)}`}
            onClick={props.onOpenPalette}
          />
          <OperationBlock {...props} operation={operation} draggable />
        </li>
      ))}
      {sequence.steps.length > 0 && (
        <li>
          <InsertionBoundary
            slot={{ sequenceId: props.sequenceId, index: sequence.steps.length }}
            label={`Insert at end of ${displayName(props.sequenceId)}`}
            onClick={props.onOpenPalette}
          />
        </li>
      )}
    </ol>
  );
}

export function OperationBlock(
  props: FlowProjectionProps & {
    readonly operation: Operation;
    readonly draggable?: boolean;
  },
) {
  const drag = useDraggable({ id: `operation:${props.operation.id}`, disabled: !props.draggable });
  const structured =
    props.operation.kind === 'control.foreach' || props.operation.kind === 'control.if';
  const references = operationReferences(props.definition, props.operation);
  return (
    <article
      ref={props.draggable ? drag.ref : undefined}
      id={`authoring-node-${props.operation.id}`}
      className={`authoring-ui-block ${props.operation.id === props.selectedId ? 'is-selected' : ''} ${drag.isDragging ? 'is-dragging' : ''} ${structured ? `is-structured is-${props.containment}` : ''}`}
      data-operation-kind={props.operation.kind}
      data-shared-operation-block="true"
    >
      <div className="authoring-ui-block-heading">
        {props.draggable ? (
          <button
            ref={drag.handleRef}
            className="authoring-ui-drag-handle"
            aria-label={`Drag ${operationLabel(props.operation)}`}
          >
            ⠿
          </button>
        ) : (
          <span className="authoring-ui-branch-marker" aria-hidden="true">
            ↳
          </span>
        )}
        <button
          className="authoring-ui-select"
          aria-label={`${operationLabel(props.operation)} step`}
          aria-pressed={props.operation.id === props.selectedId}
          onClick={() => props.onSelect(props.operation.id)}
        >
          <strong>{operationLabel(props.operation)}</strong>
          <small>{operationSummary(props.operation, props.definition)}</small>
        </button>
      </div>
      {references.length > 0 && (
        <div className="authoring-ui-reference-row">
          {references.map((reference) => (
            <button
              key={`${reference.path}:${reference.expression.kind === 'variable' ? reference.expression.name : 'value'}`}
              className="authoring-ui-reference-chip"
              onClick={() => props.onSelectReference(reference)}
              aria-label={`${reference.label} reference ${displayName(referenceName(reference))}`}
            >
              <span>{reference.label}</span> {displayName(referenceName(reference))}
              <small>{displayName(reference.expectedType.kind)}</small>
            </button>
          ))}
        </div>
      )}
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
        <ParallelProjection {...props} operation={props.operation} />
      )}
      {props.traceOverlay && references.length > 0 && (
        <aside className="authoring-ui-trace" aria-label="Reference trace overlay">
          PROVENANCE · {references.map(referenceName).map(displayName).join(', ')} →{' '}
          {operationLabel(props.operation)}
        </aside>
      )}
    </article>
  );
}

function ParallelProjection(
  props: FlowProjectionProps & {
    readonly operation: Extract<Operation, { readonly kind: 'control.parallel' }>;
  },
) {
  return (
    <section
      className={`authoring-ui-parallel projection-${props.parallelProjection}`}
      aria-label={`${displayName(props.parallelProjection)} parallel projection`}
    >
      <span className="authoring-ui-parallel-start">START TOGETHER</span>
      <div className="authoring-ui-parallel-branches">
        {props.operation.branches.map((branch, index) => (
          <section
            key={branch.id}
            className="authoring-ui-parallel-branch"
            aria-label={`Branch ${index + 1}`}
          >
            <small>BRANCH {index + 1}</small>
            <OperationBlock {...props} operation={branch} />
          </section>
        ))}
      </div>
      <strong className="authoring-ui-parallel-join">WAIT FOR ALL, THEN CONTINUE</strong>
    </section>
  );
}

function StructuralSlot(props: {
  readonly label: string;
  readonly branch: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="authoring-ui-structural-slot" aria-label={props.label}>
      <span>{props.branch}</span>
      {props.children}
    </section>
  );
}

function InsertionBoundary(props: {
  readonly slot: SemanticSlot;
  readonly label: string;
  readonly empty?: boolean;
  readonly onClick: (slot: SemanticSlot) => void;
}) {
  const id = encodeSlot(props.slot);
  const { ref, isDropTarget } = useDroppable({ id });
  return (
    <div
      ref={ref}
      className={`authoring-ui-slot ${isDropTarget ? 'is-target' : ''} ${props.empty ? 'is-empty' : ''}`}
      data-slot={id}
    >
      <button aria-label={props.label} onClick={() => props.onClick(props.slot)}>
        <span aria-hidden="true">+</span>
        <span className="authoring-ui-slot-label">
          {props.empty ? 'Add first step' : 'Add step'}
        </span>
      </button>
    </div>
  );
}

function referenceName(reference: OperationReference): string {
  if (reference.expression.kind === 'variable') return reference.expression.name;
  if (reference.expression.kind === 'participants') return 'Players';
  return reference.expression.kind;
}

function encodeSlot(slot: SemanticSlot): string {
  return `slot:${slot.sequenceId}:${slot.index}`;
}
