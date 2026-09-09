import { deleteAuthoredData, updateAuthoredDataInitial } from '@traquenard/authoring-domain';
import type { Value, VariableDeclaration } from '@traquenard/game-ir';
import { displayName } from '../document.js';
import { Property, typeLabel } from './presentation.js';
import type { InspectorProps } from './types.js';

export function ResourceInspector(
  props: InspectorProps & { readonly variable: VariableDeclaration },
) {
  const { variable } = props;
  const collection = variable.type.kind === 'collection';
  const values = collectionValues(variable.initial);
  return (
    <section aria-label={`${displayName(variable.name)} details`}>
      <span className="authoring-ui-badge">AUTHORED DATA · EDITABLE</span>
      <h3>{displayName(variable.name)}</h3>
      <Property label="Type" value={typeLabel(variable.type)} />
      {!collection &&
        primitiveValue(variable.initial) &&
        (variable.type.kind === 'boolean' ? (
          <label>
            Initial value
            <select
              aria-label="Initial value"
              value={String(variable.initial)}
              onChange={(event) =>
                props.run(
                  (definition) =>
                    updateAuthoredDataInitial(
                      definition,
                      variable.name,
                      event.target.value === 'true',
                    ),
                  'State initial value changed.',
                )
              }
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
        ) : (
          <label>
            Initial value
            <input
              aria-label="Initial value"
              type={variable.type.kind === 'number' ? 'number' : 'text'}
              value={String(variable.initial)}
              onChange={(event) =>
                props.run(
                  (definition) =>
                    updateAuthoredDataInitial(
                      definition,
                      variable.name,
                      variable.type.kind === 'number'
                        ? Number(event.target.value)
                        : event.target.value,
                    ),
                  'State initial value changed.',
                )
              }
            />
          </label>
        ))}
      {collection && (
        <div className="authoring-ui-collection-editor" aria-label="Collection items">
          <Property label="Items" value={String(values.length)} />
          {values.map((item, index) => (
            <label key={collectionKey(item, index)}>
              Item {index + 1}
              <input
                aria-label={`Collection item ${index + 1}`}
                value={collectionLabel(item)}
                onChange={(event) =>
                  props.run(
                    (definition) =>
                      updateAuthoredDataInitial(
                        definition,
                        variable.name,
                        values.map((value, itemIndex) =>
                          itemIndex === index && isCard(value)
                            ? { ...value, rank: event.target.value }
                            : value,
                        ),
                      ),
                    'Collection item changed.',
                  )
                }
              />
            </label>
          ))}
          <button
            className="authoring-ui-primary"
            onClick={() =>
              props.run(
                (definition) =>
                  updateAuthoredDataInitial(definition, variable.name, [
                    ...values,
                    {
                      id: `${variable.name}-${values.length + 1}`,
                      suit: 'authored',
                      rank: 'New card',
                    },
                  ]),
                'Collection item added.',
              )
            }
          >
            Add collection item
          </button>
        </div>
      )}
      <button
        className="authoring-ui-danger"
        onClick={() => {
          props.run(
            (definition) => deleteAuthoredData(definition, variable.name),
            `${displayName(variable.name)} deleted. References were preserved for diagnostics.`,
          );
          props.onDeleted();
        }}
      >
        Delete Data
      </button>
    </section>
  );
}

function primitiveValue(value: Value | undefined): value is string | number | boolean {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function collectionValues(value: Value | undefined): readonly Value[] {
  return Array.isArray(value) ? (value as readonly Value[]) : [];
}

function isCard(
  value: Value,
): value is { readonly id: string; readonly suit: string; readonly rank: string } {
  return typeof value === 'object' && !Array.isArray(value) && value !== null && 'id' in value;
}

function collectionLabel(value: Value): string {
  return isCard(value)
    ? value.rank
    : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
}

function collectionKey(value: Value, index: number): string {
  return isCard(value) ? value.id : String(index);
}
