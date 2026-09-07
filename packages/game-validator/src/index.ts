import type {
  Audience,
  Expression,
  GameArtifact,
  GameDefinition,
  Operation,
  TypeRef,
  Value,
} from '@traquenard/game-ir';

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

const primitive = (kind: 'string' | 'number' | 'boolean' | 'participant' | 'card'): TypeRef => ({
  kind,
});

export function sameType(left: TypeRef, right: TypeRef): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== 'collection' ||
      (right.kind === 'collection' && sameType(left.element, right.element)))
  );
}

export function typeOfValue(value: Value): TypeRef | undefined {
  if (typeof value === 'string') return primitive('string');
  if (typeof value === 'number') return primitive('number');
  if (typeof value === 'boolean') return primitive('boolean');
  if (Array.isArray(value)) {
    const first = (value as readonly Value[])[0];
    return first === undefined
      ? undefined
      : { kind: 'collection', element: typeOfValue(first) ?? primitive('string') };
  }
  return primitive('card');
}

export function validateDefinition(definition: GameDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  const variables = new Map(
    definition.variables.map((declaration) => [declaration.name, declaration.type]),
  );
  const compositeIds = new Set(definition.composites.map((composite) => composite.id));
  const nodeIds = new Set<string>();

  if (definition.irVersion !== 1)
    issue('irVersion', 'unsupported_version', 'Only Game IR version 1 is supported.');
  if (variables.size !== definition.variables.length)
    issue('variables', 'duplicate_variable', 'Variable names must be unique.');
  if (compositeIds.size !== definition.composites.length)
    issue('composites', 'duplicate_composite', 'Composite identifiers must be unique.');

  for (const [index, declaration] of definition.variables.entries()) {
    if (declaration.initial !== undefined) {
      const actual = typeOfValue(declaration.initial);
      if (actual && !sameType(declaration.type, actual))
        issue(
          `variables.${index}.initial`,
          'type_mismatch',
          `Initial value does not match ${showType(declaration.type)}.`,
        );
    }
  }

  visit(definition.root, 'root', variables);
  for (const [index, composite] of definition.composites.entries())
    visit(composite.implementation, `composites.${index}.implementation`, new Map(variables));
  return { valid: issues.length === 0, issues };

  function issue(path: string, code: string, message: string): void {
    issues.push({ path, code, message });
  }

  function expressionType(
    expression: Expression,
    path: string,
    scope: Map<string, TypeRef>,
  ): TypeRef | undefined {
    switch (expression.kind) {
      case 'literal':
        return expression.valueType;
      case 'participants':
        return { kind: 'collection', element: primitive('participant') };
      case 'variable': {
        const found = scope.get(expression.name);
        if (!found)
          issue(
            path,
            'unknown_variable',
            `Variable '${expression.name}' is not declared in this scope.`,
          );
        return found;
      }
      case 'equals': {
        const left = expressionType(expression.left, `${path}.left`, scope);
        const right = expressionType(expression.right, `${path}.right`, scope);
        if (left && right && !sameType(left, right))
          issue(path, 'comparison_type_mismatch', 'Equality operands must have the same type.');
        return primitive('boolean');
      }
    }
  }

  function requireType(
    expression: Expression,
    expected: TypeRef,
    path: string,
    scope: Map<string, TypeRef>,
  ): void {
    const actual = expressionType(expression, path, scope);
    if (actual && !sameType(actual, expected))
      issue(path, 'type_mismatch', `Expected ${showType(expected)}, received ${showType(actual)}.`);
  }

  function requireOutput(
    name: string,
    expected: TypeRef | undefined,
    path: string,
    scope: Map<string, TypeRef>,
  ): void {
    const target = scope.get(name);
    if (!target) issue(path, 'unknown_output', `Output variable '${name}' is not declared.`);
    else if (expected && !sameType(target, expected))
      issue(path, 'output_type_mismatch', `Output '${name}' must be ${showType(expected)}.`);
  }

  function visit(operation: Operation, path: string, scope: Map<string, TypeRef>): void {
    if (nodeIds.has(operation.id))
      issue(path, 'duplicate_node_id', `Operation id '${operation.id}' is duplicated.`);
    nodeIds.add(operation.id);
    switch (operation.kind) {
      case 'sequence':
        operation.steps.forEach((step, index) => visit(step, `${path}.steps.${index}`, scope));
        break;
      case 'set': {
        const target = scope.get(operation.variable);
        if (!target)
          issue(
            `${path}.variable`,
            'unknown_variable',
            `Variable '${operation.variable}' is not declared.`,
          );
        else requireType(operation.value, target, `${path}.value`, scope);
        break;
      }
      case 'random.select': {
        const source = expressionType(operation.from, `${path}.from`, scope);
        if (!source || source.kind !== 'collection')
          issue(`${path}.from`, 'not_collection', 'Random selection requires a collection.');
        requireOutput(
          operation.output,
          source?.kind === 'collection' ? source.element : undefined,
          `${path}.output`,
          scope,
        );
        break;
      }
      case 'present':
        requireType(operation.message, primitive('string'), `${path}.message`, scope);
        validateAudience(operation.audience, `${path}.audience`, scope);
        break;
      case 'input.wait':
        requireType(operation.participant, primitive('participant'), `${path}.participant`, scope);
        requireOutput(operation.output, primitive('string'), `${path}.output`, scope);
        if (new Set(operation.options).size !== operation.options.length)
          issue(`${path}.options`, 'duplicate_option', 'Input options must be unique.');
        break;
      case 'control.if':
        requireType(operation.condition, primitive('boolean'), `${path}.condition`, scope);
        visit(operation.then, `${path}.then`, scope);
        if (operation.else) visit(operation.else, `${path}.else`, scope);
        break;
      case 'control.foreach': {
        const source = expressionType(operation.collection, `${path}.collection`, scope);
        if (!source || source.kind !== 'collection')
          issue(`${path}.collection`, 'not_collection', 'Iteration requires a collection.');
        const child = new Map(scope);
        if (source?.kind === 'collection') child.set(operation.itemVariable, source.element);
        visit(operation.body, `${path}.body`, child);
        break;
      }
      case 'control.parallel':
        for (const [index, branch] of operation.branches.entries()) {
          if (!['input.wait', 'time.wait', 'present'].includes(branch.kind))
            issue(
              `${path}.branches.${index}`,
              'unsafe_parallel_v1',
              'IR v1 parallel branches must be independent input, timer, or presentation operations.',
            );
          visit(branch, `${path}.branches.${index}`, new Map(scope));
        }
        break;
      case 'time.wait':
        if (operation.durationMs <= 0)
          issue(`${path}.durationMs`, 'invalid_duration', 'Timer duration must be positive.');
        break;
      case 'collection.shuffle': {
        const source = expressionType(operation.collection, `${path}.collection`, scope);
        if (!source || source.kind !== 'collection')
          issue(`${path}.collection`, 'not_collection', 'Shuffle requires a collection.');
        requireOutput(operation.output, source, `${path}.output`, scope);
        break;
      }
      case 'collection.draw': {
        const source = scope.get(operation.collectionVariable);
        if (!source || source.kind !== 'collection')
          issue(
            `${path}.collectionVariable`,
            'not_collection',
            'Draw requires a collection variable.',
          );
        requireOutput(
          operation.output,
          source?.kind === 'collection' ? source.element : undefined,
          `${path}.output`,
          scope,
        );
        break;
      }
      case 'composite.invoke':
        if (!compositeIds.has(operation.compositeId))
          issue(
            `${path}.compositeId`,
            'unknown_composite',
            `Composite '${operation.compositeId}' is not defined.`,
          );
        break;
      case 'end':
        break;
    }
  }

  function validateAudience(audience: Audience, path: string, scope: Map<string, TypeRef>): void {
    if (audience.kind === 'participants')
      requireType(
        audience.ids,
        { kind: 'collection', element: primitive('participant') },
        `${path}.ids`,
        scope,
      );
  }
}

export function validateArtifact(artifact: GameArtifact): ValidationResult {
  return validateDefinition(artifact.definition);
}

function showType(type: TypeRef): string {
  return type.kind === 'collection' ? `Collection<${showType(type.element)}>` : type.kind;
}
