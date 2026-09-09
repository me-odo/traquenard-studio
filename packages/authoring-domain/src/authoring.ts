import {
  t,
  variable,
  type Audience,
  type CompositeDefinition,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
  type Value,
  type VariableDeclaration,
} from '@traquenard/game-ir';
import { sameType, validateDefinition } from '@traquenard/game-validator';

export type OperationKind = Operation['kind'];
export type AuthoringPolicy = 'insertable' | 'structural' | 'restricted' | 'unavailable';
export type RendererPolicy = 'ordinary' | 'structured' | 'parallel' | 'internal';

export interface OperationDescriptor {
  readonly kind: OperationKind;
  readonly label: string;
  readonly explanation: string;
  readonly category: 'Data' | 'Message' | 'Input' | 'Control' | 'Workflow' | 'Internal';
  readonly policy: AuthoringPolicy;
  readonly renderer: RendererPolicy;
  readonly inspector: 'editable' | 'read-only' | 'internal';
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly references: readonly string[];
  readonly structural: boolean;
  readonly unavailableReason?: string;
}

export const operationDescriptors = {
  sequence: descriptor(
    'sequence',
    'Sequence',
    'Orders steps.',
    'Internal',
    'structural',
    'internal',
  ),
  set: descriptor(
    'set',
    'Set value',
    'Assign a compatible value to authored state.',
    'Data',
    'insertable',
    'ordinary',
    ['target', 'value'],
    [],
    ['value'],
  ),
  'random.select': descriptor(
    'random.select',
    'Pick random item',
    'Select one item from a collection using engine randomness.',
    'Data',
    'insertable',
    'ordinary',
    ['from'],
    ['result'],
    ['from'],
  ),
  present: descriptor(
    'present',
    'Show message',
    'Show a message to an audience.',
    'Message',
    'insertable',
    'ordinary',
    ['message', 'audience'],
    [],
    ['message', 'audience'],
  ),
  'input.wait': descriptor(
    'input.wait',
    'Ask for choice',
    'Ask one participant to choose an option.',
    'Input',
    'insertable',
    'ordinary',
    ['participant', 'prompt', 'options'],
    ['result'],
    ['participant'],
  ),
  'control.if': descriptor(
    'control.if',
    'If',
    'Run THEN or ELSE based on a boolean condition.',
    'Control',
    'insertable',
    'structured',
    ['condition'],
    [],
    ['condition'],
  ),
  'control.foreach': descriptor(
    'control.foreach',
    'For each',
    'Run a body once for every item in a collection.',
    'Control',
    'insertable',
    'structured',
    ['collection'],
    ['current item'],
    ['collection'],
  ),
  'control.parallel': descriptor(
    'control.parallel',
    'Parallel',
    'Run the current restricted branch kinds together and wait for all.',
    'Control',
    'restricted',
    'parallel',
    ['branches'],
    [],
    [],
  ),
  'time.wait': descriptor(
    'time.wait',
    'Wait',
    'Wait using logical time.',
    'Control',
    'insertable',
    'ordinary',
    ['duration'],
  ),
  'collection.shuffle': descriptor(
    'collection.shuffle',
    'Shuffle collection',
    'Create a shuffled collection using engine randomness.',
    'Data',
    'insertable',
    'ordinary',
    ['collection'],
    ['result'],
    ['collection'],
  ),
  'collection.draw': descriptor(
    'collection.draw',
    'Draw item',
    'Remove and return the first item from a collection variable.',
    'Data',
    'insertable',
    'ordinary',
    ['collection'],
    ['result'],
    ['collection'],
  ),
  'composite.invoke': descriptor(
    'composite.invoke',
    'Run workflow',
    'Invoke a named reusable Workflow with typed bindings.',
    'Workflow',
    'insertable',
    'ordinary',
    ['arguments'],
    ['bindings'],
    ['arguments'],
  ),
  end: descriptor('end', 'End game', 'Complete the game session.', 'Control'),
} satisfies Record<OperationKind, OperationDescriptor>;

export const insertableOperationKinds = Object.values(operationDescriptors)
  .filter((item) => item.policy === 'insertable' || item.policy === 'restricted')
  .map((item) => item.kind);

export type ValueFamily = 'runtime' | 'authored-data' | 'flow-output' | 'workflow-input';

