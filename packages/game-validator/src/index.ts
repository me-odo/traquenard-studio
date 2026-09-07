import {
  valueConformsToType,
  type Audience,
  type CompositeDefinition,
  type Expression,
  type GameArtifact,
  type GameDefinition,
  type Operation,
  type TypeRef,
  type Value,
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

interface SemanticScope {
  readonly variables: Map<string, TypeRef>;
  readonly allowsParticipantsContext: boolean;
}

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
    const items = value as readonly Value[];
    const first = items[0];
    if (first === undefined) return undefined;
    const element = typeOfValue(first);
    if (!element || items.some((item) => !valueConformsToType(item, element))) return undefined;
    return { kind: 'collection', element };
  }
  return primitive('card');
}

export function validateDefinition(definition: GameDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  const variables = new Map(
    definition.variables.map((declaration) => [declaration.name, declaration.type]),
  );
  const composites = new Map(definition.composites.map((composite) => [composite.id, composite]));
  const nodeIds = new Set<string>();

  if (definition.irVersion !== 1)
    issue('irVersion', 'unsupported_version', 'Only Game IR version 1 is supported.');
  if (variables.size !== definition.variables.length)
    issue('variables', 'duplicate_variable', 'Variable names must be unique.');
  if (composites.size !== definition.composites.length)
    issue('composites', 'duplicate_composite', 'Composite identifiers must be unique.');

  for (const [index, declaration] of definition.variables.entries()) {
    if (declaration.initial !== undefined) {
      if (!valueConformsToType(declaration.initial, declaration.type))
        issue(
          `variables.${index}.initial`,
          'type_mismatch',
          `Initial value does not match ${showType(declaration.type)}.`,
        );
    }
  }

  visit(definition.root, 'root', {
    variables,
    allowsParticipantsContext: true,
  });
  for (const [index, composite] of definition.composites.entries()) {
    validateCompositePorts(composite, index);
    const scope: SemanticScope = {
      variables: new Map(),
      allowsParticipantsContext: false,
    };
    for (const port of [...composite.inputs, ...composite.outputs])
      scope.variables.set(port.name, port.type);
    visit(composite.implementation, `composites.${index}.implementation`, scope);
  }
  return { valid: issues.length === 0, issues };

  function issue(path: string, code: string, message: string): void {
    issues.push({ path, code, message });
  }

  function expressionType(
    expression: Expression,
    path: string,
    scope: SemanticScope,
  ): TypeRef | undefined {
    switch (expression.kind) {
      case 'literal':
        if (!valueConformsToType(expression.value, expression.valueType)) {
          issue(
            path,
            'literal_value_type_mismatch',
            `Literal value does not conform to ${showType(expression.valueType)}.`,
          );
          return undefined;
        }
        return expression.valueType;
      case 'participants':
        if (!scope.allowsParticipantsContext) {
          issue(
            path,
            'implicit_composite_context',
            'Composite implementations must receive participants through a declared input.',
          );
          return undefined;
        }
        return { kind: 'collection', element: primitive('participant') };
      case 'variable': {
        const found = scope.variables.get(expression.name);
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
    scope: SemanticScope,
  ): void {
    const actual = expressionType(expression, path, scope);
    if (actual && !sameType(actual, expected))
      issue(path, 'type_mismatch', `Expected ${showType(expected)}, received ${showType(actual)}.`);
  }

  function requireOutput(
    name: string,
    expected: TypeRef | undefined,
    path: string,
    scope: SemanticScope,
  ): void {
    const target = scope.variables.get(name);
    if (!target) issue(path, 'unknown_output', `Output variable '${name}' is not declared.`);
    else if (expected && !sameType(target, expected))
      issue(path, 'output_type_mismatch', `Output '${name}' must be ${showType(expected)}.`);
  }

  function visit(operation: Operation, path: string, scope: SemanticScope): void {
    if (nodeIds.has(operation.id))
      issue(path, 'duplicate_node_id', `Operation id '${operation.id}' is duplicated.`);
    nodeIds.add(operation.id);
    switch (operation.kind) {
      case 'sequence':
        operation.steps.forEach((step, index) => visit(step, `${path}.steps.${index}`, scope));
        break;
      case 'set': {
        const target = scope.variables.get(operation.variable);
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
        const child = cloneScope(scope);
        if (source?.kind === 'collection')
          child.variables.set(operation.itemVariable, source.element);
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
          visit(branch, `${path}.branches.${index}`, cloneScope(scope));
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
        const source = scope.variables.get(operation.collectionVariable);
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
      case 'composite.invoke': {
        const composite = composites.get(operation.compositeId);
        if (!composite) {
          issue(
            `${path}.compositeId`,
            'unknown_composite',
            `Composite '${operation.compositeId}' is not defined.`,
          );
          break;
        }
        validateBindings(
          composite.inputs,
          operation.arguments,
          `${path}.arguments`,
          (name, type, bindingPath) =>
            requireType(operation.arguments[name]!, type, bindingPath, scope),
        );
        validateBindings(
          composite.outputs,
          operation.outputs,
          `${path}.outputs`,
          (name, type, bindingPath) =>
            requireOutput(operation.outputs[name]!, type, bindingPath, scope),
        );
        break;
      }
      case 'end':
        break;
    }
  }

  function validateAudience(audience: Audience, path: string, scope: SemanticScope): void {
    if (audience.kind === 'participants')
      requireType(
        audience.ids,
        { kind: 'collection', element: primitive('participant') },
        `${path}.ids`,
        scope,
      );
  }

  function cloneScope(scope: SemanticScope): SemanticScope {
    return {
      variables: new Map(scope.variables),
      allowsParticipantsContext: scope.allowsParticipantsContext,
    };
  }

  function validateCompositePorts(composite: CompositeDefinition, index: number): void {
    const names = [...composite.inputs, ...composite.outputs].map((port) => port.name);
    if (new Set(names).size !== names.length)
      issue(
        `composites.${index}`,
        'duplicate_composite_port',
        `Composite '${composite.id}' port names must be unique.`,
      );
  }

  function validateBindings<T>(
    ports: readonly { readonly name: string; readonly type: TypeRef }[],
    bindings: Readonly<Record<string, T>>,
    path: string,
    validate: (name: string, type: TypeRef, path: string) => void,
  ): void {
    const expectedNames = new Set(ports.map((port) => port.name));
    for (const port of ports) {
      if (!(port.name in bindings))
        issue(
          `${path}.${port.name}`,
          'missing_composite_binding',
          `Missing binding '${port.name}'.`,
        );
      else validate(port.name, port.type, `${path}.${port.name}`);
    }
    for (const name of Object.keys(bindings))
      if (!expectedNames.has(name))
        issue(`${path}.${name}`, 'unknown_composite_binding', `Unknown binding '${name}'.`);
  }
}

export function validateArtifact(artifact: GameArtifact): ValidationResult {
  return validateDefinition(artifact.definition);
}

function showType(type: TypeRef): string {
  return type.kind === 'collection' ? `Collection<${showType(type.element)}>` : type.kind;
}
