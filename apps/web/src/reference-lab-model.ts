import {
  describeType,
  referenceCompatibility,
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
} from '@traquenard/game-ir';

export type ReferenceFixtureKey =
  'two-decks' | 'current-player' | 'drawn-card' | 'composite' | 'incompatible' | 'long-flow';
export type ReferenceVariant = 'chips' | 'navigation';
export type ReferenceViewport = 'desktop' | 'mobile';
export type CompositeProjection = 'collapsed' | 'focused' | 'outline';
export type ReferenceScope =
  'runtime' | 'game' | 'flow-output' | 'composite-input' | 'composite-output';

export interface ReferenceFixture {
  readonly key: ReferenceFixtureKey;
  readonly shortLabel: string;
  readonly description: string;
  readonly stress: string;
  readonly definition: GameDefinition;
  readonly defaultInput?: { readonly nodeId: string; readonly portName: string };
}

export interface LabValue extends ValueReference {
  readonly label: string;
  readonly scope: ReferenceScope;
  readonly sourceLabel: string;
  readonly sourceNodeId: string;
  readonly availableAfter: number;
}

export interface LabInput {
  readonly name: string;
  readonly label: string;
  readonly type: TypeRef;
  readonly selectedValueId: string;
  readonly boundary?: 'from-parent';
}

export interface LabNode {
  readonly id: string;
  readonly operation: Operation;
  readonly label: string;
  readonly detail: string;
  readonly inputs: readonly LabInput[];
  readonly outputIds: readonly string[];
  readonly index: number;
  readonly compositeId?: string;
}

export interface LabCandidate extends ReferenceCompatibility {
  readonly value: LabValue;
}

export interface ReferenceNavigationState {
  readonly context: 'parent' | 'composite' | 'source';
  readonly compositeId?: string;
  readonly sourceValueId?: string;
  readonly sourceCompositeId?: string;
  readonly focusedNodeId?: string;
  readonly history: readonly Omit<ReferenceNavigationState, 'history'>[];
}

export interface ReferenceWorkingCopy {
  readonly deletedNodeIds: readonly string[];
  readonly addedNodes: readonly AddedWorkingCopyNode[];
}

export type ReferenceLabStepKind = 'present' | 'wait';

export interface AddedWorkingCopyNode {
  readonly compositeId?: string;
  readonly node: LabNode;
}

export interface WorkingCopyDiagnostic {
  readonly code: 'dangling_reference' | 'working_copy_changed';
  readonly nodeId: string;
  readonly message: string;
}

const questions: readonly Card[] = [
  { id: 'q-forest', suit: 'question', rank: 'Forest' },
  { id: 'q-castle', suit: 'question', rank: 'Castle' },
];
const challenges: readonly Card[] = [
  { id: 'c-mime', suit: 'challenge', rank: 'Mime' },
  { id: 'c-story', suit: 'challenge', rank: 'Story' },
];

const carryCard: CompositeDefinition = {
  id: 'card.carry-forward',
  version: 1,
  name: 'Carry Drawn Card',
  inputs: [{ name: 'sourceCard', type: t.card }],
  outputs: [{ name: 'card', type: t.card }],
  implementation: {
    id: 'carry-card',
    kind: 'set',
    variable: 'card',
    value: variable('sourceCard'),
  },
};

const prepareTurn: CompositeDefinition = {
  id: 'turn.prepare',
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
        id: 'prepare-shuffle',
        kind: 'collection.shuffle',
        collection: variable('deck'),
        output: 'deck',
      },
      {
        id: 'prepare-draw',
        kind: 'collection.draw',
        collectionVariable: 'deck',
        output: 'card',
      },
      {
        id: 'prepare-private',
        kind: 'present',
        audience: { kind: 'participant', id: variable('player') },
        message: literal('Your card is ready.', t.string),
        privacy: 'private',
      },
    ],
  },
};

const end = (id: string): Operation => ({ id, kind: 'end' });
const wait = (id: string, durationMs = 1000): Operation => ({
  id,
  kind: 'time.wait',
  durationMs,
});
const announce = (id: string, message: string): Operation => ({
  id,
  kind: 'present',
  audience: { kind: 'everyone' },
  message: literal(message, t.string),
  privacy: 'public',
});
const choose = (id: string, output: string): Operation => ({
  id,
  kind: 'random.select',
  from: { kind: 'participants' },
  output,
});
const draw = (id: string, collectionVariable: string, output: string): Operation => ({
  id,
  kind: 'collection.draw',
  collectionVariable,
  output,
});
const sequence = (id: string, steps: readonly Operation[]): Operation => ({
  id,
  kind: 'sequence',
  steps,
});

