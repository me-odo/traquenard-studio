import type { GameDefinition, Operation } from '@traquenard/game-ir';
import { sameType, validateDefinition } from '@traquenard/game-validator';
import { authoredDataDeclarations } from './data.js';
import { operationLabel } from './descriptors.js';
import { displayName, showType } from './formatting.js';
import { operationReferences } from './references.js';
import { allOperations, operationInputNames, operationOutputNames } from './traversal.js';
import type { AuthoringDiagnostic } from './types.js';
import { availableValuesForOperation } from './values.js';

export function authoringDiagnostics(definition: GameDefinition): readonly AuthoringDiagnostic[] {
  const diagnostics: AuthoringDiagnostic[] = validateDefinition(definition).issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
  }));
  const authored = new Set(authoredDataDeclarations(definition).map((item) => item.name));
  scanAvailability(definition.root, new Set(authored), diagnostics);
  for (const workflow of definition.composites)
    scanAvailability(
      workflow.implementation,
      new Set(workflow.inputs.map((item) => item.name)),
      diagnostics,
    );
  for (const operation of allOperations(definition)) {
    if (
      operation.kind === 'composite.invoke' &&
      !definition.composites.some((item) => item.id === operation.compositeId)
    )
      diagnostics.push({
        code: 'unknown_workflow',
        operationId: operation.id,
        field: 'workflow',
        message: `${operationLabel(operation)} targets the deleted Workflow ${displayName(operation.compositeId)}.`,
      });
    const available = availableValuesForOperation(definition, operation.id);
    for (const reference of operationReferences(definition, operation)) {
      if (reference.expression.kind !== 'variable') continue;
      const referenceName = reference.expression.name;
      const actual = available.find((item) => item.id === referenceName)?.type;
      if (actual && !sameType(actual, reference.expectedType))
        diagnostics.push({
          code: 'incompatible_reference',
          operationId: operation.id,
          field: reference.path,
          message: `${displayName(referenceName)} has type ${showType(actual)}, but ${reference.label} requires ${showType(reference.expectedType)}.`,
        });
    }
  }
  return uniqueDiagnostics(diagnostics);
}

function scanAvailability(
  operation: Operation,
  incoming: Set<string>,
  diagnostics: AuthoringDiagnostic[],
): void {
  if (operation.kind === 'sequence') {
    for (const child of operation.steps) {
      scanAvailability(child, incoming, diagnostics);
      for (const output of operationOutputNames(child)) incoming.add(output);
    }
    return;
  }
  for (const { name, field } of operationInputNames(operation)) {
    if (!incoming.has(name))
      diagnostics.push({
        code: 'value_unavailable',
        operationId: operation.id,
        field,
        message: `${displayName(name)} is not available for ${operationLabel(operation)} · ${field}.`,
      });
  }
  if (operation.kind === 'control.foreach') {
    const child = new Set(incoming);
    child.add(operation.itemVariable);
    scanAvailability(operation.body, child, diagnostics);
  } else if (operation.kind === 'control.if') {
    scanAvailability(operation.then, new Set(incoming), diagnostics);
    if (operation.else) scanAvailability(operation.else, new Set(incoming), diagnostics);
  } else if (operation.kind === 'control.parallel') {
    for (const branch of operation.branches)
      scanAvailability(branch, new Set(incoming), diagnostics);
  }
}

function uniqueDiagnostics(values: readonly AuthoringDiagnostic[]): readonly AuthoringDiagnostic[] {
  return [
    ...new Map(
      values.map((item) => [
        `${item.code}:${item.operationId ?? ''}:${item.field ?? ''}:${item.message}`,
        item,
      ]),
    ).values(),
  ];
}
