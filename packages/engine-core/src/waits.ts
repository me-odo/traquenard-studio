import { EngineError } from './errors.js';
import { setVariable } from './state.js';
import type { EngineState } from './types.js';

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
  return setVariable({ ...state, pending: remaining }, wait.output, choice, wait.scopeId);
}

export function advanceLogicalTime(state: EngineState, milliseconds: number): EngineState {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0)
    throw new EngineError(
      'INVALID_TIME',
      'Logical time delta must be a non-negative safe integer.',
    );
  if (
    !Number.isSafeInteger(state.logicalTime) ||
    state.logicalTime < 0 ||
    state.logicalTime > Number.MAX_SAFE_INTEGER - milliseconds
  )
    throw new EngineError('TIME_OVERFLOW', 'Logical time exceeds the safe integer domain.');
  const logicalTime = state.logicalTime + milliseconds;
  const pending = Object.fromEntries(
    Object.entries(state.pending).filter(
      ([, wait]) => wait.kind !== 'timer' || wait.dueAt > logicalTime,
    ),
  );
  return { ...state, logicalTime, pending };
}
