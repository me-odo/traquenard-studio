import {
  IR_VERSION,
  literal,
  t,
  variable,
  type Card,
  type CompositeDefinition,
  type GameDefinition,
} from '@traquenard/game-ir';

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
      { id: 'prepare-draw', kind: 'collection.draw', collectionVariable: 'deck', output: 'card' },
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
    { name: 'featuredPlayers', type: t.collection(t.participant), initial: ['p1', 'p2'] },
    { name: 'score', type: t.number, initial: 0 },
    { name: 'roundTitle', type: t.string, initial: 'Friday Night Challenge' },
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
        condition: { kind: 'equals', left: variable('answer'), right: literal('Yes', t.string) },
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
        arguments: { player: variable('currentPlayer'), deck: variable('questionsDeck') },
        outputs: { card: 'preparedCard' },
      },
      { id: 'finish-game', kind: 'end' },
    ],
  },
});

export function createAuthoringWorkingDefinition(): GameDefinition {
  return structuredClone(authoringCanonicalDefinition);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
