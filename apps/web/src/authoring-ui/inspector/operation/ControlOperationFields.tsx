import { changeForeachCollection, renameForeachBindingSafely } from '@traquenard/authoring-domain';
import type { Operation } from '@traquenard/game-ir';
import { setWaitDuration } from '../../document.js';
import { ConditionField } from '../../fields/ConditionField.js';
import { ValueSourceField } from '../../fields/ValueSourceField.js';
import { Property } from '../presentation.js';
import type { InspectorProps } from '../types.js';

export function ControlOperationFields(props: InspectorProps & { readonly operation: Operation }) {
  const { operation } = props;
  if (operation.kind === 'time.wait')
    return (
      <label>
        Duration{' '}
        <span className="authoring-ui-input-unit">
          <input
            aria-label="Duration"
            type="number"
            min="0.001"
            step="0.1"
            value={operation.durationMs / 1000}
            onChange={(event) =>
              props.run(
                (definition) =>
                  setWaitDuration(definition, operation.id, Number(event.target.value)),
                'Wait duration changed.',
              )
            }
          />{' '}
          seconds
        </span>
      </label>
    );
  if (operation.kind === 'control.foreach')
    return (
      <>
        <ValueSourceField
          definition={props.definition}
          operationId={operation.id}
          label="Collection"
          value={operation.collection}
          expectCollection
          onChange={(expression) =>
            props.run(
              (definition) => changeForeachCollection(definition, operation.id, expression),
              'For each collection changed.',
            )
          }
        />
        <label>
          Current item
          <input
            aria-label="Current item"
            value={operation.itemVariable}
            onChange={(event) =>
              props.run(
                (definition) =>
                  renameForeachBindingSafely(definition, operation.id, event.target.value),
                'Current item renamed and body references migrated.',
              )
            }
          />
        </label>
        <p className="authoring-ui-note">
          The item type follows the selected collection. Renaming migrates references inside this
          body atomically.
        </p>
      </>
    );
  if (operation.kind === 'control.if')
    return <ConditionField definition={props.definition} operation={operation} run={props.run} />;
  if (operation.kind === 'control.parallel')
    return (
      <>
        <Property label="Join" value="All branches" />
        <p className="authoring-ui-note">
          IR v1 restricts branches to independent Show message, Ask for choice, or Wait operations.
          Projection remains under Issue #1 review.
        </p>
      </>
    );
  if (operation.kind === 'end') return <p>This terminal step has no editable properties.</p>;
  if (operation.kind === 'sequence')
    return <p>This structural sequence is edited through its insertion boundaries.</p>;
  return null;
}
