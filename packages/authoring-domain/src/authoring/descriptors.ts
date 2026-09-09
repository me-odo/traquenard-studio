import type { Operation } from '@traquenard/game-ir';
import type {
  AuthoringPolicy,
  OperationDescriptor,
  OperationKind,
  RendererPolicy,
} from './types.js';

export const operationDescriptors = {
  sequence: descriptor(
    'sequence',
    'Sequence',
    'Orders steps.',
    'Internal',
    'structural',
    'internal',
  ),
  set: descriptor(
    'set',
    'Set value',
    'Assign a compatible value to authored state.',
    'Data',
    'insertable',
    'ordinary',
    ['target', 'value'],
    [],
    ['value'],
  ),
  'random.select': descriptor(
    'random.select',
    'Pick random item',
    'Select one item from a collection using engine randomness.',
    'Data',
    'insertable',
    'ordinary',
    ['from'],
    ['result'],
    ['from'],
  ),
  present: descriptor(
    'present',
    'Show message',
    'Show a message to an audience.',
    'Message',
    'insertable',
    'ordinary',
    ['message', 'audience'],
    [],
    ['message', 'audience'],
  ),
  'input.wait': descriptor(
    'input.wait',
    'Ask for choice',
    'Ask one participant to choose an option.',
    'Input',
    'insertable',
    'ordinary',
    ['participant', 'prompt', 'options'],
    ['result'],
    ['participant'],
  ),
  'control.if': descriptor(
    'control.if',
    'If',
    'Run THEN or ELSE based on a boolean condition.',
    'Control',
    'insertable',
    'structured',
    ['condition'],
    [],
    ['condition'],
  ),
  'control.foreach': descriptor(
    'control.foreach',
    'For each',
    'Run a body once for every item in a collection.',
    'Control',
    'insertable',
    'structured',
    ['collection'],
    ['current item'],
    ['collection'],
  ),
  'control.parallel': descriptor(
    'control.parallel',
    'Parallel',
    'Run the current restricted branch kinds together and wait for all.',
    'Control',
    'restricted',
    'parallel',
    ['branches'],
    [],
    [],
  ),
  'time.wait': descriptor(
    'time.wait',
    'Wait',
    'Wait using logical time.',
    'Control',
    'insertable',
    'ordinary',
    ['duration'],
  ),
  'collection.shuffle': descriptor(
    'collection.shuffle',
    'Shuffle collection',
    'Create a shuffled collection using engine randomness.',
    'Data',
    'insertable',
    'ordinary',
    ['collection'],
    ['result'],
    ['collection'],
  ),
  'collection.draw': descriptor(
    'collection.draw',
    'Draw item',
    'Remove and return the first item from a collection variable.',
    'Data',
    'insertable',
    'ordinary',
    ['collection'],
    ['result'],
    ['collection'],
  ),
  'composite.invoke': descriptor(
    'composite.invoke',
    'Run workflow',
    'Invoke a named reusable Workflow with typed bindings.',
    'Workflow',
    'insertable',
    'ordinary',
    ['arguments'],
    ['bindings'],
    ['arguments'],
  ),
  end: descriptor('end', 'End game', 'Complete the game session.', 'Control'),
} satisfies Record<OperationKind, OperationDescriptor>;

export const insertableOperationKinds = Object.values(operationDescriptors)
  .filter((item) => item.policy === 'insertable' || item.policy === 'restricted')
  .map((item) => item.kind);

export function operationDescriptor(kind: OperationKind): OperationDescriptor {
  return operationDescriptors[kind];
}

export function operationLabel(operation: Operation): string {
  return operationDescriptor(operation.kind).label;
}

function descriptor(
  kind: OperationKind,
  label: string,
  explanation: string,
  category: OperationDescriptor['category'],
  policy: AuthoringPolicy = 'insertable',
  renderer: RendererPolicy = 'ordinary',
  inputs: readonly string[] = [],
  outputs: readonly string[] = [],
  references: readonly string[] = [],
): OperationDescriptor {
  return {
    kind,
    label,
    explanation,
    category,
    policy,
    renderer,
    inspector: policy === 'structural' ? 'internal' : 'editable',
    inputs,
    outputs,
    references,
    structural: renderer === 'structured' || renderer === 'parallel' || renderer === 'internal',
    ...(policy === 'restricted'
      ? { unavailableReason: 'IR v1 permits only independent message, input, or wait branches.' }
      : {}),
  };
}
