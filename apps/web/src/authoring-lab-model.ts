import {
  describeType,
  referenceCompatibility,
  validateWorkingDefinition,
  type ReferenceCompatibility,
  type ValueReference,
} from '@traquenard/authoring-domain';
import {
  IR_VERSION,
  canonicalJson,
  literal,
  t,
  variable,
  type Card,
  type CompositeDefinition,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
  type VariableDeclaration,
} from '@traquenard/game-ir';

export type ResourceKind = 'deck' | 'variable';
export type InsertableKind =
  | 'choose-player'
  | 'draw-card'
  | 'present'
  | 'ask'
  | 'wait'
  | 'foreach'
  | 'if'
  | 'parallel'
  | 'composite'
  | 'end';
export type ValueFamily = 'runtime' | 'resource' | 'flow' | 'composite';

export interface AuthoringValue extends ValueReference {
  readonly label: string;
  readonly family: ValueFamily;
  readonly sourceLabel: string;
}

export interface AuthoringCandidate extends ReferenceCompatibility {
  readonly value: AuthoringValue;
}

export interface AuthoringDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly operationId?: string;
}

const questions: readonly Card[] = [
  { id: 'question-1', suit: 'question', rank: 'A' },
  { id: 'question-2', suit: 'question', rank: 'B' },
  { id: 'question-3', suit: 'question', rank: 'C' },
];

const challenges: readonly Card[] = [
  { id: 'challenge-1', suit: 'challenge', rank: '1' },
  { id: 'challenge-2', suit: 'challenge', rank: '2' },
];

const prepareTurn: CompositeDefinition = {
  id: 'prepare.turn',
  version: 1,
  name: 'Prepare Turn',
  inputs: [
    { name: 'player', type: t.participant },
    { name: 'deck', type: t.collection(t.card) },
  ],
  outputs: [{ name: 'card', type: t.card }],
  implementation: {
    id: 'prepare-sequence',
    kind: 'sequence',
    steps: [
      {
        id: 'prepare-present',
        kind: 'present',
        audience: { kind: 'participant', id: variable('player') },
        message: literal('Your turn is ready.', t.string),
        privacy: 'private',
      },
      {
        id: 'prepare-draw',
        kind: 'collection.draw',
        collectionVariable: 'deck',
        output: 'card',
      },
    ],
  },
};

export const authoringCanonicalDefinition: GameDefinition = deepFreeze({
  irVersion: IR_VERSION,
  gameId: 'authoring-grammar-experiment',
  title: 'Friday Night Challenge',
  variables: [
    { name: 'questionsDeck', type: t.collection(t.card), initial: questions },
    { name: 'challengesDeck', type: t.collection(t.card), initial: challenges },
    { name: 'score', type: t.number, initial: 0 },
    { name: 'currentPlayer', type: t.participant },
    { name: 'currentCard', type: t.card },
    { name: 'answer', type: t.string },
    { name: 'preparedCard', type: t.card },
  ],
  composites: [prepareTurn],
  root: {
    id: 'authoring-root',
    kind: 'sequence',
    steps: [
      {
        id: 'choose-player',
        kind: 'random.select',
        from: { kind: 'participants' },
        output: 'currentPlayer',
      },
      {
        id: 'draw-question',
        kind: 'collection.draw',
        collectionVariable: 'questionsDeck',
        output: 'currentCard',
      },
      {
        id: 'ask-question',
        kind: 'input.wait',
        participant: variable('currentPlayer'),
        prompt: 'Ready for the challenge?',
        options: ['Yes', 'No'],
        output: 'answer',
      },
      {
        id: 'answer-check',
        kind: 'control.if',
        condition: {
          kind: 'equals',
          left: variable('answer'),
          right: literal('Yes', t.string),
        },
        then: {
          id: 'answer-yes',
          kind: 'sequence',
          steps: [
            {
              id: 'present-correct',
              kind: 'present',
              audience: { kind: 'everyone' },
              message: literal('Let’s play!', t.string),
              privacy: 'public',
            },
          ],
        },
        else: {
          id: 'answer-no',
          kind: 'sequence',
          steps: [{ id: 'wait-again', kind: 'time.wait', durationMs: 1000 }],
        },
      },
      {
        id: 'each-player',
        kind: 'control.foreach',
        collection: { kind: 'participants' },
        itemVariable: 'player',
        body: {
          id: 'each-player-body',
          kind: 'sequence',
          steps: [
            {
              id: 'greet-player',
              kind: 'present',
              audience: { kind: 'participant', id: variable('player') },
              message: literal('You are in this round.', t.string),
              privacy: 'private',
            },
          ],
        },
      },
      {
        id: 'ready-together',
        kind: 'control.parallel',
        join: 'all',
        branches: [
          {
            id: 'parallel-message',
            kind: 'present',
            audience: { kind: 'everyone' },
            message: literal('Everyone gets ready.', t.string),
            privacy: 'public',
          },
          { id: 'parallel-wait', kind: 'time.wait', durationMs: 500 },
        ],
      },
      {
        id: 'prepare-turn',
        kind: 'composite.invoke',
        compositeId: 'prepare.turn',
        arguments: {
          player: variable('currentPlayer'),
          deck: variable('questionsDeck'),
        },
        outputs: { card: 'preparedCard' },
      },
      { id: 'finish-game', kind: 'end' },
    ],
  },
});

