import type { Operation } from '@traquenard/game-ir';

export interface AxiomDescriptor<K extends Operation['kind'] = Operation['kind']> {
  readonly id: K;
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

export type AxiomRegistry = {
  readonly [K in Operation['kind']]: AxiomDescriptor<K>;
};

const descriptor = <K extends Operation['kind']>(
  id: K,
  responsibility: string,
  inputs: string[],
  outputs: string[],
  effects: string[],
  execution: string,
  errors: string[] = [],
): AxiomDescriptor<K> => ({
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

export const axiomRegistry = {
  sequence: descriptor(
    'sequence',
    'Order child operations.',
    ['steps'],
    [],
    ['control'],
    'Pushes children in declared order.',
  ),
  set: descriptor(
    'set',
    'Write a typed state variable.',
    ['variable', 'value'],
    [],
    ['state'],
    'Evaluates the expression and replaces the variable.',
    ['UNKNOWN_VARIABLE'],
  ),
  'random.select': descriptor(
    'random.select',
    'Select one collection member.',
    ['collection', 'RNG state'],
    ['value'],
    ['state', 'event'],
    'Advances a private HMAC-SHA-256 counter and uses rejection sampling.',
    ['EMPTY_COLLECTION'],
  ),
  present: descriptor(
    'present',
    'Emit audience-scoped presentation intent.',
    ['audience', 'message'],
    [],
    ['event'],
    'Resolves audience server-side and emits predetermined content.',
  ),
  'input.wait': descriptor(
    'input.wait',
    'Wait for a participant choice.',
    ['participant', 'prompt', 'options'],
    ['choice'],
    ['wait', 'event'],
    'Creates an idempotently addressable pending input.',
    ['UNKNOWN_PARTICIPANT'],
  ),
  'control.if': descriptor(
    'control.if',
    'Choose a branch.',
    ['boolean condition'],
    [],
    ['control'],
    'Evaluates one branch only.',
  ),
  'control.foreach': descriptor(
    'control.foreach',
    'Iterate a collection in stable order.',
    ['collection', 'item binding'],
    [],
    ['control'],
    'Expands frames without mutating the collection.',
  ),
  'control.parallel': descriptor(
    'control.parallel',
    'Start independent waits and join all.',
    ['branches'],
    [],
    ['control', 'wait'],
    'V1 accepts only independent wait/presentation branches.',
    ['UNSAFE_PARALLEL_BRANCH', 'UNKNOWN_PARTICIPANT'],
  ),
  'time.wait': descriptor(
    'time.wait',
    'Wait until logical time reaches a due point.',
    ['duration', 'logical time'],
    [],
    ['wait', 'event'],
    'Schedules against explicit safe-integer logical time and rejects overflow.',
    ['INVALID_TIME', 'TIME_OVERFLOW'],
  ),
  'collection.shuffle': descriptor(
    'collection.shuffle',
    'Deterministically permute a collection.',
    ['collection', 'RNG state'],
    ['collection'],
    ['state', 'event'],
    'Uses Fisher–Yates with private HMAC-SHA-256 counter-mode RNG.',
  ),
  'collection.draw': descriptor(
    'collection.draw',
    'Remove and return the first collection item.',
    ['collection variable'],
    ['item'],
    ['state', 'event'],
    'Reads index zero and persists the remainder.',
    ['EMPTY_COLLECTION'],
  ),
  'composite.invoke': descriptor(
    'composite.invoke',
    'Invoke an inspectable declarative subgraph through typed ports.',
    ['composite id', 'typed arguments'],
    ['typed bindings'],
    ['control'],
    'Creates a scope containing only declared ports, executes the pinned implementation, then copies declared outputs to the caller scope.',
    [
      'UNKNOWN_COMPOSITE',
      'UNKNOWN_VARIABLE',
      'IMPLICIT_COMPOSITE_CONTEXT',
      'UNASSIGNED_COMPOSITE_OUTPUT',
    ],
  ),
  end: descriptor(
    'end',
    'Mark semantic execution complete.',
    [],
    [],
    ['event'],
    'Clears frames and emits early/unconditional completion; normal root exhaustion also completes.',
  ),
} satisfies AxiomRegistry;

export const axiomDescriptors: readonly AxiomDescriptor[] = Object.values(axiomRegistry);
