import {
  authoredStateDeclarations,
  changeDrawSource,
  changeRandomSelectSource,
  changeShuffleSource,
  setStateValue,
} from '@traquenard/authoring-domain';
import {
  literal,
  t,
  variable,
  type Expression,
  type Operation,
  type TypeRef,
} from '@traquenard/game-ir';
import { displayName } from '../../document.js';
import { ValueSourceField } from '../../fields/ValueSourceField.js';
import { ReadOnlyOutput } from '../presentation.js';
import type { InspectorProps } from '../types.js';

export function DataOperationFields(props: InspectorProps & { readonly operation: Operation }) {
  const { operation } = props;
  const states = authoredStateDeclarations(props.definition);
  if (operation.kind === 'random.select')
    return (
      <>
        <ValueSourceField
          definition={props.definition}
          operationId={operation.id}
          label="From"
          value={operation.from}
          expectCollection
          onChange={(expression) =>
            props.run(
              (definition) => changeRandomSelectSource(definition, operation.id, expression),
              'Random source changed; result type followed the collection element type.',
            )
          }
        />
        <ReadOnlyOutput label="Result" value={operation.output} />
      </>
    );
  if (operation.kind === 'collection.shuffle')
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
              (definition) => changeShuffleSource(definition, operation.id, expression),
              'Shuffle source changed; result type followed the collection type.',
            )
          }
        />
        <ReadOnlyOutput label="Result" value={operation.output} />
      </>
    );
  if (operation.kind === 'collection.draw')
    return (
      <>
        <ValueSourceField
          definition={props.definition}
          operationId={operation.id}
          label="Collection"
          value={variable(operation.collectionVariable)}
          expectCollection
          allowRuntime={false}
          onChange={(expression) => {
            if (expression.kind === 'variable')
              props.run(
                (definition) => changeDrawSource(definition, operation.id, expression.name),
                'Draw collection changed; result type followed the collection element type.',
              );
          }}
        />
        <ReadOnlyOutput label="Result" value={operation.output} />
      </>
    );
  if (operation.kind === 'set' && states.length > 0)
    return (
      <>
        <label>
          State
          <select
            aria-label="State target"
            value={operation.variable}
            onChange={(event) =>
              props.run(
                (definition) =>
                  setStateValue(
                    definition,
                    operation.id,
                    event.target.value,
                    compatibleDefault(
                      states.find((item) => item.name === event.target.value)!.type,
                    ),
                  ),
                'State target changed.',
              )
            }
          >
            {states.map((item) => (
              <option key={item.name} value={item.name}>
                {displayName(item.name)} · {displayName(item.type.kind)}
              </option>
            ))}
          </select>
        </label>
        <ValueSourceField
          definition={props.definition}
          operationId={operation.id}
          label="Value"
          value={operation.value}
          expectedType={states.find((item) => item.name === operation.variable)?.type ?? t.number}
          allowLiteral
          onChange={(expression) =>
            props.run(
              (definition) =>
                setStateValue(definition, operation.id, operation.variable, expression),
              'State value changed.',
            )
          }
        />
      </>
    );
  return null;
}

function compatibleDefault(type: TypeRef): Expression {
  return literal(type.kind === 'number' ? 0 : type.kind === 'boolean' ? false : '', type);
}