export const insertionCatalog: readonly {
  readonly kind: InsertableKind;
  readonly label: string;
  readonly category: string;
  readonly summary: string;
}[] = [
  {
    kind: 'choose-player',
    label: 'Choose Player',
    category: 'Players',
    summary: 'Choose from joined participants.',
  },
  {
    kind: 'present',
    label: 'Present',
    category: 'Presentation',
    summary: 'Show a public message.',
  },
  {
    kind: 'ask',
    label: 'Ask / Wait for Input',
    category: 'Input',
    summary: 'Wait for a player choice.',
  },
  {
    kind: 'draw-card',
    label: 'Draw Card',
    category: 'Data / Cards',
    summary: 'Remove and return the first card.',
  },
  { kind: 'wait', label: 'Wait', category: 'Control', summary: 'Wait on logical time.' },
  {
    kind: 'foreach',
    label: 'For Each',
    category: 'Control',
    summary: 'Repeat a nested body for every item.',
  },
  {
    kind: 'if',
    label: 'If',
    category: 'Control',
    summary: 'Choose between THEN and ELSE bodies.',
  },
  {
    kind: 'parallel',
    label: 'Parallel',
    category: 'Control',
    summary: 'Run safe v1 branches and wait for all.',
  },
  {
    kind: 'composite',
    label: 'Prepare Turn',
    category: 'Composite',
    summary: 'Invoke the reusable Prepare Turn flow.',
  },
  { kind: 'end', label: 'End', category: 'Control', summary: 'Complete the game.' },
];

export function createAuthoringWorkingDefinition(): GameDefinition {
  return structuredClone(authoringCanonicalDefinition);
}

export function canonicalAuthoringJson(): string {
  return canonicalJson(authoringCanonicalDefinition);
}

export function createResource(
  definition: GameDefinition,
  kind: ResourceKind,
  name: string,
): GameDefinition {
  const variableName = identifier(name);
  if (!variableName || definition.variables.some((item) => item.name === variableName))
    return definition;
  const declaration: VariableDeclaration =
    kind === 'deck'
      ? { name: variableName, type: t.collection(t.card), initial: [] }
      : { name: variableName, type: t.number, initial: 0 };
  return { ...definition, variables: [...definition.variables, declaration] };
}

export function addCardToDeck(
  definition: GameDefinition,
  variableName: string,
  label: string,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) => {
      if (item.name !== variableName || item.type.kind !== 'collection') return item;
      const cards = Array.isArray(item.initial) ? (item.initial as readonly Card[]) : [];
      const card: Card = {
        id: `${variableName}-${cards.length + 1}`,
        suit: 'custom',
        rank: label || `Card ${cards.length + 1}`,
      };
      return { ...item, initial: [...cards, card] };
    }),
  };
}

export function setVariableInitial(
  definition: GameDefinition,
  variableName: string,
  value: number | string | boolean,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) =>
      item.name === variableName && item.type.kind === typeof value
        ? { ...item, initial: value }
        : item,
    ),
  };
}

export function deleteResource(definition: GameDefinition, variableName: string): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.filter(
      (item) => item.name !== variableName || item.initial === undefined,
    ),
  };
}

