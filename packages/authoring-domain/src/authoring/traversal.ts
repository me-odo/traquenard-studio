import {
  variable,
  type Audience,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
} from '@traquenard/game-ir';

export function findOperation(definition: GameDefinition, id: string): Operation | undefined {
  return allOperations(definition).find((item) => item.id === id);
}

export function updateDefinitionOperation(
  definition: GameDefinition,
  id: string,
  update: (operation: Operation) => Operation,
): GameDefinition {
  return {
    ...definition,
    root: updateOperation(definition.root, id, update),
    composites: definition.composites.map((workflow) => ({
      ...workflow,
      implementation: updateOperation(workflow.implementation, id, update),
    })),
  };
}

export function updateOperation(
  operation: Operation,
  id: string,
  update: (operation: Operation) => Operation,
): Operation {
  const childrenMapped: Operation = (() => {
    switch (operation.kind) {
      case 'sequence':
        return {
          ...operation,
          steps: operation.steps.map((item) => updateOperation(item, id, update)),
        };
      case 'control.foreach':
        return { ...operation, body: updateOperation(operation.body, id, update) };
      case 'control.if': {
        const otherwise = operation.else ? updateOperation(operation.else, id, update) : undefined;
        return {
          ...operation,
          then: updateOperation(operation.then, id, update),
          ...(otherwise ? { else: otherwise } : {}),
        };
      }
      case 'control.parallel':
        return {
          ...operation,
          branches: operation.branches.map((item) => updateOperation(item, id, update)),
        };
      default:
        return operation;
    }
  })();
  return childrenMapped.id === id ? update(childrenMapped) : childrenMapped;
}

export function removeOperation(operation: Operation, id: string): Operation {
  switch (operation.kind) {
    case 'sequence':
      return {
        ...operation,
        steps: operation.steps
          .filter((item) => item.id !== id)
          .map((item) => removeOperation(item, id)),
      };
    case 'control.foreach':
      return { ...operation, body: removeOperation(operation.body, id) };
    case 'control.if': {
      const otherwise = operation.else ? removeOperation(operation.else, id) : undefined;
      return {
        ...operation,
        then: removeOperation(operation.then, id),
        ...(otherwise ? { else: otherwise } : {}),
      };
    }
    case 'control.parallel':
      return {
        ...operation,
        branches: operation.branches
          .filter((item) => item.id !== id)
          .map((item) => removeOperation(item, id)),
      };
    default:
      return operation;
  }
}

export function rewriteOperationExpressions(
  operation: Operation,
  before: string,
  after: string,
): Operation {
  const rewrite = (expression: Expression): Expression => {
    if (expression.kind === 'variable')
      return expression.name === before ? variable(after) : expression;
    if (expression.kind === 'equals')
      return { ...expression, left: rewrite(expression.left), right: rewrite(expression.right) };
    return expression;
  };
  const rewriteAudience = (audience: Audience): Audience => {
    if (audience.kind === 'participant') return { ...audience, id: rewrite(audience.id) };
    if (audience.kind === 'participants') return { ...audience, ids: rewrite(audience.ids) };
    return audience;
  };
  return mapOperation(operation, (item) => {
    switch (item.kind) {
      case 'set':
        return { ...item, value: rewrite(item.value) };
      case 'random.select':
        return { ...item, from: rewrite(item.from) };
      case 'present':
        return {
          ...item,
          message: rewrite(item.message),
          audience: rewriteAudience(item.audience),
        };
      case 'input.wait':
        return { ...item, participant: rewrite(item.participant) };
      case 'control.if':
        return { ...item, condition: rewrite(item.condition) };
      case 'control.foreach':
        return item.itemVariable === before
          ? item
          : { ...item, collection: rewrite(item.collection) };
      case 'collection.shuffle':
        return { ...item, collection: rewrite(item.collection) };
      case 'collection.draw':
        return item.collectionVariable === before ? { ...item, collectionVariable: after } : item;
      case 'composite.invoke':
        return {
          ...item,
          arguments: Object.fromEntries(
            Object.entries(item.arguments).map(([key, value]) => [key, rewrite(value)]),
          ),
        };
      default:
        return item;
    }
  });
}

