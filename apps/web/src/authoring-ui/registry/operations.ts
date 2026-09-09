import {
  authoredStateDeclarations,
  availableValuesAt,
  insertableOperationKinds,
  operationDescriptors,
  referenceCompatibility,
  type OperationKind,
  type SemanticLocation,
} from '@traquenard/authoring-domain';
import {
  literal,
  t,
  variable,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
  type Value,
  type VariableDeclaration,
} from '@traquenard/game-ir';

export type InsertableOperationKind = Exclude<OperationKind, 'sequence'>;

export const operationCatalog = insertableOperationKinds.map(
  (kind) => operationDescriptors[kind as InsertableOperationKind],
);

export function createOperationForSlot(
  definition: GameDefinition,
  location: SemanticLocation,
  kind: InsertableOperationKind,
  id: string,
): { readonly operation: Operation; readonly variables: readonly VariableDeclaration[] } {
  const values = availableValuesAt(definition, location);
  const collections = values.filter((item) => item.type.kind === 'collection');
  const collection = collections[0];
  const participant = values.find((item) => item.type.kind === 'participant');
  const state = authoredStateDeclarations(definition)[0];
  const workflow = definition.composites[0];
  let operation: Operation;
  let output: { readonly name: string; readonly type: TypeRef } | undefined;
  switch (kind) {
    case 'set': {
      const target = state ?? { name: 'score', type: t.number, initial: 0 };
      operation = {
        id,
        kind,
        variable: target.name,
        value: literal(defaultLiteral(target.type), target.type),
      };
      return {
        operation,
        variables: state
          ? definition.variables
          : [
              ...definition.variables,
              { name: target.name, type: target.type, initial: target.initial },
            ],
      };
    }
    case 'random.select': {
      const source = collection
        ? collection.id === 'runtime.players'
          ? ({ kind: 'participants' } as const)
          : variable(collection.id)
        : ({ kind: 'participants' } as const);
      const type = collection?.type.kind === 'collection' ? collection.type.element : t.participant;
      output = { name: `${id}Result`, type };
      operation = { id, kind, from: source, output: output.name };
      break;
    }
    case 'present':
      operation = {
        id,
        kind,
        audience: { kind: 'everyone' },
        message: literal('New message', t.string),
        privacy: 'public',
      };
      break;
    case 'input.wait':
      output = { name: `${id}Answer`, type: t.string };
      operation = {
        id,
        kind,
        participant: participant ? variable(participant.id) : literal('participant', t.participant),
        prompt: 'Choose one',
        options: ['Yes', 'No'],
        output: output.name,
      };
      break;
    case 'control.if':
      operation = {
        id,
        kind,
        condition: {
          kind: 'equals',
          left: literal(true, t.boolean),
          right: literal(true, t.boolean),
        },
        then: { id: `${id}-then`, kind: 'sequence', steps: [] },
        else: { id: `${id}-else`, kind: 'sequence', steps: [] },
      };
      break;
    case 'control.foreach':
      operation = {
        id,
        kind,
        collection: collection
          ? collection.id === 'runtime.players'
            ? { kind: 'participants' }
            : variable(collection.id)
          : { kind: 'participants' },
        itemVariable: `${id}Item`,
        body: { id: `${id}-body`, kind: 'sequence', steps: [] },
      };
      break;
    case 'control.parallel':
      operation = {
        id,
        kind,
        join: 'all',
        branches: [{ id: `${id}-wait`, kind: 'time.wait', durationMs: 1000 }],
      };
      break;
    case 'time.wait':
      operation = { id, kind, durationMs: 1000 };
      break;
    case 'collection.shuffle': {
      const source = collection
        ? collection.id === 'runtime.players'
          ? ({ kind: 'participants' } as const)
          : variable(collection.id)
        : ({ kind: 'participants' } as const);
      output = {
        name: `${id}Collection`,
        type:
          collection?.type.kind === 'collection' ? collection.type : t.collection(t.participant),
      };
      operation = { id, kind, collection: source, output: output.name };
      break;
    }
    case 'collection.draw': {
      const variableCollection = collections.find((item) => item.source.kind !== 'runtime');
      const name = variableCollection?.id ?? 'questionsDeck';
      const type =
        variableCollection?.type.kind === 'collection' ? variableCollection.type.element : t.card;
      output = { name: `${id}Item`, type };
      operation = { id, kind, collectionVariable: name, output: output.name };
      break;
    }
    case 'composite.invoke': {
      const args = Object.fromEntries(
        (workflow?.inputs ?? []).map((port) => {
          const candidate = referenceCompatibility(values, port.type).find(
            (item) => item.compatible,
          )?.reference;
          return [
            port.name,
            candidate ? variable(candidate.id) : literal(defaultLiteral(port.type), port.type),
          ];
        }),
      ) as Readonly<Record<string, Expression>>;
      const outputs = Object.fromEntries(
        (workflow?.outputs ?? []).map((port) => [port.name, `${id}${titleCase(port.name)}`]),
      );
      operation = {
        id,
        kind,
        compositeId: workflow?.id ?? 'choose-workflow',
        arguments: args,
        outputs,
      };
      const additions = (workflow?.outputs ?? []).map((port) => ({
        name: outputs[port.name]!,
        type: port.type,
      }));
      return { operation, variables: addDeclarations(definition.variables, additions) };
    }
    case 'end':
      operation = { id, kind };
      break;
  }
  return {
    operation,
    variables: output ? addDeclarations(definition.variables, [output]) : definition.variables,
  };
}

function addDeclarations(
  variables: readonly VariableDeclaration[],
  additions: readonly { readonly name: string; readonly type: TypeRef }[],
): readonly VariableDeclaration[] {
  const result = [...variables];
  for (const item of additions)
    if (!result.some((existing) => existing.name === item.name)) result.push(item);
  return result;
}

function defaultLiteral(type: TypeRef): Value {
  switch (type.kind) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'participant':
      return 'participant';
    case 'card':
      return { id: 'card', suit: '', rank: '' };
    case 'collection':
      return [];
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