export interface AuthoringValue {
  readonly id: string;
  readonly label: string;
  readonly type: TypeRef;
  readonly family: ValueFamily;
  readonly sourceLabel: string;
  readonly source:
    | { readonly kind: 'runtime' }
    | { readonly kind: 'variable'; readonly variableName: string }
    | { readonly kind: 'block'; readonly blockId: string }
    | {
        readonly kind: 'composite-port';
        readonly compositeId: string;
        readonly direction: 'input';
      };
}

export interface AuthoringCandidate {
  readonly reference: AuthoringValue;
  readonly compatible: boolean;
  readonly reason?: string;
  readonly value: AuthoringValue;
}

export interface SemanticLocation {
  readonly sequenceId: string;
  readonly index: number;
  readonly workflowId?: string;
}

export interface OperationReference {
  readonly ownerOperationId: string;
  readonly path: string;
  readonly label: string;
  readonly expectedType: TypeRef;
  readonly expression: Expression;
}

export interface AuthoringDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly operationId?: string;
  readonly field?: string;
}

export type AuthoredDataKind = 'collection' | 'state' | 'string' | 'boolean';

export function operationDescriptor(kind: OperationKind): OperationDescriptor {
  return operationDescriptors[kind];
}

export function operationLabel(operation: Operation): string {
  return operationDescriptor(operation.kind).label;
}

export function authoredDataDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return definition.variables.filter((item) => item.initial !== undefined);
}

export function authoredCollectionDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return authoredDataDeclarations(definition).filter((item) => item.type.kind === 'collection');
}

export function authoredStateDeclarations(
  definition: GameDefinition,
): readonly VariableDeclaration[] {
  return authoredDataDeclarations(definition).filter((item) => item.type.kind !== 'collection');
}

export function flowOutputDeclarations(definition: GameDefinition): readonly VariableDeclaration[] {
  const produced = new Set(allOperations(definition).flatMap(operationOutputNames));
  return definition.variables.filter(
    (item) => item.initial === undefined && produced.has(item.name),
  );
}

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

export function operationReferences(
  definition: GameDefinition,
  operation: Operation,
): readonly OperationReference[] {
  const refs: OperationReference[] = [];
  const pushExpression = (
    path: string,
    label: string,
    expectedType: TypeRef,
    expression: Expression,
  ) => {
    for (const nested of referenceExpressions(expression))
      refs.push({ ownerOperationId: operation.id, path, label, expectedType, expression: nested });
  };
  switch (operation.kind) {
    case 'set': {
      const expected = definition.variables.find((item) => item.name === operation.variable)?.type;
      if (expected) pushExpression('value', 'Value', expected, operation.value);
      break;
    }
    case 'random.select': {
      const output = definition.variables.find((item) => item.name === operation.output)?.type;
      if (output) pushExpression('from', 'From', t.collection(output), operation.from);
      break;
    }
    case 'present':
      pushExpression('message', 'Message', t.string, operation.message);
      if (operation.audience.kind === 'participant')
        pushExpression('audience.id', 'Audience', t.participant, operation.audience.id);
      if (operation.audience.kind === 'participants')
        pushExpression(
          'audience.ids',
          'Audience',
          t.collection(t.participant),
          operation.audience.ids,
        );
      break;
    case 'input.wait':
      pushExpression('participant', 'Participant', t.participant, operation.participant);
      break;
    case 'control.if':
      if (operation.condition.kind === 'equals') {
        const leftType = expressionTypeAtOperation(
          definition,
          operation.id,
          operation.condition.left,
        );
        const rightType = expressionTypeAtOperation(
          definition,
          operation.id,
          operation.condition.right,
        );
        if (leftType)
          pushExpression('condition.left', 'Left operand', leftType, operation.condition.left);
        if (rightType)
          pushExpression('condition.right', 'Right operand', rightType, operation.condition.right);
      } else pushExpression('condition', 'Condition', t.boolean, operation.condition);
      break;
    case 'control.foreach':
      for (const expression of referenceExpressions(operation.collection)) {
        const type = expressionTypeAtOperation(definition, operation.id, expression);
        if (type)
          refs.push({
            ownerOperationId: operation.id,
            path: 'collection',
            label: 'Collection',
            expectedType: type,
            expression,
          });
      }
      break;
    case 'collection.shuffle': {
      const output = definition.variables.find((item) => item.name === operation.output)?.type;
      if (output) pushExpression('collection', 'Collection', output, operation.collection);
      break;
    }
    case 'collection.draw': {
      const source = availableValuesForOperation(definition, operation.id).find(
        (item) => item.id === operation.collectionVariable,
      );
      if (source)
        refs.push({
          ownerOperationId: operation.id,
          path: 'collectionVariable',
          label: 'Collection',
          expectedType: source.type,
          expression: variable(operation.collectionVariable),
        });
      break;
    }
    case 'composite.invoke': {
      const workflow = definition.composites.find((item) => item.id === operation.compositeId);
      for (const port of workflow?.inputs ?? []) {
        const expression = operation.arguments[port.name];
        if (expression) pushExpression(`arguments.${port.name}`, port.name, port.type, expression);
      }
      break;
    }
  }
  return refs;
}