export function mapOperation(
  operation: Operation,
  update: (operation: Operation) => Operation,
): Operation {
  const mapped: Operation = (() => {
    switch (operation.kind) {
      case 'sequence':
        return { ...operation, steps: operation.steps.map((item) => mapOperation(item, update)) };
      case 'control.foreach':
        return { ...operation, body: mapOperation(operation.body, update) };
      case 'control.if': {
        const otherwise = operation.else ? mapOperation(operation.else, update) : undefined;
        return {
          ...operation,
          then: mapOperation(operation.then, update),
          ...(otherwise ? { else: otherwise } : {}),
        };
      }
      case 'control.parallel':
        return {
          ...operation,
          branches: operation.branches.map((item) => mapOperation(item, update)),
        };
      default:
        return operation;
    }
  })();
  return update(mapped);
}

export function updateVariableType(
  definition: GameDefinition,
  name: string,
  type: TypeRef,
): GameDefinition {
  return {
    ...definition,
    variables: definition.variables.map((item) =>
      item.name === name && item.initial === undefined ? { ...item, type } : item,
    ),
  };
}

export function operationInputNames(
  operation: Operation,
): readonly { name: string; field: string }[] {
  const result: { name: string; field: string }[] = [];
  const collect = (expression: Expression, field: string) => {
    if (expression.kind === 'variable') result.push({ name: expression.name, field });
    if (expression.kind === 'equals') {
      collect(expression.left, `${field}.left`);
      collect(expression.right, `${field}.right`);
    }
  };
  switch (operation.kind) {
    case 'set':
      collect(operation.value, 'value');
      break;
    case 'random.select':
      collect(operation.from, 'from');
      break;
    case 'present':
      collect(operation.message, 'message');
      if (operation.audience.kind === 'participant') collect(operation.audience.id, 'audience.id');
      if (operation.audience.kind === 'participants')
        collect(operation.audience.ids, 'audience.ids');
      break;
    case 'input.wait':
      collect(operation.participant, 'participant');
      break;
    case 'control.if':
      collect(operation.condition, 'condition');
      break;
    case 'control.foreach':
      collect(operation.collection, 'collection');
      break;
    case 'collection.shuffle':
      collect(operation.collection, 'collection');
      break;
    case 'collection.draw':
      result.push({ name: operation.collectionVariable, field: 'collectionVariable' });
      break;
    case 'composite.invoke':
      for (const [name, expression] of Object.entries(operation.arguments))
        collect(expression, `arguments.${name}`);
      break;
  }
  return result;
}

export function operationOutputNames(operation: Operation): readonly string[] {
  switch (operation.kind) {
    case 'set':
      return [operation.variable];
    case 'random.select':
    case 'input.wait':
    case 'collection.shuffle':
    case 'collection.draw':
      return [operation.output];
    case 'composite.invoke':
      return Object.values(operation.outputs);
    default:
      return [];
  }
}

export function allOperations(definition: GameDefinition): readonly Operation[] {
  return [
    ...flatten(definition.root),
    ...definition.composites.flatMap((workflow) => flatten(workflow.implementation)),
  ];
}

export function flatten(operation: Operation): readonly Operation[] {
  switch (operation.kind) {
    case 'sequence':
      return [operation, ...operation.steps.flatMap(flatten)];
    case 'control.foreach':
      return [operation, ...flatten(operation.body)];
    case 'control.if':
      return [
        operation,
        ...flatten(operation.then),
        ...(operation.else ? flatten(operation.else) : []),
      ];
    case 'control.parallel':
      return [operation, ...operation.branches.flatMap(flatten)];
    default:
      return [operation];
  }
}
