import {
  t,
  type CompositeDefinition,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
} from '@traquenard/game-ir';
import { sameType } from '@traquenard/game-validator';
import { authoredDataDeclarations } from './data.js';
import { expressionType } from './expressions.js';
import { displayName, showType } from './formatting.js';
import type { AuthoringCandidate, AuthoringValue, SemanticLocation } from './types.js';

export function locationForOperation(
  definition: GameDefinition,
  operationId: string,
): SemanticLocation | undefined {
  const root = locateInTree(
    definition.root,
    operationId,
    undefined,
    rootValues(definition),
    definition,
  );
  if (root) return root.location;
  for (const workflow of definition.composites) {
    const incoming = workflow.inputs.map((port) =>
      workflowInputValue(workflow, port.name, port.type),
    );
    const found = locateInTree(
      workflow.implementation,
      operationId,
      workflow.id,
      incoming,
      definition,
    );
    if (found) return found.location;
  }
  return undefined;
}

export function availableValuesAt(
  definition: GameDefinition,
  location: SemanticLocation,
): readonly AuthoringValue[] {
  const workflow = location.workflowId
    ? definition.composites.find((item) => item.id === location.workflowId)
    : undefined;
  const start = workflow
    ? workflow.inputs.map((port) => workflowInputValue(workflow, port.name, port.type))
    : rootValues(definition);
  const tree = workflow?.implementation ?? (location.workflowId ? undefined : definition.root);
  return tree
    ? (valuesForSequence(tree, location.sequenceId, location.index, start, definition) ?? start)
    : start;
}

export function availableValuesForOperation(
  definition: GameDefinition,
  operationId: string,
): readonly AuthoringValue[] {
  const root = locateInTree(
    definition.root,
    operationId,
    undefined,
    rootValues(definition),
    definition,
  );
  if (root) return root.available;
  for (const workflow of definition.composites) {
    const incoming = workflow.inputs.map((port) =>
      workflowInputValue(workflow, port.name, port.type),
    );
    const found = locateInTree(
      workflow.implementation,
      operationId,
      workflow.id,
      incoming,
      definition,
    );
    if (found) return found.available;
  }
  return [];
}

export function valueCandidatesForOperation(
  definition: GameDefinition,
  operationId: string,
  expectedType: TypeRef,
): readonly AuthoringCandidate[] {
  return availableValuesForOperation(definition, operationId).map((value) =>
    sameType(value.type, expectedType)
      ? { reference: value, value, compatible: true }
      : {
          reference: value,
          value,
          compatible: false,
          reason: `Expected ${showType(expectedType)}, received ${showType(value.type)}.`,
        },
  );
}

export function collectionCandidatesForOperation(
  definition: GameDefinition,
  operationId: string,
): readonly AuthoringCandidate[] {
  return availableValuesForOperation(definition, operationId).map((value) =>
    value.type.kind === 'collection'
      ? { reference: value, value, compatible: true }
      : {
          reference: value,
          value,
          compatible: false,
          reason: `Expected a collection, received ${showType(value.type)}.`,
        },
  );
}

export function expressionTypeAtOperation(
  definition: GameDefinition,
  operationId: string,
  expression: Expression,
): TypeRef | undefined {
  return expressionType(expression, availableValuesForOperation(definition, operationId));
}

function rootValues(definition: GameDefinition): readonly AuthoringValue[] {
  return [
    {
      id: 'runtime.players',
      label: 'Players',
      type: t.collection(t.participant),
      family: 'runtime',
      sourceLabel: 'Provided by the running session',
      source: { kind: 'runtime' },
    },
    ...authoredDataDeclarations(definition).map((item) => ({
      id: item.name,
      label: displayName(item.name),
      type: item.type,
      family: 'authored-data' as const,
      sourceLabel: 'Authored Data',
      source: { kind: 'variable' as const, variableName: item.name },
    })),
  ];
}

function workflowInputValue(
  workflow: CompositeDefinition,
  name: string,
  type: TypeRef,
): AuthoringValue {
  return {
    id: name,
    label: displayName(name),
    type,
    family: 'workflow-input',
    sourceLabel: `Input to ${workflow.name}`,
    source: { kind: 'composite-port', compositeId: workflow.id, direction: 'input' },
  };
}

function flowValue(name: string, type: TypeRef, blockId: string): AuthoringValue {
  return {
    id: name,
    label: displayName(name),
    type,
    family: 'flow-output',
    sourceLabel: `Produced by ${displayName(blockId)}`,
    source: { kind: 'block', blockId },
  };
}