export function insertOperation(
  definition: GameDefinition,
  sequenceId: string,
  index: number,
  kind: InsertableKind,
  id: string,
): GameDefinition {
  const operation = makeOperation(definition, kind, id);
  const root = updateOperation(definition.root, sequenceId, (target) => {
    if (target.kind !== 'sequence') return target;
    const safeIndex = Math.max(0, Math.min(index, target.steps.length));
    return {
      ...target,
      steps: [...target.steps.slice(0, safeIndex), operation, ...target.steps.slice(safeIndex)],
    };
  });
  const composites = definition.composites.map((composite) => ({
    ...composite,
    implementation: updateOperation(composite.implementation, sequenceId, (target) => {
      if (target.kind !== 'sequence') return target;
      const safeIndex = Math.max(0, Math.min(index, target.steps.length));
      return {
        ...target,
        steps: [...target.steps.slice(0, safeIndex), operation, ...target.steps.slice(safeIndex)],
      };
    }),
  }));
  return {
    ...definition,
    variables: addOutputDeclarations(definition, operation),
    composites,
    root,
  };
}

export function deleteOperation(definition: GameDefinition, operationId: string): GameDefinition {
  return {
    ...definition,
    root: removeOperation(definition.root, operationId),
    composites: definition.composites.map((composite) => ({
      ...composite,
      implementation: removeOperation(composite.implementation, operationId),
    })),
  };
}

export function moveOperation(
  definition: GameDefinition,
  operationId: string,
  direction: -1 | 1,
): GameDefinition {
  return {
    ...definition,
    root: moveInTree(definition.root, operationId, direction),
    composites: definition.composites.map((composite) => ({
      ...composite,
      implementation: moveInTree(composite.implementation, operationId, direction),
    })),
  };
}

export function changeDrawSource(
  definition: GameDefinition,
  operationId: string,
  variableName: string,
): GameDefinition {
  return {
    ...definition,
    root: updateOperation(definition.root, operationId, (operation) =>
      operation.kind === 'collection.draw'
        ? { ...operation, collectionVariable: variableName }
        : operation,
    ),
    composites: definition.composites.map((composite) => ({
      ...composite,
      implementation: updateOperation(composite.implementation, operationId, (operation) =>
        operation.kind === 'collection.draw'
          ? { ...operation, collectionVariable: variableName }
          : operation,
      ),
    })),
  };
}

export function findOperation(definition: GameDefinition, id: string): Operation | undefined {
  for (const operation of allOperations(definition)) if (operation.id === id) return operation;
  return undefined;
}

export function operationLabel(operation: Operation): string {
  switch (operation.kind) {
    case 'random.select':
      return 'Choose Player';
    case 'collection.draw':
      return 'Draw Card';
    case 'present':
      return 'Present';
    case 'input.wait':
      return 'Ask / Wait for Input';
    case 'time.wait':
      return 'Wait';
    case 'control.foreach':
      return 'For Each Player';
    case 'control.if':
      return 'If';
    case 'control.parallel':
      return 'Parallel';
    case 'composite.invoke':
      return 'Prepare Turn';
    case 'end':
      return 'End';
    case 'sequence':
      return 'Sequence';
    case 'set':
      return 'Set Value';
    case 'collection.shuffle':
      return 'Shuffle';
  }
}

export function resourceLabel(name: string): string {
  const known: Readonly<Record<string, string>> = {
    questionsDeck: 'Questions Deck',
    challengesDeck: 'Challenges Deck',
    score: 'Score',
  };
  return known[name] ?? humanize(name);
}

export function resourceUsages(
  definition: GameDefinition,
  variableName: string,
): readonly string[] {
  return allOperations(definition)
    .filter((operation) => operationUsesVariable(operation, variableName))
    .map(operationLabel);
}

export function deckDeclarations(definition: GameDefinition): readonly VariableDeclaration[] {
  return definition.variables.filter(
    (item) =>
      item.initial !== undefined &&
      item.type.kind === 'collection' &&
      item.type.element.kind === 'card',
  );
}

export function stateDeclarations(definition: GameDefinition): readonly VariableDeclaration[] {
  return definition.variables.filter(
    (item) => item.initial !== undefined && item.type.kind !== 'collection',
  );
}

export function availableValuesAt(
  definition: GameDefinition,
  sequenceId: string,
  index: number,
): readonly AuthoringValue[] {
  const rootContext: AuthoringValue[] = [runtimePlayers(), ...resourceValues(definition)];
  const found = contextForSequence(definition.root, sequenceId, index, rootContext, definition);
  if (found) return found;
  for (const composite of definition.composites) {
    const locals = composite.inputs.map((port) =>
      compositeValue(composite, port.name, port.type, 'input'),
    );
    const compositeContext = contextForSequence(
      composite.implementation,
      sequenceId,
      index,
      locals,
      definition,
    );
    if (compositeContext) return compositeContext;
  }
  return rootContext;
}

