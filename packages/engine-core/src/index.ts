import type {
  Audience,
  Expression,
  GameArtifact,
  Operation,
  ParticipantId,
  TypeRef,
  Value,
} from '@traquenard/game-ir';

export interface Participant {
  readonly id: ParticipantId;
  readonly name: string;
  readonly isHost: boolean;
  readonly required: boolean;
  readonly teamId?: string;
  readonly roleId?: string;
}

export interface ResolvedAudience {
  readonly kind: Audience['kind'];
  readonly participantIds: readonly ParticipantId[];
}

export type SemanticEvent =
  | { readonly kind: 'random.selected'; readonly operationId: string; readonly value: Value }
  | {
      readonly kind: 'collection.shuffled';
      readonly operationId: string;
      readonly value: readonly Value[];
    }
  | { readonly kind: 'collection.drawn'; readonly operationId: string; readonly value: Value }
  | {
      readonly kind: 'presentation.emitted';
      readonly operationId: string;
      readonly message: string;
      readonly privacy: 'public' | 'private';
      readonly audience: ResolvedAudience;
    }
  | {
      readonly kind: 'input.requested';
      readonly operationId: string;
      readonly participantId: ParticipantId;
      readonly prompt: string;
      readonly options: readonly string[];
      readonly audience: ResolvedAudience;
    }
  | { readonly kind: 'timer.scheduled'; readonly operationId: string; readonly dueAt: number }
  | { readonly kind: 'execution.completed'; readonly operationId: string };

interface Frame {
  readonly operation: Operation;
  readonly locals: Readonly<Record<string, Value>>;
}

export interface PendingInput {
  readonly kind: 'input';
  readonly operationId: string;
  readonly participantId: ParticipantId;
  readonly options: readonly string[];
  readonly output: string;
}

export interface PendingTimer {
  readonly kind: 'timer';
  readonly operationId: string;
  readonly dueAt: number;
}

export type PendingWait = PendingInput | PendingTimer;

export interface EngineState {
  readonly artifact: GameArtifact;
  readonly participants: readonly Participant[];
  readonly variables: Readonly<Record<string, Value>>;
  readonly frames: readonly Frame[];
  readonly pending: Readonly<Record<string, PendingWait>>;
  readonly rngState: number;
  readonly logicalTime: number;
  readonly completed: boolean;
}

export class EngineError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AxiomDescriptor {
  readonly id: Operation['kind'];
  readonly version: 1;
  readonly responsibility: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly effects: readonly string[];
  readonly determinism: string;
  readonly serialization: string;
  readonly execution: string;
  readonly errors: readonly string[];
}

const descriptor = (
  id: Operation['kind'],
  responsibility: string,
  inputs: string[],
  outputs: string[],
  effects: string[],
  execution: string,
  errors: string[] = [],
): AxiomDescriptor => ({
  id,
  version: 1,
  responsibility,
  inputs,
  outputs,
  effects,
  determinism:
    'Pure for explicit state, seed/RNG state, logical time, and ordered external inputs.',
  serialization: `Game IR v1 discriminated operation '${id}'.`,
  execution,
  errors,
});