export function changeForeachCollection(
  definition: GameDefinition,
  operationId: string,
  collection: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, collection);
  if (type?.kind !== 'collection') return definition;
  return updateDefinitionOperation(definition, operationId, (operation) =>
    operation.kind === 'control.foreach' ? { ...operation, collection } : operation,
  );
}

export function renameForeachBindingSafely(
  definition: GameDefinition,
  operationId: string,
  nextName: string,
): GameDefinition {
  const name = identifier(nextName);
  if (!name) return definition;
  return updateDefinitionOperation(definition, operationId, (operation) => {
    if (operation.kind !== 'control.foreach' || operation.itemVariable === name) return operation;
    return {
      ...operation,
      itemVariable: name,
      body: rewriteOperationExpressions(operation.body, operation.itemVariable, name),
    };
  });
}

export function changeRandomSelectSource(
  definition: GameDefinition,
  operationId: string,
  from: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, from);
  if (type?.kind !== 'collection') return definition;
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'random.select') return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'random.select' ? { ...item, from } : item,
    ),
    operation.output,
    type.element,
  );
}

export function changeShuffleSource(
  definition: GameDefinition,
  operationId: string,
  collection: Expression,
): GameDefinition {
  const type = expressionTypeAtOperation(definition, operationId, collection);
  if (type?.kind !== 'collection') return definition;
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'collection.shuffle') return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'collection.shuffle' ? { ...item, collection } : item,
    ),
    operation.output,
    type,
  );
}

export function changeDrawSource(
  definition: GameDefinition,
  operationId: string,
  collectionVariable: string,
): GameDefinition {
  const source = availableValuesForOperation(definition, operationId).find(
    (item) => item.id === collectionVariable && item.type.kind === 'collection',
  );
  const operation = findOperation(definition, operationId);
  if (!source || source.type.kind !== 'collection' || operation?.kind !== 'collection.draw')
    return definition;
  return updateVariableType(
    updateDefinitionOperation(definition, operationId, (item) =>
      item.kind === 'collection.draw' ? { ...item, collectionVariable } : item,
    ),
    operation.output,
    source.type.element,
  );
}

export function setConditionOperand(
  definition: GameDefinition,
  operationId: string,
  side: 'left' | 'right',
  expression: Expression,
): GameDefinition {
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'control.if' || operation.condition.kind !== 'equals') return definition;
  const other = side === 'left' ? operation.condition.right : operation.condition.left;
  const expressionTypeValue = expressionTypeAtOperation(definition, operationId, expression);
  const otherType = expressionTypeAtOperation(definition, operationId, other);
  if (!expressionTypeValue || !otherType || !sameType(expressionTypeValue, otherType))
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'control.if' && item.condition.kind === 'equals'
      ? { ...item, condition: { ...item.condition, [side]: expression } }
      : item,
  );
}

export function changeInputParticipant(
  definition: GameDefinition,
  operationId: string,
  participant: Expression,
): GameDefinition {
  if (
    !sameType(
      expressionTypeAtOperation(definition, operationId, participant) ?? t.string,
      t.participant,
    )
  )
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'input.wait' ? { ...item, participant } : item,
  );
}

export function changePresentMessage(
  definition: GameDefinition,
  operationId: string,
  message: Expression,
): GameDefinition {
  if (!sameType(expressionTypeAtOperation(definition, operationId, message) ?? t.number, t.string))
    return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'present' ? { ...item, message } : item,
  );
}

export function changeAudience(
  definition: GameDefinition,
  operationId: string,
  audience: Audience,
): GameDefinition {
  if (audience.kind === 'participant') {
    const type = expressionTypeAtOperation(definition, operationId, audience.id);
    if (!type || !sameType(type, t.participant)) return definition;
  }
  if (audience.kind === 'participants') {
    const type = expressionTypeAtOperation(definition, operationId, audience.ids);
    if (!type || !sameType(type, t.collection(t.participant))) return definition;
  }
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'present' ? { ...item, audience } : item,
  );
}

