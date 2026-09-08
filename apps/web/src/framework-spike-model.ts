import type { GameDefinition, Operation } from '@traquenard/game-ir';
import {
  authoringCanonicalDefinition,
  createAuthoringWorkingDefinition,
  insertOperation,
  operationLabel,
  type InsertableKind,
} from './authoring-lab-model.js';

export interface SemanticSlot {
  readonly sequenceId: string;
  readonly index: number;
}

export interface SemanticMoveCommand {
  readonly kind: 'move-operation';
  readonly operationId: string;
  readonly to: SemanticSlot;
}

export interface BlocklyBlockState {
  readonly type: string;
  readonly id: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly inputs?: Readonly<Record<string, { readonly block: BlocklyBlockState }>>;
  readonly next?: { readonly block: BlocklyBlockState };
}

export interface BlocklyWorkspaceState {
  readonly blocks: {
    readonly languageVersion: 0;
    readonly blocks: readonly BlocklyBlockState[];
  };
}

export const frameworkSpikeFixture = authoringCanonicalDefinition;

export function createFrameworkSpikeDocument(): GameDefinition {
  return createAuthoringWorkingDefinition();
}

export function createLongFrameworkDocument(stepCount = 40): GameDefinition {
  let definition = createFrameworkSpikeDocument();
  for (let index = 0; index < stepCount; index += 1) {
    definition = insertAtSlot(
      definition,
      { sequenceId: 'each-player-body', index: index + 1 },
      'wait',
      `stress-wait-${index + 1}`,
    );
  }
  return definition;
}

export function sequenceById(
  definition: GameDefinition,
  sequenceId: string,
): Extract<Operation, { readonly kind: 'sequence' }> | undefined {
  const visit = (
    operation: Operation,
  ): Extract<Operation, { readonly kind: 'sequence' }> | undefined => {
    if (operation.kind === 'sequence' && operation.id === sequenceId) return operation;
    switch (operation.kind) {
      case 'sequence':
        for (const child of operation.steps) {
          const result = visit(child);
          if (result) return result;
        }
        return undefined;
      case 'control.foreach':
        return visit(operation.body);
      case 'control.if':
        return visit(operation.then) ?? (operation.else ? visit(operation.else) : undefined);
      case 'control.parallel':
        for (const child of operation.branches) {
          const result = visit(child);
          if (result) return result;
        }
        return undefined;
      default:
        return undefined;
    }
  };
  return visit(definition.root);
}

export function semanticOrder(definition: GameDefinition, sequenceId: string): readonly string[] {
  return sequenceById(definition, sequenceId)?.steps.map((operation) => operation.id) ?? [];
}

export function insertAtSlot(
  definition: GameDefinition,
  slot: SemanticSlot,
  kind: InsertableKind,
  id: string,
): GameDefinition {
  return insertOperation(definition, slot.sequenceId, slot.index, kind, id);
}

export function moveToSlot(
  definition: GameDefinition,
  operationId: string,
  target: SemanticSlot,
): GameDefinition {
  const source = locateOperation(definition.root, operationId);
  if (!source || source.operation.kind === 'sequence') return definition;
  if (containsOperation(source.operation, target.sequenceId)) return definition;
  const removed = removeFromSequence(definition.root, source.sequenceId, source.index);
  const adjustedIndex =
    source.sequenceId === target.sequenceId && source.index < target.index
      ? target.index - 1
      : target.index;
  return {
    ...definition,
    root: insertExisting(removed, target.sequenceId, adjustedIndex, source.operation),
  };
}

export function applySemanticCommand(
  definition: GameDefinition,
  command: SemanticMoveCommand,
): GameDefinition {
  return moveToSlot(definition, command.operationId, command.to);
}

export function setWaitDuration(
  definition: GameDefinition,
  operationId: string,
  durationMs: number,
): GameDefinition {
  return {
    ...definition,
    root: mapTree(definition.root, (operation) =>
      operation.id === operationId && operation.kind === 'time.wait'
        ? { ...operation, durationMs: Math.max(0, durationMs) }
        : operation,
    ),
  };
}

export function blocklyMoveCommand(
  operationId: string,
  parentOperationId: string | undefined,
  inputName: string | undefined,
  index: number,
): SemanticMoveCommand {
  let sequenceId = 'authoring-root';
  if (parentOperationId === 'each-player' && inputName === 'BODY') sequenceId = 'each-player-body';
  if (parentOperationId === 'answer-check' && inputName === 'THEN') sequenceId = 'answer-yes';
  if (parentOperationId === 'answer-check' && inputName === 'ELSE') sequenceId = 'answer-no';
  return { kind: 'move-operation', operationId, to: { sequenceId, index } };
}

export function projectFixtureToBlockly(definition: GameDefinition): BlocklyWorkspaceState {
  const root = definition.root;
  const blocks = root.kind === 'sequence' ? statementChain(root.steps) : [];
  return { blocks: { languageVersion: 0, blocks } };
}

export function blocklyOperationIds(state: BlocklyWorkspaceState): readonly string[] {
  const ids: string[] = [];
  const visit = (block: BlocklyBlockState | undefined) => {
    if (!block) return;
    if (!block.id.includes(':')) ids.push(block.id);
    for (const input of Object.values(block.inputs ?? {})) visit(input.block);
    visit(block.next?.block);
  };
  for (const block of state.blocks.blocks) visit(block);
  return ids;
}

