import { IR_VERSION, literal, t, type GameDefinition, type Operation } from '@traquenard/game-ir';

export type ParallelFixtureKey = 'two-player' | 'group-vote' | 'mixed' | 'stress';
export type ParallelVariant = 'lanes' | 'graph' | 'grouped';
export type LabViewport = 'desktop' | 'mobile';
export type InsertableBranchKind = 'input.wait' | 'time.wait' | 'present';
export type ParallelBranchOperation = Extract<Operation, { kind: InsertableBranchKind }>;

export interface ParallelFixture {
  readonly key: ParallelFixtureKey;
  readonly shortLabel: string;
  readonly description: string;
  readonly definition: GameDefinition;
}

export interface LabBranch {
  readonly id: string;
  readonly operation?: ParallelBranchOperation;
}

export interface ParallelContext {
  readonly before: readonly Operation[];
  readonly parallel: Extract<Operation, { kind: 'control.parallel' }>;
  readonly after: readonly Operation[];
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

export function parallelContext(definition: GameDefinition): ParallelContext {
  if (definition.root.kind !== 'sequence')
    throw new Error('Parallel Lab fixtures require a sequence root.');
  const parallelIndex = definition.root.steps.findIndex(
    (operation) => operation.kind === 'control.parallel',
  );
  const parallel = definition.root.steps[parallelIndex];
  if (!parallel || parallel.kind !== 'control.parallel')
    throw new Error('Parallel Lab fixtures require one parallel operation.');
  return {
    before: definition.root.steps.slice(0, parallelIndex),
    parallel,
    after: definition.root.steps.slice(parallelIndex + 1),
  };
}

export function branchesFromFixture(definition: GameDefinition): readonly LabBranch[] {
  return parallelContext(definition).parallel.branches.map((operation) => {
    if (!isParallelBranch(operation)) throw new Error(`Unsupported v1 branch '${operation.kind}'.`);
    return { id: operation.id, operation };
  });
}

export function addEmptyBranch(branches: readonly LabBranch[]): readonly LabBranch[] {
  let suffix = branches.length + 1;
  while (branches.some((branch) => branch.id === `draft-branch-${suffix}`)) suffix += 1;
  return [...branches, { id: `draft-branch-${suffix}` }];
}

export function removeBranch(
  branches: readonly LabBranch[],
  branchId: string,
): readonly LabBranch[] {
  return branches.filter((branch) => branch.id !== branchId);
}

export function insertBranchOperation(
  branches: readonly LabBranch[],
  branchId: string,
  kind: InsertableBranchKind,
): readonly LabBranch[] {
  return branches.map((branch) =>
    branch.id === branchId
      ? { ...branch, operation: createBranchOperation(kind, branchId) }
      : branch,
  );
}

export function operationName(operation: ParallelBranchOperation | undefined): string {
  switch (operation?.kind) {
    case 'input.wait':
      return 'Participant input';
    case 'time.wait':
      return 'Logical timer';
    case 'present':
      return 'Presentation';
    case undefined:
      return 'Empty branch';
  }
}

export function operationSummary(operation: ParallelBranchOperation | undefined): string {
  switch (operation?.kind) {
    case 'input.wait':
      return operation.prompt;
    case 'time.wait':
      return `Wait ${operation.durationMs / 1000} seconds`;
    case 'present':
      return operation.message.kind === 'literal' && typeof operation.message.value === 'string'
        ? operation.message.value
        : 'Show public message';
    case undefined:
      return 'Choose one v1-compatible operation.';
  }
}

export function operationOwner(operation: ParallelBranchOperation | undefined): string {
  if (!operation) return 'Unassigned';
  if (operation.kind === 'time.wait') return 'System · logical time';
  if (operation.kind === 'present') return 'Audience · everyone';
  return operation.participant.kind === 'literal' && typeof operation.participant.value === 'string'
    ? `Participant · ${operation.participant.value}`
    : 'Participant · typed reference';
}

export function continuationLabel(definition: GameDefinition): string {
  const continuation = parallelContext(definition).after[0];
  return continuation?.kind === 'present' &&
    continuation.message.kind === 'literal' &&
    typeof continuation.message.value === 'string'
    ? continuation.message.value
    : 'Continue to the next operation';
}

function isParallelBranch(operation: Operation): operation is ParallelBranchOperation {
  return ['input.wait', 'time.wait', 'present'].includes(operation.kind);
}

function createBranchOperation(
  kind: InsertableBranchKind,
  branchId: string,
): ParallelBranchOperation {
  switch (kind) {
    case 'input.wait':
      return participantInput(
        `${branchId}-input`,
        'next participant',
        'Choose one',
        `${branchId}-answer`,
      );
    case 'time.wait':
      return timer(`${branchId}-timer`, 10_000);
    case 'present':
      return presentation(`${branchId}-presentation`, 'Show a public message.');
  }
}
