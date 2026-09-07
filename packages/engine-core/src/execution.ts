import type { Operation, Value } from '@traquenard/game-ir';
import { resolveAudience } from './audience.js';
import { EngineError } from './errors.js';
import { asCollection, evaluate } from './evaluator.js';
import { randomIndex } from './rng.js';
import { readVariable, setVariable } from './state.js';
import type { EngineState, OperationFrame, PendingInput, SemanticEvent } from './types.js';

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
    if (frame.kind === 'composite.return') {
      state = returnFromComposite(state, frame);
      continue;
    }
    const operation = frame.operation;
    switch (operation.kind) {
      case 'sequence':
        state = pushFrames(state, operation.steps, frame);
        break;
      case 'set':
        state = setVariable(
          state,
          operation.variable,
          evaluateFrame(operation.value, state, frame),
          frame.scopeId,
        );
        break;
      case 'random.select': {
        const collection = asCollection(evaluateFrame(operation.from, state, frame));
        if (collection.length === 0)
          throw new EngineError('EMPTY_COLLECTION', 'Cannot select from an empty collection.');
        const next = randomIndex(state.rngState, collection.length);
        const value = collection[next.index]!;
        state = setVariable(
          { ...state, rngState: next.state },
          operation.output,
          value,
          frame.scopeId,
        );
        events.push({ kind: 'random.selected', operationId: operation.id, value });
        break;
      }
      case 'present': {
        const message = evaluateFrame(operation.message, state, frame);
        if (typeof message !== 'string')
          throw new EngineError('INVALID_VALUE', 'Presentation message must be a string.');
        events.push({
          kind: 'presentation.emitted',
          operationId: operation.id,
          message,
          privacy: operation.privacy,
          audience: resolveAudience(operation.audience, state, frame.locals, frame.scopeId),
        });
        break;
      }
      case 'input.wait': {
        const participantId = evaluateFrame(operation.participant, state, frame);
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
          ...(frame.scopeId ? { scopeId: frame.scopeId } : {}),
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
        const condition = evaluateFrame(operation.condition, state, frame);
        if (typeof condition !== 'boolean')
          throw new EngineError('INVALID_VALUE', 'Condition must evaluate to boolean.');
        const branch = condition ? operation.then : operation.else;
        if (branch) state = pushFrames(state, [branch], frame);
        break;
      }
      case 'control.foreach': {
        const collection = asCollection(evaluateFrame(operation.collection, state, frame));
        const frames = collection.map((item) =>
          operationFrame(
            operation.body,
            { ...frame.locals, [operation.itemVariable]: item },
            frame.scopeId,
          ),
        );
        state = { ...state, frames: [...state.frames, ...frames.reverse()] };
        break;
      }
      case 'control.parallel':
        state = executeParallel(state, events, operation, frame);
        break;
      case 'time.wait': {
        const dueAt = checkedDueAt(state.logicalTime, operation.durationMs);
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
        const collection = [...asCollection(evaluateFrame(operation.collection, state, frame))];
        let rngState = state.rngState;
        for (let index = collection.length - 1; index > 0; index--) {
          const next = randomIndex(rngState, index + 1);
          rngState = next.state;
          [collection[index], collection[next.index]] = [
            collection[next.index]!,
            collection[index]!,
          ];
        }
        state = setVariable({ ...state, rngState }, operation.output, collection, frame.scopeId);
        events.push({ kind: 'collection.shuffled', operationId: operation.id, value: collection });
        break;
      }
      case 'collection.draw': {
        const collection = asCollection(
          readVariable(state, operation.collectionVariable, frame.scopeId),
        );
        const value = collection[0];
        if (value === undefined)
          throw new EngineError('EMPTY_COLLECTION', 'Cannot draw from an empty collection.');
        state = setVariable(
          setVariable(state, operation.collectionVariable, collection.slice(1), frame.scopeId),
          operation.output,
          value,
          frame.scopeId,
        );
        events.push({ kind: 'collection.drawn', operationId: operation.id, value });
        break;
      }
      case 'composite.invoke':
        state = invokeComposite(state, operation, frame);
        break;
      case 'end':
        state = { ...state, completed: true, frames: [] };
        events.push({ kind: 'execution.completed', operationId: operation.id });
        break;
      default:
        assertNever(operation);
    }
  }
  if (!state.completed && state.frames.length === 0 && Object.keys(state.pending).length === 0) {
    state = { ...state, completed: true };
    events.push({
      kind: 'execution.completed',
      operationId: state.artifact.definition.root.id,
    });
  }
  return { state, events };
}