function fixture(
  key: ReferenceFixtureKey,
  shortLabel: string,
  title: string,
  description: string,
  stress: string,
  variables: GameDefinition['variables'],
  composites: readonly CompositeDefinition[],
  steps: readonly Operation[],
  defaultInput?: ReferenceFixture['defaultInput'],
): ReferenceFixture {
  return {
    key,
    shortLabel,
    description,
    stress,
    definition: {
      irVersion: IR_VERSION,
      gameId: `references-lab-${key}`,
      title,
      variables,
      composites,
      root: sequence(`${key}-root`, steps),
    },
    ...(defaultInput ? { defaultInput } : {}),
  };
}

const deckVariables = [
  { name: 'questionsDeck', type: t.collection(t.card), initial: questions },
  { name: 'challengesDeck', type: t.collection(t.card), initial: challenges },
] as const;

export const referenceFixtures: readonly ReferenceFixture[] = [
  fixture(
    'two-decks',
    'A · Two decks',
    'Two decks, one draw',
    'Two compatible Collection<Card> sources make identity as important as type.',
    'Can the author immediately see which deck is consumed?',
    [...deckVariables, { name: 'drawnCard', type: t.card }],
    [],
    [draw('draw-question', 'questionsDeck', 'drawnCard'), wait('deck-gap'), end('deck-end')],
    { nodeId: 'draw-question', portName: 'from' },
  ),
  fixture(
    'current-player',
    'B · Distant player',
    'Current Player reused at distance',
    'A Participant is produced early, then reused by an input and a private audience.',
    'Can source, type, scope, and every consumer be found without a permanent long edge?',
    [
      { name: 'currentPlayer', type: t.participant },
      { name: 'roundWinner', type: t.participant },
      { name: 'answer', type: t.string },
    ],
    [],
    [
      choose('choose-player', 'currentPlayer'),
      announce('explain-round', 'Explain the round.'),
      wait('player-gap-a'),
      announce('show-board', 'Show the shared board.'),
      wait('player-gap-b'),
      choose('choose-winner', 'roundWinner'),
      {
        id: 'ask-current-player',
        kind: 'input.wait',
        participant: variable('currentPlayer'),
        prompt: 'Choose a question',
        options: ['Forest', 'Castle'],
        output: 'answer',
      },
      {
        id: 'private-current-player',
        kind: 'present',
        audience: { kind: 'participant', id: variable('currentPlayer') },
        message: literal('Only the current player sees this.', t.string),
        privacy: 'private',
      },
      end('player-end'),
    ],
  ),
  fixture(
    'drawn-card',
    'C · Passed card',
    'Drawn card passed through flow',
    'A Card output crosses several blocks into a typed Composite input.',
    'Can a non-displayable Card remain traceable without inventing a fake consumer?',
    [
      { name: 'questionsDeck', type: t.collection(t.card), initial: questions },
      { name: 'drawnCard', type: t.card },
      { name: 'carriedCard', type: t.card },
    ],
    [carryCard],
    [
      draw('draw-card', 'questionsDeck', 'drawnCard'),
      announce('card-gap-a', 'Set up the next phase.'),
      wait('card-gap-b'),
      {
        id: 'carry-drawn-card',
        kind: 'composite.invoke',
        compositeId: carryCard.id,
        arguments: { sourceCard: variable('drawnCard') },
        outputs: { card: 'carriedCard' },
      },
      end('card-end'),
    ],
  ),
  fixture(
    'composite',
    'D · Composite',
    'Prepare Turn with typed ports',
    'A collapsed Composite receives a Participant and Collection<Card>, then returns a Card.',
    'Can authors cross the scope boundary and return to the exact parent context?',
    [
      ...deckVariables,
      { name: 'currentPlayer', type: t.participant },
      { name: 'preparedCard', type: t.card },
    ],
    [prepareTurn],
    [
      choose('choose-player', 'currentPlayer'),
      {
        id: 'prepare-turn',
        kind: 'composite.invoke',
        compositeId: prepareTurn.id,
        arguments: {
          player: variable('currentPlayer'),
          deck: variable('questionsDeck'),
        },
        outputs: { card: 'preparedCard' },
      },
      announce('continue-round', 'Continue the round.'),
      end('composite-end'),
    ],
  ),
  fixture(
    'incompatible',
    'E · Invalid choice',
    'Incompatible reference explained',
    'The picker includes compatible decks and disables a Participant with an explicit reason.',
    'Can an author understand why Current Player cannot fill a Collection<Card> input?',
    [
      ...deckVariables,
      { name: 'currentPlayer', type: t.participant },
      { name: 'drawnCard', type: t.card },
    ],
    [],
    [
      choose('choose-player', 'currentPlayer'),
      draw('draw-question', 'questionsDeck', 'drawnCard'),
      end('incompatible-end'),
    ],
    { nodeId: 'draw-question', portName: 'from' },
  ),
  fixture(
    'long-flow',
    'F · Long flow',
    'Long-flow reference stress',
    'Two decks, two Participants, two Composites, distant reuse, and multiple consumers.',
    'Do persistent edges clarify the graph, or obscure the control sequence they explain?',
    [
      ...deckVariables,
      { name: 'currentPlayer', type: t.participant },
      { name: 'roundWinner', type: t.participant },
      { name: 'drawnCard', type: t.card },
      { name: 'carriedCard', type: t.card },
      { name: 'preparedCard', type: t.card },
      { name: 'answer', type: t.string },
    ],
    [carryCard, prepareTurn],
    [
      choose('choose-player', 'currentPlayer'),
      announce('long-intro', 'Introduce the round.'),
      wait('long-wait-a'),
      draw('draw-question', 'questionsDeck', 'drawnCard'),
      announce('long-board', 'Update the shared board.'),
      wait('long-wait-b'),
      choose('choose-winner', 'roundWinner'),
      announce('long-score', 'Show the current score.'),
      {
        id: 'carry-drawn-card',
        kind: 'composite.invoke',
        compositeId: carryCard.id,
        arguments: { sourceCard: variable('drawnCard') },
        outputs: { card: 'carriedCard' },
      },
      {
        id: 'prepare-turn',
        kind: 'composite.invoke',
        compositeId: prepareTurn.id,
        arguments: { player: variable('currentPlayer'), deck: variable('challengesDeck') },
        outputs: { card: 'preparedCard' },
      },
      wait('long-wait-c'),
      {
        id: 'ask-current-player',
        kind: 'input.wait',
        participant: variable('currentPlayer'),
        prompt: 'Choose the final action',
        options: ['Keep', 'Pass'],
        output: 'answer',
      },
      {
        id: 'private-current-player',
        kind: 'present',
        audience: { kind: 'participant', id: variable('currentPlayer') },
        message: literal('This is your private result.', t.string),
        privacy: 'private',
      },
      announce('long-continue', 'Continue to results.'),
      end('long-end'),
    ],
  ),
] as const;

