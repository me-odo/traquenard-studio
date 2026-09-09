import {
  variable,
  type Expression,
  type GameDefinition,
  type Operation,
} from '@traquenard/game-ir';
import { createAuthoringWorkingDefinition } from './fixtures/authoring.js';
import { createOperationForSlot, type InsertableOperationKind } from './registry/operations.js';

export interface SemanticSlot {
  readonly sequenceId: string;
  readonly index: number;
}

export function createBaselineDocument(): GameDefinition {
  return createAuthoringWorkingDefinition();
}

export function createLongBaselineDocument(): GameDefinition {
  let definition = createBaselineDocument();
  for (let index = 0; index < 14; index += 1) {
    definition = insertAtSlot(
      definition,
      {
        sequenceId: 'authoring-root',
        index: definition.root.kind === 'sequence' ? definition.root.steps.length - 1 : 0,
      },
      'time.wait',
      `deep-wait-${index + 1}`,
    );
  }
  return definition;
}

export function sequenceById(
  definition: GameDefinition,
  sequenceId: string,
): Extract<Operation, { readonly kind: 'sequence' }> | undefined {
  const find = (operation: Operation) =>
    operation.kind === 'sequence' && operation.id === sequenceId ? operation : undefined;
  return (
    visitOperation(definition.root, find) ??
    definition.composites
      .map((composite) => visitOperation(composite.implementation, find))
      .find((sequence) => sequence !== undefined)
  );
}

export function insertAtSlot(
  definition: GameDefinition,
  slot: SemanticSlot,
  kind: InsertableOperationKind,
  id: string,
): GameDefinition {
  const created = createOperationForSlot(definition, slot, kind, id);
  const updated = mapDefinition(definition, (operation) => {
    if (operation.kind !== 'sequence' || operation.id !== slot.sequenceId) return operation;
    const safe = Math.max(0, Math.min(slot.index, operation.steps.length));
    return {
      ...operation,
      steps: [...operation.steps.slice(0, safe), created.operation, ...operation.steps.slice(safe)],
    };
  });
  return { ...updated, variables: created.variables };
}

export function moveToSlot(
  definition: GameDefinition,
  operationId: string,
  target: SemanticSlot,
): GameDefinition {
  const source = locateInDefinition(definition, operationId);
  if (!source || source.operation.kind === 'sequence') return definition;
  if (containsOperation(source.operation, target.sequenceId)) return definition;
  const removed = mapDefinition(definition, (operation) =>
    operation.kind === 'sequence' && operation.id === source.sequenceId
      ? { ...operation, steps: operation.steps.filter((_, index) => index !== source.index) }
      : operation,
  );
  const adjustedIndex =
    source.sequenceId === target.sequenceId && source.index < target.index
      ? target.index - 1
      : target.index;
  return mapDefinition(removed, (operation) => {
    if (operation.kind !== 'sequence' || operation.id !== target.sequenceId) return operation;
    const safe = Math.max(0, Math.min(adjustedIndex, operation.steps.length));
    return {
      ...operation,
      steps: [...operation.steps.slice(0, safe), source.operation, ...operation.steps.slice(safe)],
    };
  });
}

export function updateOperation(
  definition: GameDefinition,
  operationId: string,
  update: (operation: Operation) => Operation,
): GameDefinition {
  return mapDefinition(definition, (operation) =>
    operation.id === operationId ? update(operation) : operation,
  );
}

export function setWaitDuration(
  definition: GameDefinition,
  operationId: string,
  seconds: number,
): GameDefinition {
  return updateOperation(definition, operationId, (operation) =>
    operation.kind === 'time.wait'
      ? { ...operation, durationMs: Math.max(0, seconds * 1000) }
      : operation,
  );
}

export function setDrawCollection(
  definition: GameDefinition,
  operationId: string,
  collectionVariable: string,
): GameDefinition {
  return updateOperation(definition, operationId, (operation) =>
    operation.kind === 'collection.draw' ? { ...operation, collectionVariable } : operation,
  );
}

export function setPresentMessage(
  definition: GameDefinition,
  operationId: string,
  message: string,
): GameDefinition {
  return updateOperation(definition, operationId, (operation) =>
    operation.kind === 'present' && operation.message.kind === 'literal'
      ? { ...operation, message: { ...operation.message, value: message } }
      : operation,
  );
}

export function setInputPrompt(
  definition: GameDefinition,
  operationId: string,
  prompt: string,
): GameDefinition {
  return updateOperation(definition, operationId, (operation) =>
    operation.kind === 'input.wait' ? { ...operation, prompt } : operation,
  );
}

export function setInputOptions(
  definition: GameDefinition,
  operationId: string,
  options: readonly string[],
): GameDefinition {
  return updateOperation(definition, operationId, (operation) =>
    operation.kind === 'input.wait' && options.length > 0 ? { ...operation, options } : operation,
  );
}

export function producerIdForReference(
  definition: GameDefinition,
  variableName: string,
): string | undefined {
  const produces = (operation: Operation): string | undefined => {
    switch (operation.kind) {
      case 'random.select':
      case 'collection.draw':
      case 'collection.shuffle':
      case 'input.wait':
        return operation.output === variableName ? operation.id : undefined;
      case 'composite.invoke':
        return Object.values(operation.outputs).includes(variableName) ? operation.id : undefined;
      case 'set':
        return operation.variable === variableName ? operation.id : undefined;
      default:
        return undefined;
    }
  };
  return (
    visitOperation(definition.root, produces) ??
    definition.composites
      .map((composite) => visitOperation(composite.implementation, produces))
      .find((id) => id !== undefined)
  );
}

export type ReferenceSource =
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'operation'; readonly id: string; readonly workflowId?: string };

