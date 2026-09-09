import { IR_VERSION, literal, t, type GameDefinition, type Operation } from '@traquenard/game-ir';

export type ParallelFixtureKey = 'two-player' | 'group-vote' | 'mixed' | 'stress';
type ParallelBranchOperation = Extract<Operation, { kind: 'input.wait' | 'time.wait' | 'present' }>;

export interface ParallelFixture {
  readonly key: ParallelFixtureKey;
  readonly shortLabel: string;
  readonly description: string;
  readonly definition: GameDefinition;
}

const participantInput = (
  id: string,
  participantId: string,
  prompt: string,
  output: string,
): ParallelBranchOperation => ({
  id,
  kind: 'input.wait',
  participant: literal(participantId, t.participant),
  prompt,
  options: ['Forest', 'Castle'],
  output,
});

const timer = (id: string, durationMs: number): ParallelBranchOperation => ({
  id,
  kind: 'time.wait',
  durationMs,
});

const presentation = (id: string, message: string): ParallelBranchOperation => ({
  id,
  kind: 'present',
  audience: { kind: 'everyone' },
  message: literal(message, t.string),
  privacy: 'public',
});

function fixture(
  key: ParallelFixtureKey,
  shortLabel: string,
  title: string,
  description: string,
  branches: readonly ParallelBranchOperation[],
): ParallelFixture {
  const variables = branches.flatMap((branch) =>
    branch.kind === 'input.wait' ? [{ name: branch.output, type: t.string }] : [],
  );
  return {
    key,
    shortLabel,
    description,
    definition: {
      irVersion: IR_VERSION,
      gameId: `parallel-lab-${key}`,
      title,
      variables,
      composites: [],
      root: {
        id: `${key}-root`,
        kind: 'sequence',
        steps: [
          presentation(`${key}-intro`, 'Start the round together.'),
          {
            id: `${key}-parallel`,
            kind: 'control.parallel',
            join: 'all',
            branches,
          },
          presentation(`${key}-continue`, 'Everyone is ready. Continue to results.'),
          { id: `${key}-end`, kind: 'end' },
        ],
      },
    },
  };
}

export const parallelFixtures: readonly ParallelFixture[] = [
  fixture(
    'two-player',
    '2-player',
    'Two-player parallel input',
    'Two participants answer independently before the round continues.',
    [
      participantInput('answer-p1', 'p1', 'Choose a destination', 'answer1'),
      participantInput('answer-p2', 'p2', 'Choose a destination', 'answer2'),
    ],
  ),
  fixture(
    'group-vote',
    'Group vote',
    'Three-player group vote',
    'Adapted from the reference group-vote artifact: three private votes join with all.',
    ['p1', 'p2', 'p3'].map((participantId, index) =>
      participantInput(
        `vote-${participantId}`,
        participantId,
        'Vote privately',
        `vote${index + 1}`,
      ),
    ),
  ),
  fixture(
    'mixed',
    'Mixed',
    'Heterogeneous branches',
    'Two participant inputs and one logical timer are concurrent peers.',
    [
      participantInput('prompt-p1', 'p1', 'Name the clue', 'clue1'),
      participantInput('prompt-p2', 'p2', 'Choose the category', 'category2'),
      timer('round-time-limit', 10_000),
    ],
  ),
  fixture(
    'stress',
    '6-branch stress',
    'Six-branch scale stress',
    'Long labels and mixed branch types test hierarchy at the current v1 limit of the prototype.',
    [
      participantInput(
        'expedition-leader-answer',
        'p1',
        'Expedition leader chooses the route through the old forest',
        'route',
      ),
      participantInput(
        'navigator-answer',
        'p2',
        'Navigator confirms the compass bearing',
        'bearing',
      ),
      participantInput('scout-answer', 'p3', 'Scout reports whether the bridge is safe', 'bridge'),
      participantInput(
        'quartermaster-answer',
        'p4',
        'Quartermaster selects the shared supplies',
        'supplies',
      ),
      timer('decision-window', 15_000),
      presentation('audience-reminder', 'The audience sees a public reminder.'),
    ],
  ),
] as const;

export function fixtureByKey(key: ParallelFixtureKey): ParallelFixture {
  return parallelFixtures.find((item) => item.key === key)!;
}
