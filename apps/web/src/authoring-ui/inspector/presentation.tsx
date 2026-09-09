import type { OperationReference } from '@traquenard/authoring-domain';
import type { TypeRef } from '@traquenard/game-ir';
import { displayName, expressionLabel } from '../document.js';

export function ReadOnlyOutput(props: { readonly label: string; readonly value: string }) {
  return (
    <>
      <Property label={props.label} value={props.value} />
      <p className="authoring-ui-note">
        Output identity is read-only to prevent dangling references.
      </p>
    </>
  );
}

export function Property(props: { readonly label: string; readonly value: string }) {
  return (
    <dl className="authoring-ui-property">
      <dt>{props.label}</dt>
      <dd>{displayName(props.value)}</dd>
    </dl>
  );
}

export function typeLabel(type: TypeRef): string {
  return type.kind === 'collection'
    ? `Collection<${typeLabel(type.element)}>`
    : displayName(type.kind);
}

export function referenceValue(reference: OperationReference): string {
  return reference.expression.kind === 'variable'
    ? reference.expression.name
    : reference.expression.kind === 'participants'
      ? 'Players'
      : expressionLabel(reference.expression);
}