export function drawSourceCandidates(
  definition: GameDefinition,
  sequenceId: string,
  index: number,
): readonly AuthoringCandidate[] {
  return referenceCompatibility(
    availableValuesAt(definition, sequenceId, index),
    t.collection(t.card),
  ).map((candidate) => ({
    ...candidate,
    value: candidate.reference as AuthoringValue,
  }));
}

export function authoringDiagnostics(definition: GameDefinition): readonly AuthoringDiagnostic[] {
  const validation = validateWorkingDefinition(definition);
  const diagnostics: AuthoringDiagnostic[] = validation.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
  }));
  const available = new Set(
    definition.variables.filter((item) => item.initial !== undefined).map((item) => item.name),
  );
  scanAvailability(definition.root, available, diagnostics);
  return diagnostics;
}

export function typeLabel(type: TypeRef): string {
  const raw = describeType(type);
  return raw
    .replace('Collection<participant>', 'Collection of Participants')
    .replace('Collection<card>', 'Deck of Cards')
    .replace('number', 'Number')
    .replace('string', 'Text')
    .replace('boolean', 'True / False');
}

function makeOperation(definition: GameDefinition, kind: InsertableKind, id: string): Operation {
  const firstDeck = deckDeclarations(definition)[0]?.name ?? 'questionsDeck';
  switch (kind) {
    case 'choose-player':
      return {
        id,
        kind: 'random.select',
        from: { kind: 'participants' },
        output: `${id}Player`,
      };
    case 'draw-card':
      return { id, kind: 'collection.draw', collectionVariable: firstDeck, output: `${id}Card` };
    case 'present':
      return {
        id,
        kind: 'present',
        audience: { kind: 'everyone' },
        message: literal('New message', t.string),
        privacy: 'public',
      };
    case 'ask':
      return {
        id,
        kind: 'input.wait',
        participant: variable('currentPlayer'),
        prompt: 'Choose one',
        options: ['Yes', 'No'],
        output: `${id}Answer`,
      };
    case 'wait':
      return { id, kind: 'time.wait', durationMs: 1000 };
    case 'foreach':
      return {
        id,
        kind: 'control.foreach',
        collection: { kind: 'participants' },
        itemVariable: `${id}Player`,
        body: { id: `${id}-body`, kind: 'sequence', steps: [] },
      };
    case 'if':
      return {
        id,
        kind: 'control.if',
        condition: literal(true, t.boolean),
        then: { id: `${id}-then`, kind: 'sequence', steps: [] },
        else: { id: `${id}-else`, kind: 'sequence', steps: [] },
      };
    case 'parallel':
      return {
        id,
        kind: 'control.parallel',
        join: 'all',
        branches: [{ id: `${id}-wait`, kind: 'time.wait', durationMs: 500 }],
      };
    case 'composite':
      return {
        id,
        kind: 'composite.invoke',
        compositeId: 'prepare.turn',
        arguments: { player: variable('currentPlayer'), deck: variable(firstDeck) },
        outputs: { card: `${id}Card` },
      };
    case 'end':
      return { id, kind: 'end' };
  }
}

function addOutputDeclarations(
  definition: GameDefinition,
  operation: Operation,
): readonly VariableDeclaration[] {
  const declarations = [...definition.variables];
  const add = (name: string, type: TypeRef) => {
    if (!declarations.some((item) => item.name === name)) declarations.push({ name, type });
  };
  switch (operation.kind) {
    case 'random.select':
      add(operation.output, t.participant);
      break;
    case 'collection.draw':
      add(operation.output, t.card);
      break;
    case 'input.wait':
      add(operation.output, t.string);
      break;
    case 'composite.invoke':
      add(operation.outputs.card ?? `${operation.id}Card`, t.card);
      break;
  }
  return declarations;
}

function updateOperation(
  operation: Operation,
  id: string,
  update: (found: Operation) => Operation,
): Operation {
  if (operation.id === id) return update(operation);
  switch (operation.kind) {
    case 'sequence':
      return {
        ...operation,
        steps: operation.steps.map((child) => updateOperation(child, id, update)),
      };
    case 'control.foreach':
      return { ...operation, body: updateOperation(operation.body, id, update) };
    case 'control.if': {
      const nextElse = operation.else && updateOperation(operation.else, id, update);
      return {
        ...operation,
        then: updateOperation(operation.then, id, update),
        ...(nextElse ? { else: nextElse } : {}),
      };
    }
    case 'control.parallel':
      return {
        ...operation,
        branches: operation.branches.map((child) => updateOperation(child, id, update)),
      };
    default:
      return operation;
  }
}