export function changeWorkflowArgument(
  definition: GameDefinition,
  operationId: string,
  portName: string,
  expression: Expression,
): GameDefinition {
  const operation = findOperation(definition, operationId);
  if (operation?.kind !== 'composite.invoke') return definition;
  const expected = definition.composites
    .find((item) => item.id === operation.compositeId)
    ?.inputs.find((item) => item.name === portName)?.type;
  const actual = expressionTypeAtOperation(definition, operationId, expression);
  if (!expected || !actual || !sameType(expected, actual)) return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'composite.invoke'
      ? { ...item, arguments: { ...item.arguments, [portName]: expression } }
      : item,
  );
}

export function setStateValue(
  definition: GameDefinition,
  operationId: string,
  target: string,
  value: Expression,
): GameDefinition {
  const expected = authoredStateDeclarations(definition).find((item) => item.name === target)?.type;
  const actual = expressionTypeAtOperation(definition, operationId, value);
  if (!expected || !actual || !sameType(expected, actual)) return definition;
  return updateDefinitionOperation(definition, operationId, (item) =>
    item.kind === 'set' ? { ...item, variable: target, value } : item,
  );
}

export function deleteOperationCommand(
  definition: GameDefinition,
  operationId: string,
): GameDefinition {
  return {
    ...definition,
    root: removeOperation(definition.root, operationId),
    composites: definition.composites.map((workflow) => ({
      ...workflow,
      implementation: removeOperation(workflow.implementation, operationId),
    })),
  };
}

export function createAuthoredData(
  definition: GameDefinition,
  kind: AuthoredDataKind,
  requestedName: string,
): GameDefinition {
  const name = uniqueName(
    definition.variables.map((item) => item.name),
    identifier(requestedName) || kind,
  );
  const declaration: VariableDeclaration =
    kind === 'collection'
      ? { name, type: t.collection(t.card), initial: [] }
      : kind === 'string'
        ? { name, type: t.string, initial: '' }
        : kind === 'boolean'
          ? { name, type: t.boolean, initial: false }
          : { name, type: t.number, initial: 0 };
  return { ...definition, variables: [...definition.variables, declaration] };
}

export function updateAuthoredDataInitial(
  definition: GameDefinition,
  variableName: string,
  initial: Value,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) =>
      item.name === variableName && item.initial !== undefined ? { ...item, initial } : item,
    ),
  };
}

export function deleteAuthoredData(
  definition: GameDefinition,
  variableName: string,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.filter(
      (item) => item.name !== variableName || item.initial === undefined,
    ),
  };
}

export function createWorkflowCommand(
  definition: GameDefinition,
  requestedName = 'New workflow',
): GameDefinition {
  const id = uniqueName(
    definition.composites.map((item) => item.id),
    identifier(requestedName) || 'workflow',
  );
  const workflow: CompositeDefinition = {
    id,
    version: 1,
    name: requestedName,
    inputs: [],
    outputs: [],
    implementation: { id: `${id}-sequence`, kind: 'sequence', steps: [] },
  };
  return { ...definition, composites: [...definition.composites, workflow] };
}

export function renameWorkflowCommand(
  definition: GameDefinition,
  workflowId: string,
  name: string,
): GameDefinition {
  if (!name.trim()) return definition;
  return {
    ...definition,
    composites: definition.composites.map((item) =>
      item.id === workflowId ? { ...item, name: name.trim() } : item,
    ),
  };
}

export function deleteWorkflowCommand(
  definition: GameDefinition,
  workflowId: string,
): GameDefinition {
  return {
    ...definition,
    composites: definition.composites.filter((item) => item.id !== workflowId),
  };
}

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

export function findOperation(definition: GameDefinition, id: string): Operation | undefined {
  return allOperations(definition).find((item) => item.id === id);
}

export function expressionType(
  expression: Expression,
  available: readonly Pick<AuthoringValue, 'id' | 'type'>[],
): TypeRef | undefined {
  switch (expression.kind) {
    case 'participants':
      return t.collection(t.participant);
    case 'literal':
      return expression.valueType;
    case 'variable':
      return available.find((item) => item.id === expression.name)?.type;
    case 'equals':
      return t.boolean;
  }
}