function outputValues(operation: Operation, definition: GameDefinition): readonly AuthoringValue[] {
  const declaration = (name: string) =>
    definition.variables.find((item) => item.name === name)?.type ??
    definition.composites
      .flatMap((item) => [...item.inputs, ...item.outputs])
      .find((item) => item.name === name)?.type;
  switch (operation.kind) {
    case 'random.select':
    case 'input.wait':
    case 'collection.shuffle':
    case 'collection.draw': {
      const type = declaration(operation.output);
      return type ? [flowValue(operation.output, type, operation.id)] : [];
    }
    case 'composite.invoke':
      return Object.entries(operation.outputs).flatMap(([portName, target]) => {
        const type = definition.composites
          .find((item) => item.id === operation.compositeId)
          ?.outputs.find((item) => item.name === portName)?.type;
        return type ? [flowValue(target, type, operation.id)] : [];
      });
    case 'set': {
      const type = declaration(operation.variable);
      return type ? [flowValue(operation.variable, type, operation.id)] : [];
    }
    case 'control.parallel':
      return operation.branches.flatMap((branch) => outputValues(branch, definition));
    default:
      return [];
  }
}

interface LocatedOperation {
  readonly location: SemanticLocation;
  readonly available: readonly AuthoringValue[];
}

function locateInTree(
  operation: Operation,
  targetId: string,
  workflowId: string | undefined,
  incoming: readonly AuthoringValue[],
  definition: GameDefinition,
  parentSequenceId = operation.kind === 'sequence' ? operation.id : '',
  parentIndex = 0,
): LocatedOperation | undefined {
  if (operation.id === targetId)
    return {
      location: {
        sequenceId: parentSequenceId,
        index: parentIndex,
        ...(workflowId ? { workflowId } : {}),
      },
      available: uniqueValues(incoming),
    };
  if (operation.kind === 'sequence') {
    const available = [...incoming];
    for (const [index, child] of operation.steps.entries()) {
      const found = locateInTree(
        child,
        targetId,
        workflowId,
        available,
        definition,
        operation.id,
        index,
      );
      if (found) return found;
      available.push(...outputValues(child, definition));
    }
    return undefined;
  }
  if (operation.kind === 'control.foreach') {
    const collectionType = expressionType(operation.collection, incoming);
    const itemType = collectionType?.kind === 'collection' ? collectionType.element : t.participant;
    return locateInTree(
      operation.body,
      targetId,
      workflowId,
      [...incoming, flowValue(operation.itemVariable, itemType, operation.id)],
      definition,
      parentSequenceId,
      parentIndex,
    );
  }
  if (operation.kind === 'control.if')
    return (
      locateInTree(
        operation.then,
        targetId,
        workflowId,
        incoming,
        definition,
        parentSequenceId,
        parentIndex,
      ) ??
      (operation.else
        ? locateInTree(
            operation.else,
            targetId,
            workflowId,
            incoming,
            definition,
            parentSequenceId,
            parentIndex,
          )
        : undefined)
    );
  if (operation.kind === 'control.parallel') {
    for (const branch of operation.branches) {
      const found = locateInTree(
        branch,
        targetId,
        workflowId,
        incoming,
        definition,
        parentSequenceId,
        parentIndex,
      );
      if (found) return found;
    }
  }
  return undefined;
}

function valuesForSequence(
  operation: Operation,
  sequenceId: string,
  index: number,
  incoming: readonly AuthoringValue[],
  definition: GameDefinition,
): readonly AuthoringValue[] | undefined {
  if (operation.kind === 'sequence') {
    const available = [...incoming];
    if (operation.id === sequenceId) {
      for (const child of operation.steps.slice(0, index))
        available.push(...outputValues(child, definition));
      return uniqueValues(available);
    }
    for (const child of operation.steps) {
      const nested = valuesForSequence(child, sequenceId, index, available, definition);
      if (nested) return nested;
      available.push(...outputValues(child, definition));
    }
    return undefined;
  }
  if (operation.kind === 'control.foreach') {
    const type = expressionType(operation.collection, incoming);
    const itemType = type?.kind === 'collection' ? type.element : t.participant;
    return valuesForSequence(
      operation.body,
      sequenceId,
      index,
      [...incoming, flowValue(operation.itemVariable, itemType, operation.id)],
      definition,
    );
  }
  if (operation.kind === 'control.if')
    return (
      valuesForSequence(operation.then, sequenceId, index, incoming, definition) ??
      (operation.else
        ? valuesForSequence(operation.else, sequenceId, index, incoming, definition)
        : undefined)
    );
  return undefined;
}

function uniqueValues(values: readonly AuthoringValue[]): readonly AuthoringValue[] {
  return [...new Map(values.map((item) => [item.id, item])).values()];
}