function removeOperation(operation: Operation, id: string): Operation {
  switch (operation.kind) {
    case 'sequence':
      return {
        ...operation,
        steps: operation.steps
          .filter((child) => child.id !== id)
          .map((child) => removeOperation(child, id)),
      };
    case 'control.foreach':
      return { ...operation, body: removeOperation(operation.body, id) };
    case 'control.if': {
      const nextElse = operation.else && removeOperation(operation.else, id);
      return {
        ...operation,
        then: removeOperation(operation.then, id),
        ...(nextElse ? { else: nextElse } : {}),
      };
    }
    case 'control.parallel':
      return { ...operation, branches: operation.branches.filter((child) => child.id !== id) };
    default:
      return operation;
  }
}

function moveInTree(operation: Operation, id: string, direction: -1 | 1): Operation {
  switch (operation.kind) {
    case 'sequence': {
      const current = operation.steps.findIndex((item) => item.id === id);
      if (current >= 0) {
        const target = current + direction;
        if (target < 0 || target >= operation.steps.length) return operation;
        const steps = [...operation.steps];
        [steps[current], steps[target]] = [steps[target]!, steps[current]!];
        return { ...operation, steps };
      }
      return {
        ...operation,
        steps: operation.steps.map((child) => moveInTree(child, id, direction)),
      };
    }
    case 'control.foreach':
      return { ...operation, body: moveInTree(operation.body, id, direction) };
    case 'control.if': {
      const nextElse = operation.else && moveInTree(operation.else, id, direction);
      return {
        ...operation,
        then: moveInTree(operation.then, id, direction),
        ...(nextElse ? { else: nextElse } : {}),
      };
    }
    default:
      return operation;
  }
}

function contextForSequence(
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
      const nested = contextForSequence(child, sequenceId, index, available, definition);
      if (nested) return nested;
      available.push(...outputValues(child, definition));
    }
    return undefined;
  }
  if (operation.kind === 'control.foreach') {
    const itemType =
      expressionType(operation.collection, incoming)?.kind === 'collection'
        ? (
            expressionType(operation.collection, incoming) as Extract<
              TypeRef,
              { kind: 'collection' }
            >
          ).element
        : t.participant;
    return contextForSequence(
      operation.body,
      sequenceId,
      index,
      [...incoming, flowValue(operation.itemVariable, itemType, operation.id)],
      definition,
    );
  }
  if (operation.kind === 'control.if') {
    return (
      contextForSequence(operation.then, sequenceId, index, incoming, definition) ??
      (operation.else
        ? contextForSequence(operation.else, sequenceId, index, incoming, definition)
        : undefined)
    );
  }
  return undefined;
}

function outputValues(operation: Operation, definition: GameDefinition): readonly AuthoringValue[] {
  const declaration = (name: string) =>
    definition.variables.find((item) => item.name === name)?.type ??
    definition.composites
      .flatMap((composite) => [...composite.inputs, ...composite.outputs])
      .find((port) => port.name === name)?.type;
  switch (operation.kind) {
    case 'random.select':
    case 'input.wait':
    case 'collection.shuffle': {
      const type = declaration(operation.output);
      return type ? [flowValue(operation.output, type, operation.id)] : [];
    }
    case 'collection.draw': {
      const type = declaration(operation.output);
      return type ? [flowValue(operation.output, type, operation.id)] : [];
    }
    case 'composite.invoke':
      return Object.entries(operation.outputs).flatMap(([port, output]) => {
        const type = definition.composites
          .find((item) => item.id === operation.compositeId)
          ?.outputs.find((item) => item.name === port)?.type;
        return type ? [flowValue(output, type, operation.id)] : [];
      });
    default:
      return [];
  }
}

function resourceValues(definition: GameDefinition): readonly AuthoringValue[] {
  return definition.variables
    .filter((item) => item.initial !== undefined)
    .map((item) => ({
      id: item.name,
      label: resourceLabel(item.name),
      type: item.type,
      family: 'resource' as const,
      sourceLabel: 'Game resource',
      source: { kind: 'variable' as const, variableName: item.name },
    }));
}

