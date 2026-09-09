import {
  collectionCandidatesForOperation,
  valueCandidatesForOperation,
  type AuthoringCandidate,
} from '@traquenard/authoring-domain';
import {
  literal,
  variable,
  type Expression,
  type GameDefinition,
  type TypeRef,
  type Value,
} from '@traquenard/game-ir';
import { displayName, expressionLabel } from '../document.js';

export function ValueSourceField(props: {
  readonly definition: GameDefinition;
  readonly operationId: string;
  readonly label: string;
  readonly value: Expression;
  readonly expectedType?: TypeRef;
  readonly expectCollection?: boolean;
  readonly allowLiteral?: boolean;
  readonly allowRuntime?: boolean;
  readonly onChange: (expression: Expression) => void;
}) {
  const candidates = (
    props.expectCollection
      ? collectionCandidatesForOperation(props.definition, props.operationId)
      : props.expectedType
        ? valueCandidatesForOperation(props.definition, props.operationId, props.expectedType)
        : []
  ).filter((candidate) => props.allowRuntime !== false || candidate.value.family !== 'runtime');
  const selected = expressionChoice(props.value);
  const compatible = candidates.filter((item) => item.compatible);
  const incompatible = candidates.filter((item) => !item.compatible);
  const literalType =
    props.expectedType ?? (props.value.kind === 'literal' ? props.value.valueType : undefined);
  return (
    <fieldset className="authoring-ui-value-field">
      <legend>{props.label}</legend>
      <select
        aria-label={`${props.label} source`}
        value={props.value.kind === 'literal' ? '__literal__' : selected}
        onChange={(event) => {
          if (event.target.value === '__literal__' && literalType) {
            props.onChange(literal(defaultLiteral(literalType), literalType));
            return;
          }
          const candidate = compatible.find((item) => item.value.id === event.target.value);
          if (!candidate) return;
          props.onChange(
            candidate.value.source.kind === 'runtime'
              ? { kind: 'participants' }
              : variable(candidate.value.id),
          );
        }}
      >
        {props.allowLiteral && literalType && supportsLiteral(literalType) && (
          <option value="__literal__">Literal value</option>
        )}
        <optgroup label="Available in this scope">
          {compatible.map((candidate) => (
            <option key={candidate.value.id} value={candidate.value.id}>
              {candidate.value.label} · {familyLabel(candidate)}
            </option>
          ))}
        </optgroup>
        {incompatible.length > 0 && (
          <optgroup label="Unavailable — incompatible type">
            {incompatible.map((candidate) => (
              <option key={candidate.value.id} value={candidate.value.id} disabled>
                {candidate.value.label} — {candidate.reason}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {props.value.kind === 'literal' && supportsLiteral(props.value.valueType) && (
        <LiteralField
          label={`${props.label} literal`}
          expression={props.value}
          onChange={props.onChange}
        />
      )}
      <small>
        {props.value.kind === 'literal'
          ? `${displayName(props.value.valueType.kind)} literal · ${expressionLabel(props.value)}`
          : 'Candidates are filtered by semantic scope and type.'}
      </small>
    </fieldset>
  );
}

function LiteralField(props: {
  readonly label: string;
  readonly expression: Extract<Expression, { readonly kind: 'literal' }>;
  readonly onChange: (expression: Expression) => void;
}) {
  const type = props.expression.valueType;
  if (type.kind === 'boolean')
    return (
      <select
        aria-label={props.label}
        value={literalText(props.expression.value)}
        onChange={(event) => props.onChange(literal(event.target.value === 'true', type))}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  return (
    <input
      aria-label={props.label}
      type={type.kind === 'number' ? 'number' : 'text'}
      value={literalText(props.expression.value)}
      onChange={(event) =>
        props.onChange(
          literal(type.kind === 'number' ? Number(event.target.value) : event.target.value, type),
        )
      }
    />
  );
}

function expressionChoice(expression: Expression): string {
  if (expression.kind === 'participants') return 'runtime.players';
  if (expression.kind === 'variable') return expression.name;
  return '__literal__';
}

function familyLabel(candidate: AuthoringCandidate): string {
  switch (candidate.value.family) {
    case 'runtime':
      return 'Runtime';
    case 'authored-data':
      return 'Authored Data';
    case 'flow-output':
      return 'Flow output';
    case 'workflow-input':
      return 'Workflow input';
  }
}

function supportsLiteral(type: TypeRef): boolean {
  return ['string', 'number', 'boolean', 'participant'].includes(type.kind);
}

function defaultLiteral(type: TypeRef): string | number | boolean {
  switch (type.kind) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

function literalText(value: Value): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}
