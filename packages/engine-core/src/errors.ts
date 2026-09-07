export type EngineErrorCode =
  | 'EMPTY_COLLECTION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IMPLICIT_COMPOSITE_CONTEXT'
  | 'INPUT_FORBIDDEN'
  | 'INPUT_NOT_PENDING'
  | 'INVALID_ARTIFACT'
  | 'INVALID_CHOICE'
  | 'INVALID_RANDOM_RANGE'
  | 'INVALID_SEMANTIC_SEED'
  | 'INVALID_TIME'
  | 'INVALID_VALUE'
  | 'RNG_COUNTER_EXHAUSTED'
  | 'SESSION_COMPLETED'
  | 'SESSION_PAUSED'
  | 'STEP_LIMIT'
  | 'TIME_OVERFLOW'
  | 'UNASSIGNED_COMPOSITE_OUTPUT'
  | 'UNKNOWN_COMPOSITE'
  | 'UNKNOWN_PARTICIPANT'
  | 'UNKNOWN_SCOPE'
  | 'UNKNOWN_VARIABLE'
  | 'UNSAFE_PARALLEL_BRANCH';

export class EngineError extends Error {
  public constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
  }
}