function runtimePlayers(): AuthoringValue {
  return {
    id: 'runtime.players',
    label: 'Players',
    type: t.collection(t.participant),
    family: 'runtime',
    sourceLabel: 'Provided by session',
    source: { kind: 'runtime' },
  };
}

function flowValue(id: string, type: TypeRef, blockId: string): AuthoringValue {
  return {
    id,
    label: humanize(id),
    type,
    family: 'flow',
    sourceLabel: `Produced by ${blockId}`,
    source: { kind: 'block', blockId },
  };
}

function compositeValue(
  composite: CompositeDefinition,
  name: string,
  type: TypeRef,
  direction: 'input' | 'output',
): AuthoringValue {
  return {
    id: name,
    label: humanize(name),
    type,
    family: 'composite',
    sourceLabel: `${direction === 'input' ? 'Input to' : 'Output from'} ${composite.name}`,
    source: { kind: 'composite-port', compositeId: composite.id, direction },
  };
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
  for (const name of operationInputNames(operation)) {
    if (!incoming.has(name)) {
      diagnostics.push({
        code: 'value_unavailable',
        operationId: operation.id,
        message: `${humanize(name)} is used by ${operationLabel(operation)} before its producing step.`,
      });
    }
  }
  if (operation.kind === 'control.foreach') {
    const nested = new Set(incoming);
    nested.add(operation.itemVariable);
    scanAvailability(operation.body, nested, diagnostics);
  } else if (operation.kind === 'control.if') {
    scanAvailability(operation.then, new Set(incoming), diagnostics);
    if (operation.else) scanAvailability(operation.else, new Set(incoming), diagnostics);
  }
}

function operationInputNames(operation: Operation): readonly string[] {
  const expressions: Expression[] = [];
  switch (operation.kind) {
    case 'set':
      expressions.push(operation.value);
      break;
    case 'random.select':
      expressions.push(operation.from);
      break;
    case 'present':
      expressions.push(operation.message);
      if (operation.audience.kind === 'participant') expressions.push(operation.audience.id);
      if (operation.audience.kind === 'participants') expressions.push(operation.audience.ids);
      break;
    case 'input.wait':
      expressions.push(operation.participant);
      break;
    case 'control.if':
      expressions.push(operation.condition);
      break;
    case 'control.foreach':
      expressions.push(operation.collection);
      break;
    case 'collection.shuffle':
      expressions.push(operation.collection);
      break;
    case 'collection.draw':
      return [operation.collectionVariable];
    case 'composite.invoke':
      expressions.push(...Object.values(operation.arguments));
      break;
  }
  return expressions.flatMap(expressionVariables);
}

function operationOutputNames(operation: Operation): readonly string[] {
  switch (operation.kind) {
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

function expressionVariables(expression: Expression): readonly string[] {
  if (expression.kind === 'variable') return [expression.name];
  if (expression.kind === 'equals')
    return [...expressionVariables(expression.left), ...expressionVariables(expression.right)];
  return [];
}

function expressionType(
  expression: Expression,
  available: readonly AuthoringValue[],
): TypeRef | undefined {
  if (expression.kind === 'participants') return t.collection(t.participant);
  if (expression.kind === 'literal') return expression.valueType;
  if (expression.kind === 'variable')
    return available.find((item) => item.id === expression.name)?.type;
  if (expression.kind === 'equals') return t.boolean;
  return undefined;
}

function operationUsesVariable(operation: Operation, variableName: string): boolean {
  return operationInputNames(operation).includes(variableName);
}

function allOperations(definition: GameDefinition): readonly Operation[] {
  return [
    ...flattenOperation(definition.root),
    ...definition.composites.flatMap((composite) => flattenOperation(composite.implementation)),
  ];
}

function flattenOperation(operation: Operation): readonly Operation[] {
  switch (operation.kind) {
    case 'sequence':
      return [operation, ...operation.steps.flatMap(flattenOperation)];
    case 'control.foreach':
      return [operation, ...flattenOperation(operation.body)];
    case 'control.if':
      return [
        operation,
        ...flattenOperation(operation.then),
        ...(operation.else ? flattenOperation(operation.else) : []),
      ];
    case 'control.parallel':
      return [operation, ...operation.branches.flatMap(flattenOperation)];
    default:
      return [operation];
  }
}

function uniqueValues(values: readonly AuthoringValue[]): readonly AuthoringValue[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function identifier(name: string): string {
  const words = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, index) =>
      index === 0
        ? `${word.charAt(0).toLowerCase()}${word.slice(1)}`
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join('');
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
