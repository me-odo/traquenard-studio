import {
  IR_VERSION,
  literal,
  publishArtifact,
  t,
  variable,
  type Card,
  type GameArtifact,
  type GameDefinition,
} from '@traquenard/game-ir';

const turnComposite = {
  id: 'turn.challenge',
  version: 1,
  name: 'Challenge turn',
  inputs: [{ name: 'participant', type: t.participant }] as const,
  outputs: [{ name: 'response', type: t.string }] as const,
  implementation: {
    id: 'turn-sequence',
    kind: 'sequence' as const,
    steps: [
      {
        id: 'turn-private',
        kind: 'present' as const,
        audience: {
          kind: 'participants' as const,
          ids: literal(['p2'], t.collection(t.participant)),
        },
        message: literal('You were selected.', t.string),
        privacy: 'private' as const,
      },
      {
        id: 'turn-input',
        kind: 'input.wait' as const,
        participant: variable('participant'),
        prompt: 'Choose a challenge',
        options: ['Mime', 'Story'],
        output: 'response',
      },
    ],
  },
};

const sequential: GameDefinition = {
  irVersion: IR_VERSION,
  gameId: 'reference-sequential',
  title: 'Reference A — Sequential interaction',
  variables: [
    { name: 'selectedPlayer', type: t.participant },
    { name: 'answer', type: t.string },
  ],
  composites: [turnComposite],
  root: {
    id: 'root-a',
    kind: 'sequence',
    steps: [
      {
        id: 'pick-player',
        kind: 'random.select',
        from: { kind: 'participants' },
        output: 'selectedPlayer',
      },
      {
        id: 'announce',
        kind: 'present',
        audience: { kind: 'everyone' },
        message: literal('A challenger was selected.', t.string),
        privacy: 'public',
      },
      {
        id: 'play-turn',
        kind: 'composite.invoke',
        compositeId: 'turn.challenge',
        arguments: { participant: variable('selectedPlayer') },
        outputs: { response: 'answer' },
      },
      { id: 'end-a', kind: 'end' },
    ],
  },
};

const groupVote: GameDefinition = {
  irVersion: IR_VERSION,
  gameId: 'reference-group-vote',
  title: 'Reference B — Group vote',
  variables: [
    { name: 'vote1', type: t.string },
    { name: 'vote2', type: t.string },
    { name: 'vote3', type: t.string },
  ],
  composites: [],
  root: {
    id: 'root-b',
    kind: 'sequence',
    steps: [
      {
        id: 'vote-together',
        kind: 'control.parallel',
        join: 'all',
        branches: ['p1', 'p2', 'p3'].map((participantId, index) => ({
          id: `vote-${participantId}`,
          kind: 'input.wait' as const,
          participant: literal(participantId, t.participant),
          prompt: 'Vote privately',
          options: ['Forest', 'Castle'],
          output: `vote${index + 1}`,
        })),
      },
      {
        id: 'vote-complete',
        kind: 'present',
        audience: { kind: 'everyone' },
        message: literal('All votes are in.', t.string),
        privacy: 'public',
      },
      { id: 'end-b', kind: 'end' },
    ],
  },
};

const cards: readonly Card[] = [
  { id: 'hearts-a', suit: 'hearts', rank: 'A' },
  { id: 'spades-k', suit: 'spades', rank: 'K' },
  { id: 'diamonds-q', suit: 'diamonds', rank: 'Q' },
];

const cardRound: GameDefinition = {
  irVersion: IR_VERSION,
  gameId: 'reference-card-round',
  title: 'Reference C — Simple card round',
  variables: [
    { name: 'deck', type: t.collection(t.card), initial: cards },
    { name: 'handCard', type: t.card },
  ],
  composites: [
    {
      id: 'round.deal-one',
      version: 1,
      name: 'Deal one card',
      inputs: [{ name: 'sourceDeck', type: t.collection(t.card) }],
      outputs: [
        { name: 'remainingDeck', type: t.collection(t.card) },
        { name: 'dealtCard', type: t.card },
      ],
      implementation: {
        id: 'deal-sequence',
        kind: 'sequence',
        steps: [
          {
            id: 'shuffle',
            kind: 'collection.shuffle',
            collection: variable('sourceDeck'),
            output: 'remainingDeck',
          },
          {
            id: 'draw',
            kind: 'collection.draw',
            collectionVariable: 'remainingDeck',
            output: 'dealtCard',
          },
          {
            id: 'private-card',
            kind: 'present',
            audience: { kind: 'participants', ids: literal(['p2'], t.collection(t.participant)) },
            message: literal('Your private card is ready.', t.string),
            privacy: 'private',
          },
          { id: 'round-timer', kind: 'time.wait', durationMs: 3000 },
        ],
      },
    },
  ],
  root: {
    id: 'root-c',
    kind: 'sequence',
    steps: [
      {
        id: 'deal-round',
        kind: 'composite.invoke',
        compositeId: 'round.deal-one',
        arguments: { sourceDeck: variable('deck') },
        outputs: { remainingDeck: 'deck', dealtCard: 'handCard' },
      },
      { id: 'end-c', kind: 'end' },
    ],
  },
};

const standardCards = {
  packId: 'standard-cards',
  version: '1.0.0',
  contentHash: 'builtin-standard-cards-v1',
} as const;

export const referenceArtifacts: readonly GameArtifact[] = [
  publishArtifact(sequential, 1),
  publishArtifact(groupVote, 1),
  publishArtifact(cardRound, 1, [standardCards]),
];

export const referenceSequential = referenceArtifacts[0]!;
export const referenceGroupVote = referenceArtifacts[1]!;
export const referenceCardRound = referenceArtifacts[2]!;