export const axiomRegistry: readonly AxiomDescriptor[] = [
  descriptor(
    'sequence',
    'Order child operations.',
    ['steps'],
    [],
    ['control'],
    'Pushes children in declared order.',
  ),
  descriptor(
    'set',
    'Write a typed state variable.',
    ['variable', 'value'],
    [],
    ['state'],
    'Evaluates the expression and replaces the variable.',
    ['UNKNOWN_VARIABLE'],
  ),
  descriptor(
    'random.select',
    'Select one collection member.',
    ['collection', 'RNG state'],
    ['value'],
    ['state', 'event'],
    'Advances explicit seeded RNG once.',
    ['EMPTY_COLLECTION'],
  ),
  descriptor(
    'present',
    'Emit audience-scoped presentation intent.',
    ['audience', 'message'],
    [],
    ['event'],
    'Resolves audience server-side and emits predetermined content.',
  ),
  descriptor(
    'input.wait',
    'Wait for a participant choice.',
    ['participant', 'prompt', 'options'],
    ['choice'],
    ['wait', 'event'],
    'Creates an idempotently addressable pending input.',
    ['UNKNOWN_PARTICIPANT'],
  ),
  descriptor(
    'control.if',
    'Choose a branch.',
    ['boolean condition'],
    [],
    ['control'],
    'Evaluates one branch only.',
  ),
  descriptor(
    'control.foreach',
    'Iterate a collection in stable order.',
    ['collection', 'item binding'],
    [],
    ['control'],
    'Expands frames without mutating the collection.',
  ),
  descriptor(
    'control.parallel',
    'Start independent waits and join all.',
    ['branches'],
    [],
    ['control', 'wait'],
    'V1 accepts only independent wait/presentation branches.',
    ['UNSAFE_PARALLEL_BRANCH'],
  ),
  descriptor(
    'time.wait',
    'Wait until logical time reaches a due point.',
    ['duration', 'logical time'],
    [],
    ['wait', 'event'],
    'Schedules against explicit logical time.',
  ),
  descriptor(
    'collection.shuffle',
    'Deterministically permute a collection.',
    ['collection', 'RNG state'],
    ['collection'],
    ['state', 'event'],
    'Uses Fisher–Yates with explicit seeded RNG.',
  ),
  descriptor(
    'collection.draw',
    'Remove and return the first collection item.',
    ['collection variable'],
    ['item'],
    ['state', 'event'],
    'Reads index zero and persists the remainder.',
    ['EMPTY_COLLECTION'],
  ),
  descriptor(
    'composite.invoke',
    'Invoke an inspectable declarative subgraph.',
    ['composite id'],
    [],
    ['control'],
    'Pushes the pinned composite implementation.',
    ['UNKNOWN_COMPOSITE'],
  ),
  descriptor(
    'end',
    'Mark semantic execution complete.',
    [],
    [],
    ['event'],
    'Clears frames and emits completion.',
  ),
] as const;

export function createEngineState(
  artifact: GameArtifact,
  participants: readonly Participant[],
  seed: number,
): EngineState {
  const variables = Object.fromEntries(
    artifact.definition.variables.map((item) => [
      item.name,
      item.initial ?? defaultValue(item.type),
    ]),
  );
  return {
    artifact,
    participants,
    variables,
    frames: [{ operation: artifact.definition.root, locals: {} }],
    pending: {},
    rngState: normalizeSeed(seed),
    logicalTime: 0,
    completed: false,
  };
}