function descriptor(
  kind: OperationKind,
  label: string,
  explanation: string,
  category: OperationDescriptor['category'],
  policy: AuthoringPolicy = 'insertable',
  renderer: RendererPolicy = 'ordinary',
  inputs: readonly string[] = [],
  outputs: readonly string[] = [],
  references: readonly string[] = [],
): OperationDescriptor {
  return {
    kind,
    label,
    explanation,
    category,
    policy,
    renderer,
    inspector: policy === 'structural' ? 'internal' : 'editable',
    inputs,
    outputs,
    references,
    structural: renderer === 'structured' || renderer === 'parallel' || renderer === 'internal',
    ...(policy === 'restricted'
      ? { unavailableReason: 'IR v1 permits only independent message, input, or wait branches.' }
      : {}),
  };
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
    sourceLabel: `Produced by ${operationLabelFromId(blockId)}`,
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

function updateDefinitionOperation(
  definition: GameDefinition,
  id: string,
  update: (operation: Operation) => Operation,
): GameDefinition {
  return {
    ...definition,
    root: updateOperation(definition.root, id, update),
    composites: definition.composites.map((workflow) => ({
      ...workflow,
      implementation: updateOperation(workflow.implementation, id, update),
    })),
  };
}

function updateOperation(
  operation: Operation,
  id: string,
  update: (operation: Operation) => Operation,
): Operation {
  const childrenMapped: Operation = (() => {
    switch (operation.kind) {
      case 'sequence':
        return {
          ...operation,
          steps: operation.steps.map((item) => updateOperation(item, id, update)),
        };
      case 'control.foreach':
        return { ...operation, body: updateOperation(operation.body, id, update) };
      case 'control.if': {
        const otherwise = operation.else ? updateOperation(operation.else, id, update) : undefined;
        return {
          ...operation,
          then: updateOperation(operation.then, id, update),
          ...(otherwise ? { else: otherwise } : {}),
        };
      }
      case 'control.parallel':
        return {
          ...operation,
          branches: operation.branches.map((item) => updateOperation(item, id, update)),
        };
      default:
        return operation;
    }
  })();
  return childrenMapped.id === id ? update(childrenMapped) : childrenMapped;
}

function removeOperation(operation: Operation, id: string): Operation {
  switch (operation.kind) {
    case 'sequence':
      return {
        ...operation,
        steps: operation.steps
          .filter((item) => item.id !== id)
          .map((item) => removeOperation(item, id)),
      };
    case 'control.foreach':
      return { ...operation, body: removeOperation(operation.body, id) };
    case 'control.if': {
      const otherwise = operation.else ? removeOperation(operation.else, id) : undefined;
      return {
        ...operation,
        then: removeOperation(operation.then, id),
        ...(otherwise ? { else: otherwise } : {}),
      };
    }
    case 'control.parallel':
      return {
        ...operation,
        branches: operation.branches
          .filter((item) => item.id !== id)
          .map((item) => removeOperation(item, id)),
      };
    default:
      return operation;
  }
}

function rewriteOperationExpressions(
  operation: Operation,
  before: string,
  after: string,
): Operation {
  const rewrite = (expression: Expression): Expression => {
    if (expression.kind === 'variable')
      return expression.name === before ? variable(after) : expression;
    if (expression.kind === 'equals')
      return { ...expression, left: rewrite(expression.left), right: rewrite(expression.right) };
    return expression;
  };
  const rewriteAudience = (audience: Audience): Audience => {
    if (audience.kind === 'participant') return { ...audience, id: rewrite(audience.id) };
    if (audience.kind === 'participants') return { ...audience, ids: rewrite(audience.ids) };
    return audience;
  };
  return mapOperation(operation, (item) => {
    switch (item.kind) {
      case 'set':
        return { ...item, value: rewrite(item.value) };
      case 'random.select':
        return { ...item, from: rewrite(item.from) };
      case 'present':
        return {
          ...item,
          message: rewrite(item.message),
          audience: rewriteAudience(item.audience),
        };
      case 'input.wait':
        return { ...item, participant: rewrite(item.participant) };
      case 'control.if':
        return { ...item, condition: rewrite(item.condition) };
      case 'control.foreach':
        return item.itemVariable === before
          ? item
          : { ...item, collection: rewrite(item.collection) };
      case 'collection.shuffle':
        return { ...item, collection: rewrite(item.collection) };
      case 'collection.draw':
        return item.collectionVariable === before ? { ...item, collectionVariable: after } : item;
      case 'composite.invoke':
        return {
          ...item,
          arguments: Object.fromEntries(
            Object.entries(item.arguments).map(([key, value]) => [key, rewrite(value)]),
          ),
        };
      default:
        return item;
    }
  });
}

function mapOperation(
  operation: Operation,
  update: (operation: Operation) => Operation,
): Operation {
  const mapped: Operation = (() => {
    switch (operation.kind) {
      case 'sequence':
        return { ...operation, steps: operation.steps.map((item) => mapOperation(item, update)) };
      case 'control.foreach':
        return { ...operation, body: mapOperation(operation.body, update) };
      case 'control.if': {
        const otherwise = operation.else ? mapOperation(operation.else, update) : undefined;
        return {
          ...operation,
          then: mapOperation(operation.then, update),
          ...(otherwise ? { else: otherwise } : {}),
        };
      }
      case 'control.parallel':
        return {
          ...operation,
          branches: operation.branches.map((item) => mapOperation(item, update)),
        };
      default:
        return operation;
    }
  })();
  return update(mapped);
}

function updateVariableType(
  definition: GameDefinition,
  name: string,
  type: TypeRef,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) =>
      item.name === name && item.initial === undefined ? { ...item, type } : item,
    ),
  };
}