export function resolveReferenceSource(
  definition: GameDefinition,
  variableName: string,
  activeWorkflowId?: string,
): ReferenceSource | undefined {
  if (activeWorkflowId) {
    const workflow = definition.composites.find((item) => item.id === activeWorkflowId);
    if (workflow?.inputs.some((input) => input.name === variableName)) {
      const invocation = visitOperation(definition.root, (operation) =>
        operation.kind === 'composite.invoke' && operation.compositeId === activeWorkflowId
          ? operation
          : undefined,
      );
      const binding = invocation?.arguments[variableName];
      if (binding?.kind === 'variable')
        return resolveReferenceSource(definition, binding.name, undefined);
    }
  }
  const rootProducer = visitOperation(definition.root, (operation) =>
    producesVariable(operation, variableName) ? operation.id : undefined,
  );
  if (rootProducer) return { kind: 'operation', id: rootProducer };
  for (const workflow of definition.composites) {
    const producer = visitOperation(workflow.implementation, (operation) =>
      producesVariable(operation, variableName) ? operation.id : undefined,
    );
    if (producer) return { kind: 'operation', id: producer, workflowId: workflow.id };
  }
  return definition.variables.some(
    (variable) => variable.name === variableName && variable.initial !== undefined,
  )
    ? { kind: 'resource', id: variableName }
    : undefined;
}

export function expressionLabel(expression: Expression): string {
  if (expression.kind === 'variable') return expression.name;
  if (expression.kind === 'literal') {
    if (
      typeof expression.value === 'string' ||
      typeof expression.value === 'number' ||
      typeof expression.value === 'boolean'
    )
      return String(expression.value);
    return JSON.stringify(expression.value);
  }
  return expression.kind;
}

export function operationSummary(operation: Operation, definition?: GameDefinition): string {
  switch (operation.kind) {
    case 'random.select':
      return `From ${expressionLabel(operation.from)} · result ${displayName(operation.output)}`;
    case 'collection.draw':
      return `${operation.collectionVariable} → ${operation.output}`;
    case 'input.wait':
      return `${operation.prompt} → ${operation.output}`;
    case 'time.wait':
      return `${operation.durationMs / 1000} seconds`;
    case 'control.foreach':
      return `${expressionLabel(operation.collection)} · current item ${displayName(operation.itemVariable)}`;
    case 'control.if':
      return operation.condition.kind === 'equals'
        ? `${expressionLabel(operation.condition.left)} equals ${expressionLabel(operation.condition.right)}`
        : operation.condition.kind;
    case 'composite.invoke':
      return `${definition?.composites.find((item) => item.id === operation.compositeId)?.name ?? displayName(operation.compositeId)} · reusable Workflow`;
    case 'present':
      return expressionLabel(operation.message);
    case 'control.parallel':
      return `${operation.branches.length} branches · wait for all`;
    case 'end':
      return 'Complete game';
    case 'sequence':
      return `${operation.steps.length} steps`;
    case 'set':
      return `${displayName(operation.variable)} = ${expressionLabel(operation.value)}`;
    case 'collection.shuffle':
      return `${expressionLabel(operation.collection)} · result ${displayName(operation.output)}`;
  }
}

export function referenceNames(operation: Operation): readonly string[] {
  switch (operation.kind) {
    case 'collection.draw':
      return [operation.collectionVariable];
    case 'input.wait':
      return operation.participant.kind === 'variable' ? [operation.participant.name] : [];
    case 'composite.invoke':
      return Object.values(operation.arguments).flatMap((value) =>
        value.kind === 'variable' ? [value.name] : [],
      );
    case 'present':
      return operation.audience.kind === 'participant' && operation.audience.id.kind === 'variable'
        ? [operation.audience.id.name]
        : [];
    default:
      return [];
  }
}

export function displayName(value: string): string {
  return value
    .replace(/[.-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function safeVariableReference(name: string) {
  return variable(name);
}

interface OperationLocation {
  readonly sequenceId: string;
  readonly index: number;
  readonly operation: Operation;
}

function visitOperation<T>(
  operation: Operation,
  find: (operation: Operation) => T | undefined,
): T | undefined {
  const found = find(operation);
  if (found) return found;
  switch (operation.kind) {
    case 'sequence':
      for (const child of operation.steps) {
        const result = visitOperation(child, find);
        if (result) return result;
      }
      return undefined;
    case 'control.foreach':
      return visitOperation(operation.body, find);
    case 'control.if':
      return (
        visitOperation(operation.then, find) ??
        (operation.else ? visitOperation(operation.else, find) : undefined)
      );
    case 'control.parallel':
      for (const child of operation.branches) {
        const result = visitOperation(child, find);
        if (result) return result;
      }
      return undefined;
    default:
      return undefined;
  }
}

function producesVariable(operation: Operation, variableName: string): boolean {
  switch (operation.kind) {
    case 'random.select':
    case 'collection.draw':
    case 'collection.shuffle':
    case 'input.wait':
      return operation.output === variableName;
    case 'composite.invoke':
      return Object.values(operation.outputs).includes(variableName);
    case 'set':
      return operation.variable === variableName;
    default:
      return false;
  }
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

function locateInDefinition(definition: GameDefinition, id: string): OperationLocation | undefined {
  return (
    locateOperation(definition.root, id) ??
    definition.composites
      .map((composite) => locateOperation(composite.implementation, id))
      .find((location) => location !== undefined)
  );
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
        Boolean(operation.else && containsOperation(operation.else, id))
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

function mapDefinition(
  definition: GameDefinition,
  update: (operation: Operation) => Operation,
): GameDefinition {
  return {
    ...definition,
    root: mapTree(definition.root, update),
    composites: definition.composites.map((composite) => ({
      ...composite,
      implementation: mapTree(composite.implementation, update),
    })),
  };
}