export function advanceExecution(original: EngineState): {
  state: EngineState;
  events: readonly SemanticEvent[];
} {
  let state = original;
  const events: SemanticEvent[] = [];
  let safety = 0;
  while (!state.completed && Object.keys(state.pending).length === 0 && state.frames.length > 0) {
    if (++safety > 10_000)
      throw new EngineError('STEP_LIMIT', 'Execution exceeded the synchronous step limit.');
    const frame = state.frames[state.frames.length - 1]!;
    state = { ...state, frames: state.frames.slice(0, -1) };
    const operation = frame.operation;
    switch (operation.kind) {
      case 'sequence':
        state = pushFrames(state, operation.steps, frame.locals);
        break;
      case 'set':
        state = setVariable(
          state,
          operation.variable,
          evaluate(operation.value, state, frame.locals),
        );
        break;
      case 'random.select': {
        const collection = asCollection(evaluate(operation.from, state, frame.locals));
        if (collection.length === 0)
          throw new EngineError('EMPTY_COLLECTION', 'Cannot select from an empty collection.');
        const next = randomIndex(state.rngState, collection.length);
        const value = collection[next.index]!;
        state = setVariable({ ...state, rngState: next.state }, operation.output, value);
        events.push({ kind: 'random.selected', operationId: operation.id, value });
        break;
      }
      case 'present': {
        const message = evaluate(operation.message, state, frame.locals);
        if (typeof message !== 'string')
          throw new EngineError('INVALID_VALUE', 'Presentation message must be a string.');
        events.push({
          kind: 'presentation.emitted',
          operationId: operation.id,
          message,
          privacy: operation.privacy,
          audience: resolveAudience(operation.audience, state, frame.locals),
        });
        break;
      }
      case 'input.wait': {
        const participantId = evaluate(operation.participant, state, frame.locals);
        if (
          typeof participantId !== 'string' ||
          !state.participants.some((item) => item.id === participantId)
        )
          throw new EngineError(
            'UNKNOWN_PARTICIPANT',
            'Input target is not a session participant.',
          );
        const pending: PendingInput = {
          kind: 'input',
          operationId: operation.id,
          participantId,
          options: operation.options,
          output: operation.output,
        };
        state = { ...state, pending: { ...state.pending, [operation.id]: pending } };
        events.push({
          kind: 'input.requested',
          operationId: operation.id,
          participantId,
          prompt: operation.prompt,
          options: operation.options,
          audience: { kind: 'participants', participantIds: [participantId] },
        });
        break;
      }
      case 'control.if': {
        const condition = evaluate(operation.condition, state, frame.locals);
        if (typeof condition !== 'boolean')
          throw new EngineError('INVALID_VALUE', 'Condition must evaluate to boolean.');
        const branch = condition ? operation.then : operation.else;
        if (branch) state = pushFrames(state, [branch], frame.locals);
        break;
      }
      case 'control.foreach': {
        const collection = asCollection(evaluate(operation.collection, state, frame.locals));
        const frames = collection.map((item) => ({
          operation: operation.body,
          locals: { ...frame.locals, [operation.itemVariable]: item },
        }));
        state = { ...state, frames: [...state.frames, ...frames.reverse()] };
        break;
      }
      case 'control.parallel': {
        for (const branch of operation.branches) {
          if (branch.kind === 'present') {
            const message = evaluate(branch.message, state, frame.locals);
            if (typeof message !== 'string')
              throw new EngineError('INVALID_VALUE', 'Presentation message must be a string.');
            events.push({
              kind: 'presentation.emitted',
              operationId: branch.id,
              message,
              privacy: branch.privacy,
              audience: resolveAudience(branch.audience, state, frame.locals),
            });
          } else if (branch.kind === 'input.wait') {
            const participantId = evaluate(branch.participant, state, frame.locals);
            if (typeof participantId !== 'string')
              throw new EngineError('UNKNOWN_PARTICIPANT', 'Parallel input target is invalid.');
            state = {
              ...state,
              pending: {
                ...state.pending,
                [branch.id]: {
                  kind: 'input',
                  operationId: branch.id,
                  participantId,
                  options: branch.options,
                  output: branch.output,
                },
              },
            };
            events.push({
              kind: 'input.requested',
              operationId: branch.id,
              participantId,
              prompt: branch.prompt,
              options: branch.options,
              audience: { kind: 'participants', participantIds: [participantId] },
            });
          } else if (branch.kind === 'time.wait') {
            const dueAt = state.logicalTime + branch.durationMs;
            state = {
              ...state,
              pending: {
                ...state.pending,
                [branch.id]: { kind: 'timer', operationId: branch.id, dueAt },
              },
            };
            events.push({ kind: 'timer.scheduled', operationId: branch.id, dueAt });
          } else
            throw new EngineError(
              'UNSAFE_PARALLEL_BRANCH',
              `Unsupported parallel branch '${branch.kind}'.`,
            );
        }
        break;
      }
      case 'time.wait': {
        const dueAt = state.logicalTime + operation.durationMs;
        state = {
          ...state,
          pending: {
            ...state.pending,
            [operation.id]: { kind: 'timer', operationId: operation.id, dueAt },
          },
        };
        events.push({ kind: 'timer.scheduled', operationId: operation.id, dueAt });
        break;
      }
      case 'collection.shuffle': {
        const collection = [...asCollection(evaluate(operation.collection, state, frame.locals))];
        let rngState = state.rngState;
        for (let index = collection.length - 1; index > 0; index--) {
          const next = randomIndex(rngState, index + 1);
          rngState = next.state;
          [collection[index], collection[next.index]] = [
            collection[next.index]!,
            collection[index]!,
          ];
        }
        state = setVariable({ ...state, rngState }, operation.output, collection);
        events.push({ kind: 'collection.shuffled', operationId: operation.id, value: collection });
        break;
      }
      case 'collection.draw': {
        const collection = asCollection(state.variables[operation.collectionVariable]);
        const value = collection[0];
        if (value === undefined)
          throw new EngineError('EMPTY_COLLECTION', 'Cannot draw from an empty collection.');
        state = setVariable(
          setVariable(state, operation.collectionVariable, collection.slice(1)),
          operation.output,
          value,
        );
        events.push({ kind: 'collection.drawn', operationId: operation.id, value });
        break;
      }
      case 'composite.invoke': {
        const composite = state.artifact.definition.composites.find(
          (item) => item.id === operation.compositeId,
        );
        if (!composite)
          throw new EngineError(
            'UNKNOWN_COMPOSITE',
            `Unknown composite '${operation.compositeId}'.`,
          );
        state = pushFrames(state, [composite.implementation], frame.locals);
        break;
      }
      case 'end':
        state = { ...state, completed: true, frames: [] };
        events.push({ kind: 'execution.completed', operationId: operation.id });
        break;
    }
  }
  return { state, events };
}