export function referenceFixtureByKey(key: ReferenceFixtureKey): ReferenceFixture {
  return referenceFixtures.find((fixture) => fixture.key === key)!;
}

export function canonicalFixtureJson(fixture: ReferenceFixture): string {
  return canonicalJson(fixture.definition);
}

export function compositeForFixture(fixture: ReferenceFixture): CompositeDefinition | undefined {
  return (
    fixture.definition.composites.find((composite) => composite.id === prepareTurn.id) ??
    fixture.definition.composites[0]
  );
}

export function projectFixture(
  fixture: ReferenceFixture,
  compositeId?: string,
): readonly LabNode[] {
  const operation = compositeId
    ? fixture.definition.composites.find((item) => item.id === compositeId)?.implementation
    : fixture.definition.root;
  if (!operation) return [];
  const operations = operation.kind === 'sequence' ? operation.steps : [operation];
  return operations.map((item, index) => projectOperation(fixture, item, index, compositeId));
}

function projectOperation(
  fixture: ReferenceFixture,
  operation: Operation,
  index: number,
  compositeId?: string,
): LabNode {
  const composite =
    operation.kind === 'composite.invoke'
      ? fixture.definition.composites.find((item) => item.id === operation.compositeId)
      : undefined;
  return {
    id: operation.id,
    operation,
    label: operationLabel(operation, composite),
    detail: operationDetail(operation, composite),
    inputs: operationInputs(fixture, operation, compositeId),
    outputIds: operationOutputs(operation),
    index,
    ...(composite ? { compositeId: composite.id } : {}),
  };
}

