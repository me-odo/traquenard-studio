import {
  IR_VERSION,
  literal,
  t,
  variable,
  type Card,
  type CompositeDefinition,
  type GameDefinition,
  type Operation,
} from '@traquenard/game-ir';

export type ReferenceFixtureKey =
  'two-decks' | 'current-player' | 'drawn-card' | 'composite' | 'incompatible' | 'long-flow';

export interface ReferenceFixture {
  readonly key: ReferenceFixtureKey;
  readonly shortLabel: string;
  readonly description: string;
  readonly stress: string;
  readonly definition: GameDefinition;
  readonly defaultInput?: { readonly nodeId: string; readonly portName: string };
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