export function acceptInput(
  state: EngineState,
  operationId: string,
  participantId: string,
  choice: string,
): EngineState {
  const wait = state.pending[operationId];
  if (!wait || wait.kind !== 'input')
    throw new EngineError('INPUT_NOT_PENDING', `Input '${operationId}' is not pending.`);
  if (wait.participantId !== participantId)
    throw new EngineError('INPUT_FORBIDDEN', 'The input belongs to another participant.');
  if (!wait.options.includes(choice))
    throw new EngineError('INVALID_CHOICE', `'${choice}' is not an allowed choice.`);
  const { [operationId]: ignored, ...remaining } = state.pending;
  void ignored;
  return setVariable({ ...state, pending: remaining }, wait.output, choice);
}

export function advanceLogicalTime(state: EngineState, milliseconds: number): EngineState {
  if (!Number.isInteger(milliseconds) || milliseconds < 0)
    throw new EngineError('INVALID_TIME', 'Logical time delta must be a non-negative integer.');
  const logicalTime = state.logicalTime + milliseconds;
  const pending = Object.fromEntries(
    Object.entries(state.pending).filter(
      ([, wait]) => wait.kind !== 'timer' || wait.dueAt > logicalTime,
    ),
  );
  return { ...state, logicalTime, pending };
}

export function evaluate(
  expression: Expression,
  state: EngineState,
  locals: Readonly<Record<string, Value>> = {},
): Value {
  switch (expression.kind) {
    case 'literal':
      return expression.value;
    case 'participants':
      return state.participants.map((item) => item.id);
    case 'variable': {
      const value = locals[expression.name] ?? state.variables[expression.name];
      if (value === undefined)
        throw new EngineError('UNKNOWN_VARIABLE', `Unknown variable '${expression.name}'.`);
      return value;
    }
    case 'equals':
      return (
        canonicalValue(evaluate(expression.left, state, locals)) ===
        canonicalValue(evaluate(expression.right, state, locals))
      );
  }
}

function resolveAudience(
  audience: Audience,
  state: EngineState,
  locals: Readonly<Record<string, Value>>,
): ResolvedAudience {
  const all = state.participants.map((item) => item.id);
  switch (audience.kind) {
    case 'everyone':
      return { kind: audience.kind, participantIds: all };
    case 'host':
      return {
        kind: audience.kind,
        participantIds: state.participants.filter((item) => item.isHost).map((item) => item.id),
      };
    case 'participants':
      return {
        kind: audience.kind,
        participantIds: asCollection(evaluate(audience.ids, state, locals)).map(String),
      };
    case 'team':
      return {
        kind: audience.kind,
        participantIds: state.participants
          .filter((item) => item.teamId === audience.teamId)
          .map((item) => item.id),
      };
    case 'role':
      return {
        kind: audience.kind,
        participantIds: state.participants
          .filter((item) => item.roleId === audience.roleId)
          .map((item) => item.id),
      };
  }
}

function pushFrames(
  state: EngineState,
  operations: readonly Operation[],
  locals: Readonly<Record<string, Value>>,
): EngineState {
  return {
    ...state,
    frames: [...state.frames, ...operations.map((operation) => ({ operation, locals })).reverse()],
  };
}

function setVariable(state: EngineState, name: string, value: Value): EngineState {
  if (!(name in state.variables))
    throw new EngineError('UNKNOWN_VARIABLE', `Unknown variable '${name}'.`);
  return { ...state, variables: { ...state.variables, [name]: value } };
}

function asCollection(value: Value | undefined): readonly Value[] {
  if (!Array.isArray(value)) throw new EngineError('INVALID_VALUE', 'Expected a collection value.');
  return value as readonly Value[];
}

function normalizeSeed(seed: number): number {
  const normalized = seed | 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

function randomIndex(state: number, maxExclusive: number): { state: number; index: number } {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return { state: next | 0, index: (next >>> 0) % maxExclusive };
}

function canonicalValue(value: Value): string {
  return JSON.stringify(value);
}

function defaultValue(type: TypeRef): Value {
  switch (type.kind) {
    case 'string':
    case 'participant':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'card':
      return { id: '', suit: '', rank: '' };
    case 'collection':
      return [];
  }
}