function operationInputs(
  fixture: ReferenceFixture,
  operation: Operation,
  ownerCompositeId?: string,
): readonly LabInput[] {
  const referenceInput = (
    name: string,
    label: string,
    type: TypeRef,
    expression: Expression | string,
  ): LabInput[] => {
    const selectedValueId =
      typeof expression === 'string'
        ? expression
        : expression.kind === 'variable'
          ? expression.name
          : expression.kind === 'participants'
            ? 'runtime.participants'
            : '';
    return selectedValueId
      ? [
          {
            name,
            label,
            type,
            selectedValueId,
            ...(ownerCompositeId ? { boundary: 'from-parent' as const } : {}),
          },
        ]
      : [];
  };

  switch (operation.kind) {
    case 'random.select':
      return referenceInput('from', 'FROM', t.collection(t.participant), operation.from);
    case 'collection.draw': {
      const type = valueType(fixture, operation.collectionVariable, ownerCompositeId);
      return referenceInput(
        'from',
        'FROM',
        type?.kind === 'collection' ? type : t.collection(t.card),
        operation.collectionVariable,
      );
    }
    case 'collection.shuffle':
      return referenceInput(
        'collection',
        'COLLECTION',
        valueType(fixture, expressionId(operation.collection), ownerCompositeId) ??
          t.collection(t.card),
        operation.collection,
      );
    case 'input.wait':
      return referenceInput('participant', 'PARTICIPANT', t.participant, operation.participant);
    case 'present':
      return operation.audience.kind === 'participant'
        ? referenceInput('audience', 'PRIVATE AUDIENCE', t.participant, operation.audience.id)
        : [];
    case 'set': {
      const expected = valueType(fixture, operation.variable, ownerCompositeId);
      return expected ? referenceInput('value', 'VALUE', expected, operation.value) : [];
    }
    case 'composite.invoke': {
      const composite = fixture.definition.composites.find(
        (item) => item.id === operation.compositeId,
      );
      return (composite?.inputs ?? []).flatMap((port) =>
        referenceInput(
          port.name,
          port.name.toUpperCase(),
          port.type,
          operation.arguments[port.name]!,
        ),
      );
    }
    default:
      return [];
  }
}

function operationOutputs(operation: Operation): readonly string[] {
  switch (operation.kind) {
    case 'random.select':
    case 'collection.shuffle':
    case 'collection.draw':
    case 'input.wait':
      return [operation.output];
    case 'set':
      return [operation.variable];
    case 'composite.invoke':
      return Object.values(operation.outputs);
    default:
      return [];
  }
}

export function valuesForFixture(
  fixture: ReferenceFixture,
  compositeId?: string,
): readonly LabValue[] {
  if (compositeId) {
    const composite = fixture.definition.composites.find((item) => item.id === compositeId);
    if (!composite) return [];
    const nodes = projectFixture(fixture, compositeId);
    const producer = new Map<string, LabNode>();
    for (const node of nodes) for (const output of node.outputIds) producer.set(output, node);
    return [...composite.inputs, ...composite.outputs].map((port) => {
      const node = producer.get(port.name);
      const isInput = composite.inputs.some((input) => input.name === port.name);
      return {
        id: port.name,
        label: humanize(port.name),
        type: port.type,
        source: {
          kind: 'composite-port',
          compositeId,
          direction: isInput ? 'input' : 'output',
        },
        scope: isInput ? 'composite-input' : 'composite-output',
        sourceLabel: isInput
          ? `Input of ${composite.name}`
          : (node?.label ?? `Output of ${composite.name}`),
        sourceNodeId: isInput ? `${compositeId}:boundary` : (node?.id ?? `${compositeId}:boundary`),
        availableAfter: isInput ? -1 : (node?.index ?? Number.MAX_SAFE_INTEGER),
      };
    });
  }

  const nodes = projectFixture(fixture);
  const producer = new Map<string, LabNode>();
  for (const node of nodes) for (const output of node.outputIds) producer.set(output, node);
  return [
    {
      id: 'runtime.participants',
      label: 'Joined Participants',
      type: t.collection(t.participant),
      source: { kind: 'runtime' },
      scope: 'runtime',
      sourceLabel: 'Runtime / joined participants',
      sourceNodeId: 'runtime-values',
      availableAfter: -1,
    },
    ...fixture.definition.variables.map((declaration) => {
      const node = producer.get(declaration.name);
      const initialized = declaration.initial !== undefined;
      return {
        id: declaration.name,
        label: humanize(declaration.name),
        type: declaration.type,
        source: initialized
          ? ({ kind: 'variable', variableName: declaration.name } as const)
          : ({ kind: 'block', blockId: node?.id ?? 'unassigned' } as const),
        scope: initialized ? ('game' as const) : ('flow-output' as const),
        sourceLabel: initialized ? 'Game value declaration' : (node?.label ?? 'Unassigned output'),
        sourceNodeId: initialized ? 'game-values' : (node?.id ?? 'unassigned'),
        availableAfter: initialized ? -1 : (node?.index ?? Number.MAX_SAFE_INTEGER),
      };
    }),
  ];
}