function referenceExpressions(expression: Expression): readonly Expression[] {
  if (expression.kind === 'variable' || expression.kind === 'participants') return [expression];
  if (expression.kind === 'equals')
    return [...referenceExpressions(expression.left), ...referenceExpressions(expression.right)];
  return [];
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

function operationInputNames(operation: Operation): readonly { name: string; field: string }[] {
  const result: { name: string; field: string }[] = [];
  const collect = (expression: Expression, field: string) => {
    if (expression.kind === 'variable') result.push({ name: expression.name, field });
    if (expression.kind === 'equals') {
      collect(expression.left, `${field}.left`);
      collect(expression.right, `${field}.right`);
    }
  };
  switch (operation.kind) {
    case 'set':
      collect(operation.value, 'value');
      break;
    case 'random.select':
      collect(operation.from, 'from');
      break;
    case 'present':
      collect(operation.message, 'message');
      if (operation.audience.kind === 'participant') collect(operation.audience.id, 'audience.id');
      if (operation.audience.kind === 'participants')
        collect(operation.audience.ids, 'audience.ids');
      break;
    case 'input.wait':
      collect(operation.participant, 'participant');
      break;
    case 'control.if':
      collect(operation.condition, 'condition');
      break;
    case 'control.foreach':
      collect(operation.collection, 'collection');
      break;
    case 'collection.shuffle':
      collect(operation.collection, 'collection');
      break;
    case 'collection.draw':
      result.push({ name: operation.collectionVariable, field: 'collectionVariable' });
      break;
    case 'composite.invoke':
      for (const [name, expression] of Object.entries(operation.arguments))
        collect(expression, `arguments.${name}`);
      break;
  }
  return result;
}

function operationOutputNames(operation: Operation): readonly string[] {
  switch (operation.kind) {
    case 'set':
      return [operation.variable];
    case 'random.select':
    case 'input.wait':
    case 'collection.shuffle':
    case 'collection.draw':
      return [operation.output];
    case 'composite.invoke':
      return Object.values(operation.outputs);
    default:
      return [];
  }
}

function allOperations(definition: GameDefinition): readonly Operation[] {
  return [
    ...flatten(definition.root),
    ...definition.composites.flatMap((workflow) => flatten(workflow.implementation)),
  ];
}

function flatten(operation: Operation): readonly Operation[] {
  switch (operation.kind) {
    case 'sequence':
      return [operation, ...operation.steps.flatMap(flatten)];
    case 'control.foreach':
      return [operation, ...flatten(operation.body)];
    case 'control.if':
      return [
        operation,
        ...flatten(operation.then),
        ...(operation.else ? flatten(operation.else) : []),
      ];
    case 'control.parallel':
      return [operation, ...operation.branches.flatMap(flatten)];
    default:
      return [operation];
  }
}

function uniqueValues(values: readonly AuthoringValue[]): readonly AuthoringValue[] {
  return [...new Map(values.map((item) => [item.id, item])).values()];
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

function identifier(value: string): string {
  const words = value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, index) =>
      index === 0 ? word[0]!.toLowerCase() + word.slice(1) : word[0]!.toUpperCase() + word.slice(1),
    )
    .join('');
}

function uniqueName(existing: readonly string[], base: string): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

function displayName(value: string): string {
  return value
    .replace(/[.-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function operationLabelFromId(id: string): string {
  return displayName(id);
}

function showType(type: TypeRef): string {
  return type.kind === 'collection' ? `Collection<${showType(type.element)}>` : type.kind;
}