function executeParallel(
  state: EngineState,
  events: SemanticEvent[],
  operation: Extract<Operation, { kind: 'control.parallel' }>,
  frame: OperationFrame,
): EngineState {
  for (const branch of operation.branches) {
    if (branch.kind === 'present') {
      const message = evaluateFrame(branch.message, state, frame);
      if (typeof message !== 'string')
        throw new EngineError('INVALID_VALUE', 'Presentation message must be a string.');
      events.push({
        kind: 'presentation.emitted',
        operationId: branch.id,
        message,
        privacy: branch.privacy,
        audience: resolveAudience(branch.audience, state, frame.locals, frame.scopeId),
      });
    } else if (branch.kind === 'input.wait') {
      const participantId = evaluateFrame(branch.participant, state, frame);
      if (
        typeof participantId !== 'string' ||
        !state.participants.some((item) => item.id === participantId)
      )
        throw new EngineError(
          'UNKNOWN_PARTICIPANT',
          'Parallel input target is not a session participant.',
        );
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
            ...(frame.scopeId ? { scopeId: frame.scopeId } : {}),
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
      const dueAt = checkedDueAt(state.logicalTime, branch.durationMs);
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
  return state;
}

function invokeComposite(
  state: EngineState,
  operation: Extract<Operation, { kind: 'composite.invoke' }>,
  frame: OperationFrame,
): EngineState {
  const composite = state.artifact.definition.composites.find(
    (item) => item.id === operation.compositeId,
  );
  if (!composite)
    throw new EngineError('UNKNOWN_COMPOSITE', `Unknown composite '${operation.compositeId}'.`);
  const scopeId = `composite-${state.nextScopeId}`;
  const values: Record<string, Value> = {};
  for (const input of composite.inputs)
    values[input.name] = evaluateFrame(operation.arguments[input.name]!, state, frame);
  return {
    ...state,
    nextScopeId: state.nextScopeId + 1,
    scopes: {
      ...state.scopes,
      [scopeId]: {
        values,
        outputNames: composite.outputs.map((output) => output.name),
        assignedOutputNames: [],
      },
    },
    frames: [
      ...state.frames,
      {
        kind: 'composite.return',
        scopeId,
        ...(frame.scopeId ? { callerScopeId: frame.scopeId } : {}),
        outputs: composite.outputs.map((output) => ({
          port: output.name,
          target: operation.outputs[output.name]!,
        })),
      },
      operationFrame(composite.implementation, {}, scopeId),
    ],
  };
}

function returnFromComposite(
  state: EngineState,
  frame: Extract<EngineState['frames'][number], { kind: 'composite.return' }>,
): EngineState {
  const scope = state.scopes[frame.scopeId];
  if (!scope) throw new EngineError('UNKNOWN_SCOPE', `Unknown composite scope '${frame.scopeId}'.`);
  let next = state;
  for (const { port, target } of frame.outputs) {
    if (!scope.assignedOutputNames.includes(port))
      throw new EngineError(
        'UNASSIGNED_COMPOSITE_OUTPUT',
        `Composite output '${port}' was not assigned before return.`,
      );
    next = setVariable(next, target, scope.values[port]!, frame.callerScopeId);
  }
  const { [frame.scopeId]: ignored, ...scopes } = next.scopes;
  void ignored;
  return { ...next, scopes };
}

function pushFrames(
  state: EngineState,
  operations: readonly Operation[],
  frame: OperationFrame,
): EngineState {
  return {
    ...state,
    frames: [
      ...state.frames,
      ...operations
        .map((operation) => operationFrame(operation, frame.locals, frame.scopeId))
        .reverse(),
    ],
  };
}

function operationFrame(
  operation: Operation,
  locals: Readonly<Record<string, Value>>,
  scopeId?: string,
): OperationFrame {
  return { kind: 'operation', operation, locals, ...(scopeId ? { scopeId } : {}) };
}

function evaluateFrame(
  expression: Parameters<typeof evaluate>[0],
  state: EngineState,
  frame: OperationFrame,
): Value {
  return evaluate(expression, state, frame.locals, frame.scopeId);
}

function checkedDueAt(logicalTime: number, durationMs: number): number {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0)
    throw new EngineError('INVALID_TIME', 'Timer duration must be a positive safe integer.');
  if (
    !Number.isSafeInteger(logicalTime) ||
    logicalTime < 0 ||
    logicalTime > Number.MAX_SAFE_INTEGER - durationMs
  )
    throw new EngineError('TIME_OVERFLOW', 'Timer due time exceeds the safe integer domain.');
  return logicalTime + durationMs;
}

function assertNever(value: never): never {
  throw new EngineError('INVALID_ARTIFACT', `Unhandled operation: ${JSON.stringify(value)}`);
}