export function candidatesForInput(
  fixture: ReferenceFixture,
  node: LabNode,
  input: LabInput,
  query = '',
  compositeId?: string,
): readonly LabCandidate[] {
  const normalized = query.trim().toLowerCase();
  const values = valuesForFixture(fixture, compositeId).filter(
    (value) =>
      value.availableAfter < node.index &&
      (!normalized ||
        `${value.label} ${describeType(value.type)} ${scopeLabel(value.scope)}`
          .toLowerCase()
          .includes(normalized)),
  );
  return referenceCompatibility(values, input.type).map((candidate) => ({
    ...candidate,
    value: values.find((value) => value.id === candidate.reference.id)!,
  }));
}

export function sourceForReference(
  fixture: ReferenceFixture,
  valueId: string,
  compositeId?: string,
): LabValue | undefined {
  return valuesForFixture(fixture, compositeId).find((value) => value.id === valueId);
}

export function consumersOfReference(
  fixture: ReferenceFixture,
  valueId: string,
  compositeId?: string,
): readonly LabNode[] {
  return projectFixture(fixture, compositeId).filter((node) =>
    node.inputs.some((input) => input.selectedValueId === valueId),
  );
}

export function outlineForFixture(fixture: ReferenceFixture): readonly string[] {
  const values = valuesForFixture(fixture).filter(
    (value) => value.scope === 'game' || value.scope === 'runtime',
  );
  const nodes = projectFixture(fixture);
  return [
    fixture.definition.title,
    ...values.map(
      (value) => `  ${value.label} : ${describeType(value.type)} [${scopeLabel(value.scope)}]`,
    ),
    ...nodes.flatMap((node) => [
      `  ${node.label}`,
      ...node.inputs.map((input) => {
        const value = sourceForReference(fixture, input.selectedValueId);
        return `    ${input.label.toLowerCase()} ← ${value?.label ?? input.selectedValueId} : ${describeType(input.type)}`;
      }),
      ...node.outputIds.map((output) => {
        const value = sourceForReference(fixture, output);
        return `    output → ${value?.label ?? humanize(output)} : ${value ? describeType(value.type) : 'unknown'}`;
      }),
    ]),
  ];
}

export function referenceEdges(
  fixture: ReferenceFixture,
  compositeId?: string,
): readonly { readonly source: LabValue; readonly consumer: LabNode; readonly input: LabInput }[] {
  return projectFixture(fixture, compositeId).flatMap((node) =>
    node.inputs.flatMap((input) => {
      const source = sourceForReference(fixture, input.selectedValueId, compositeId);
      return source ? [{ source, consumer: node, input }] : [];
    }),
  );
}

export function initialReferenceWorkingCopy(): ReferenceWorkingCopy {
  return { deletedNodeIds: [], addedNodes: [] };
}

export function deleteWorkingCopyBlock(
  workingCopy: ReferenceWorkingCopy,
  nodeId: string,
): ReferenceWorkingCopy {
  if (workingCopy.addedNodes.some((addition) => addition.node.id === nodeId)) {
    return {
      ...workingCopy,
      addedNodes: workingCopy.addedNodes.filter((addition) => addition.node.id !== nodeId),
    };
  }
  return workingCopy.deletedNodeIds.includes(nodeId)
    ? workingCopy
    : { ...workingCopy, deletedNodeIds: [...workingCopy.deletedNodeIds, nodeId] };
}

