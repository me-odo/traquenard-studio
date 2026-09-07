import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { EngineError } from './errors.js';

export interface DeterministicRngState {
  readonly secret: string;
  readonly counter: number;
}

const UINT32_RANGE = 0x1_0000_0000;

export function createRngState(secret: string): DeterministicRngState {
  if (secret.length === 0)
    throw new EngineError('INVALID_SEMANTIC_SEED', 'Semantic RNG secret must not be empty.');
  return { secret, counter: 0 };
}

/**
 * Uses HMAC-SHA-256 as a deterministic counter-mode PRF. Rejection sampling removes
 * modulo bias; replay is exact for the same private secret and counter.
 */
export function randomIndex(
  state: DeterministicRngState,
  maxExclusive: number,
): { state: DeterministicRngState; index: number } {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE)
    throw new EngineError('INVALID_RANDOM_RANGE', 'Random index bound must be between 1 and 2^32.');

  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  let next = state;
  for (;;) {
    const generated = generateUint32(next);
    next = generated.state;
    if (generated.value < limit) return { state: next, index: generated.value % maxExclusive };
  }
}

function generateUint32(state: DeterministicRngState): {
  readonly state: DeterministicRngState;
  readonly value: number;
} {
  if (
    !Number.isSafeInteger(state.counter) ||
    state.counter < 0 ||
    state.counter >= Number.MAX_SAFE_INTEGER
  )
    throw new EngineError(
      'RNG_COUNTER_EXHAUSTED',
      'Semantic RNG counter exhausted its safe integer domain.',
    );
  const message = new Uint8Array(8);
  const high = Math.floor(state.counter / UINT32_RANGE);
  const low = state.counter % UINT32_RANGE;
  message[0] = high >>> 24;
  message[1] = high >>> 16;
  message[2] = high >>> 8;
  message[3] = high;
  message[4] = low >>> 24;
  message[5] = low >>> 16;
  message[6] = low >>> 8;
  message[7] = low;
  const digest = hmac(sha256, new TextEncoder().encode(state.secret), message);
  const value = digest[0]! * 0x1_000000 + digest[1]! * 0x1_0000 + digest[2]! * 0x100 + digest[3]!;
  return { state: { secret: state.secret, counter: state.counter + 1 }, value };
}