export function operationSummary(operation: Operation): string {
  switch (operation.kind) {
    case 'random.select':
      return 'Players → Current Player';
    case 'collection.draw':
      return `${operation.collectionVariable} → ${operation.output}`;
    case 'input.wait':
      return `${operation.prompt} → ${operation.output}`;
    case 'time.wait':
      return `${operation.durationMs / 1000} seconds`;
    case 'control.foreach':
      return 'Players · current item Player';
    case 'control.if':
      return 'Answer equals Yes';
    case 'composite.invoke':
      return 'Prepare Turn · player + data';
    case 'present':
      return 'Public presentation';
    case 'control.parallel':
      return 'Wait for all branches';
    case 'end':
      return 'Complete game';
    case 'sequence':
      return `${operation.steps.length} steps`;
    default:
      return operationLabel(operation);
  }
}

interface OperationLocation {
  readonly sequenceId: string;
  readonly index: number;
  readonly operation: Operation;
}

function locateOperation(operation: Operation, id: string): OperationLocation | undefined {
  switch (operation.kind) {
    case 'sequence':
      for (const [index, child] of operation.steps.entries()) {
        if (child.id === id) return { sequenceId: operation.id, index, operation: child };
        const nested = locateOperation(child, id);
        if (nested) return nested;
      }
      return undefined;
    case 'control.foreach':
      return locateOperation(operation.body, id);
    case 'control.if':
      return (
        locateOperation(operation.then, id) ??
        (operation.else ? locateOperation(operation.else, id) : undefined)
      );
    case 'control.parallel':
      for (const child of operation.branches) {
        const nested = locateOperation(child, id);
        if (nested) return nested;
      }
      return undefined;
    default:
      return undefined;
  }
}

function containsOperation(operation: Operation, id: string): boolean {
  if (operation.id === id) return true;
  switch (operation.kind) {
    case 'sequence':
      return operation.steps.some((child) => containsOperation(child, id));
    case 'control.foreach':
      return containsOperation(operation.body, id);
    case 'control.if':
      return (
        containsOperation(operation.then, id) ||
        (operation.else ? containsOperation(operation.else, id) : false)
      );
    case 'control.parallel':
      return operation.branches.some((child) => containsOperation(child, id));
    default:
      return false;
  }
}

function mapTree(operation: Operation, update: (operation: Operation) => Operation): Operation {
  const mapped: Operation = (() => {
    switch (operation.kind) {
      case 'sequence':
        return { ...operation, steps: operation.steps.map((child) => mapTree(child, update)) };
      case 'control.foreach':
        return { ...operation, body: mapTree(operation.body, update) };
      case 'control.if': {
        const nextElse = operation.else ? mapTree(operation.else, update) : undefined;
        return {
          ...operation,
          then: mapTree(operation.then, update),
          ...(nextElse ? { else: nextElse } : {}),
        };
      }
      case 'control.parallel':
        return {
          ...operation,
          branches: operation.branches.map((child) => mapTree(child, update)),
        };
      default:
        return operation;
    }
  })();
  return update(mapped);
}

function removeFromSequence(root: Operation, sequenceId: string, index: number): Operation {
  return mapTree(root, (operation) =>
    operation.kind === 'sequence' && operation.id === sequenceId
      ? { ...operation, steps: operation.steps.filter((_, itemIndex) => itemIndex !== index) }
      : operation,
  );
}

function insertExisting(
  root: Operation,
  sequenceId: string,
  index: number,
  inserted: Operation,
): Operation {
  return mapTree(root, (operation) => {
    if (operation.kind !== 'sequence' || operation.id !== sequenceId) return operation;
    const safe = Math.max(0, Math.min(index, operation.steps.length));
    return {
      ...operation,
      steps: [...operation.steps.slice(0, safe), inserted, ...operation.steps.slice(safe)],
    };
  });
}

function statementChain(operations: readonly Operation[]): readonly BlocklyBlockState[] {
  if (operations.length === 0) return [];
  const [first, ...rest] = operations;
  if (!first) return [];
  const block = operationToBlockly(first);
  return [rest.length > 0 ? { ...block, next: { block: statementChain(rest)[0]! } } : block];
}

function operationToBlockly(operation: Operation): BlocklyBlockState {
  const base = { id: operation.id, type: `traq_${operation.kind.replaceAll('.', '_')}` };
  switch (operation.kind) {
    case 'control.foreach': {
      const body =
        operation.body.kind === 'sequence' ? statementChain(operation.body.steps)[0] : undefined;
      return {
        ...base,
        fields: { COLLECTION: 'Players', ITEM: 'Player' },
        ...(body ? { inputs: { BODY: { block: body } } } : {}),
      };
    }
    case 'control.if': {
      const thenBlock =
        operation.then.kind === 'sequence' ? statementChain(operation.then.steps)[0] : undefined;
      const elseBlock =
        operation.else?.kind === 'sequence' ? statementChain(operation.else.steps)[0] : undefined;
      return {
        ...base,
        fields: { LEFT: 'Answer', OPERATOR: 'equals', RIGHT: 'Yes' },
        inputs: {
          ...(thenBlock ? { THEN: { block: thenBlock } } : {}),
          ...(elseBlock ? { ELSE: { block: elseBlock } } : {}),
        },
      };
    }
    case 'input.wait':
      return {
        ...base,
        fields: { PROMPT: operation.prompt },
        inputs: {
          PARTICIPANT: {
            block: { type: 'traq_participant_ref', id: `${operation.id}:participant` },
          },
        },
      };
    case 'collection.draw':
      return { ...base, fields: { COLLECTION: operation.collectionVariable } };
    case 'time.wait':
      return { ...base, fields: { SECONDS: String(operation.durationMs / 1000) } };
    case 'composite.invoke':
      return { ...base, fields: { WORKFLOW: 'Prepare Turn' } };
    case 'control.parallel': {
      const branches = statementChain(operation.branches)[0];
      return {
        ...base,
        ...(branches ? { inputs: { BRANCHES: { block: branches } } } : {}),
      };
    }
    default:
      return base;
  }
}