export function addWorkingCopyBlock(
  workingCopy: ReferenceWorkingCopy,
  kind: ReferenceLabStepKind,
  compositeId?: string,
): ReferenceWorkingCopy {
  const suffix = workingCopy.addedNodes.length + 1;
  const operation =
    kind === 'present'
      ? announce(`lab-present-${suffix}`, 'New message')
      : wait(`lab-wait-${suffix}`, 3000);
  const node: LabNode = {
    id: operation.id,
    operation,
    label: kind === 'present' ? 'Present' : 'Wait',
    detail: kind === 'present' ? 'New public message.' : '3 seconds.',
    inputs: [],
    outputIds: [],
    index: Number.MAX_SAFE_INTEGER,
  };
  return {
    ...workingCopy,
    addedNodes: [...workingCopy.addedNodes, { ...(compositeId ? { compositeId } : {}), node }],
  };
}

export function projectWorkingCopy(
  fixture: ReferenceFixture,
  workingCopy: ReferenceWorkingCopy,
  compositeId?: string,
): readonly LabNode[] {
  const canonical = projectFixture(fixture, compositeId).filter(
    (node) => !workingCopy.deletedNodeIds.includes(node.id),
  );
  const additions = workingCopy.addedNodes
    .filter(
      (addition) =>
        addition.compositeId === compositeId &&
        !workingCopy.deletedNodeIds.includes(addition.node.id),
    )
    .map((addition, offset) => ({ ...addition.node, index: canonical.length + offset }));
  const terminalIndex = canonical.findIndex((node) => node.operation.kind === 'end');
  return terminalIndex < 0
    ? [...canonical, ...additions]
    : [...canonical.slice(0, terminalIndex), ...additions, ...canonical.slice(terminalIndex)];
}

export function workingCopyDiagnostics(
  fixture: ReferenceFixture,
  workingCopy: ReferenceWorkingCopy,
  compositeId?: string,
): readonly WorkingCopyDiagnostic[] {
  if (workingCopy.deletedNodeIds.length === 0) {
    return workingCopy.addedNodes.some((addition) => addition.compositeId === compositeId)
      ? [
          {
            code: 'working_copy_changed',
            nodeId: workingCopy.addedNodes.at(-1)!.node.id,
            message: 'A step was added to the working copy. The canonical fixture is unchanged.',
          },
        ]
      : [];
  }
  const nodes = projectFixture(fixture, compositeId);
  const deleted = new Set(workingCopy.deletedNodeIds);
  const relevantDeleted = nodes.filter((node) => deleted.has(node.id));
  if (relevantDeleted.length === 0) return [];
  const deletedOutputs = new Map<string, LabNode>();
  for (const node of relevantDeleted)
    for (const output of node.outputIds) deletedOutputs.set(output, node);

  const dangling = nodes.flatMap((node) =>
    deleted.has(node.id)
      ? []
      : node.inputs.flatMap((input) => {
          const producer = deletedOutputs.get(input.selectedValueId);
          return producer
            ? [
                {
                  code: 'dangling_reference' as const,
                  nodeId: node.id,
                  message: `${node.label} still references ${humanize(input.selectedValueId)}, produced by deleted block ${producer.label}.`,
                },
              ]
            : [];
        }),
  );
  return dangling.length
    ? dangling
    : [
        {
          code: 'working_copy_changed',
          nodeId: workingCopy.deletedNodeIds.at(-1)!,
          message: 'The lab working copy differs from the validated canonical fixture.',
        },
      ];
}

export function scopeLabel(scope: ReferenceScope): string {
  switch (scope) {
    case 'runtime':
      return 'Runtime value';
    case 'game':
      return 'Game / root value';
    case 'flow-output':
      return 'Current flow output';
    case 'composite-input':
      return 'Composite input';
    case 'composite-output':
      return 'Composite-local output';
  }
}

export function typeLabel(type: TypeRef): string {
  const shown = describeType(type);
  return shown[0]!.toUpperCase() + shown.slice(1);
}

export function parentBinding(
  fixture: ReferenceFixture,
  compositeId: string,
  portName: string,
): LabValue | undefined {
  const invocation = projectFixture(fixture).find((node) => node.compositeId === compositeId);
  const input = invocation?.inputs.find((item) => item.name === portName);
  return input ? sourceForReference(fixture, input.selectedValueId) : undefined;
}

export function initialReferenceNavigation(): ReferenceNavigationState {
  return { context: 'parent', history: [] };
}

export function enterComposite(
  state: ReferenceNavigationState,
  compositeId: string,
  parentNodeId: string,
): ReferenceNavigationState {
  return {
    context: 'composite',
    compositeId,
    history: [
      ...state.history,
      {
        context: state.context,
        ...(state.compositeId ? { compositeId: state.compositeId } : {}),
        focusedNodeId: parentNodeId,
      },
    ],
  };
}

export function navigateToReferenceSource(
  fixture: ReferenceFixture,
  state: ReferenceNavigationState,
  value: LabValue,
): ReferenceNavigationState {
  const frame = {
    context: state.context,
    ...(state.compositeId ? { compositeId: state.compositeId } : {}),
    ...(state.focusedNodeId ? { focusedNodeId: state.focusedNodeId } : {}),
  } as const;
  if (state.context === 'composite' && value.scope === 'composite-input' && state.compositeId) {
    const parent = parentBinding(fixture, state.compositeId, value.id);
    return {
      context: 'source',
      ...(parent ? { sourceValueId: parent.id } : { sourceValueId: value.id }),
      ...(parent ? { focusedNodeId: parent.sourceNodeId } : {}),
      history: [...state.history, frame],
    };
  }
  return {
    context: 'source',
    sourceValueId: value.id,
    ...(state.compositeId ? { sourceCompositeId: state.compositeId } : {}),
    focusedNodeId: value.sourceNodeId,
    history: [...state.history, frame],
  };
}

export function backReferenceNavigation(state: ReferenceNavigationState): ReferenceNavigationState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...previous, history: state.history.slice(0, -1) };
}

function valueType(
  fixture: ReferenceFixture,
  valueId: string,
  compositeId?: string,
): TypeRef | undefined {
  if (valueId === 'runtime.participants') return t.collection(t.participant);
  if (compositeId) {
    const composite = fixture.definition.composites.find((item) => item.id === compositeId);
    return [...(composite?.inputs ?? []), ...(composite?.outputs ?? [])].find(
      (port) => port.name === valueId,
    )?.type;
  }
  return fixture.definition.variables.find((declaration) => declaration.name === valueId)?.type;
}

function expressionId(expression: Expression): string {
  return expression.kind === 'variable'
    ? expression.name
    : expression.kind === 'participants'
      ? 'runtime.participants'
      : '';
}

function operationLabel(operation: Operation, composite?: CompositeDefinition): string {
  switch (operation.kind) {
    case 'random.select':
      return operation.output === 'roundWinner' ? 'Choose Round Winner' : 'Choose Player';
    case 'collection.draw':
      return 'Draw Card';
    case 'collection.shuffle':
      return 'Shuffle Collection';
    case 'input.wait':
      return 'Ask Question';
    case 'present':
      return operation.privacy === 'private' ? 'Present Privately' : 'Present';
    case 'time.wait':
      return 'Wait';
    case 'composite.invoke':
      return composite?.name ?? 'Composite';
    case 'set':
      return 'Pass Card Through';
    case 'end':
      return 'Continue';
    default:
      return operation.kind;
  }
}

function operationDetail(operation: Operation, composite?: CompositeDefinition): string {
  switch (operation.kind) {
    case 'random.select':
      return 'Produces one Participant from runtime participants.';
    case 'collection.draw':
      return 'Consumes the selected collection and produces one Card.';
    case 'collection.shuffle':
      return 'Uses injected RNG; result remains server-owned.';
    case 'input.wait':
      return operation.prompt;
    case 'present':
      return operation.privacy === 'private'
        ? 'Server-filtered participant audience.'
        : 'Public presentation step.';
    case 'time.wait':
      return `${operation.durationMs} ms of logical time.`;
    case 'composite.invoke':
      return `${composite?.inputs.length ?? 0} typed inputs · ${composite?.outputs.length ?? 0} typed output`;
    case 'set':
      return 'Copies the typed input to the Composite output.';
    case 'end':
      return 'Terminal operation.';
    default:
      return 'Nested control flow.';
  }
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
