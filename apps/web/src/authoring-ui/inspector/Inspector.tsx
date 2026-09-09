import {
  authoredStateDeclarations,
  changeAudience,
  changeDrawSource,
  changeForeachCollection,
  changeInputParticipant,
  changePresentMessage,
  changeRandomSelectSource,
  changeShuffleSource,
  changeWorkflowArgument,
  deleteAuthoredData,
  deleteOperationCommand,
  deleteWorkflowCommand,
  operationLabel,
  operationReferences,
  renameForeachBindingSafely,
  renameWorkflowCommand,
  setConditionOperand,
  setStateValue,
  updateAuthoredDataInitial,
  type OperationReference,
} from '@traquenard/authoring-domain';
import {
  literal,
  t,
  variable,
  type CompositeDefinition,
  type Expression,
  type GameDefinition,
  type Operation,
  type TypeRef,
  type Value,
  type VariableDeclaration,
} from '@traquenard/game-ir';
import {
  displayName,
  expressionLabel,
  operationSummary,
  setInputOptions,
  setInputPrompt,
  setWaitDuration,
  updateOperation,
} from '../document.js';
import { AudienceField } from '../fields/AudienceField.js';
import { ConditionField } from '../fields/ConditionField.js';
import { ValueSourceField } from '../fields/ValueSourceField.js';
import type { RunCommand, Selection } from '../state/types.js';

export function Inspector(props: {
  readonly definition: GameDefinition;
  readonly selection: Selection;
  readonly operation?: Operation;
  readonly semanticNavigation: boolean;
  readonly run: RunCommand;
  readonly onOpenWorkflow: (id: string) => void;
  readonly onNavigateReference: (reference: OperationReference) => void;
  readonly onNavigateSource: (reference: OperationReference) => void;
  readonly onDeleted: () => void;
}) {
  if (props.selection.kind === 'runtime') return <RuntimeInspector />;
  if (props.selection.kind === 'resource') {
    const resourceId = props.selection.id;
    const variable = props.definition.variables.find((item) => item.name === resourceId);
    return variable ? (
      <ResourceInspector {...props} variable={variable} />
    ) : (
      <p>Resource deleted.</p>
    );
  }
  if (props.selection.kind === 'workflow') {
    const workflowId = props.selection.id;
    const workflow = props.definition.composites.find((item) => item.id === workflowId);
    return workflow ? (
      <WorkflowInspector {...props} workflow={workflow} />
    ) : (
      <p>Workflow deleted.</p>
    );
  }
  if (props.selection.kind === 'reference') {
    const referencePath = props.selection.path;
    const operation = props.operation;
    const reference = operationReferences(props.definition, operation ?? emptyOperation()).find(
      (item) => item.path === referencePath,
    );
    return operation && reference ? (
      <ReferenceInspector {...props} operation={operation} reference={reference} />
    ) : (
      <p>Reference is no longer available.</p>
    );
  }
  return props.operation ? (
    <OperationInspector {...props} operation={props.operation} />
  ) : (
    <p>Select a block, Data value, Workflow, or reference.</p>
  );
}

function OperationInspector(
  props: Parameters<typeof Inspector>[0] & { readonly operation: Operation },
) {
  const { operation } = props;
  const states = authoredStateDeclarations(props.definition);
  return (
    <section aria-label={`${operationLabel(operation)} properties`}>
      <span className="authoring-ui-eyebrow">SELECTED STEP</span>
      <h3>{operationLabel(operation)}</h3>
      <p>{operationSummary(operation, props.definition)}</p>
      {operation.kind === 'time.wait' && (
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
      )}
      {operation.kind === 'control.foreach' && (
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
      )}
      {operation.kind === 'control.if' && (
        <ConditionField definition={props.definition} operation={operation} run={props.run} />
      )}
      {operation.kind === 'random.select' && (
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
      )}
      {operation.kind === 'collection.shuffle' && (
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
      )}
      {operation.kind === 'collection.draw' && (
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
      )}
      {operation.kind === 'set' && states.length > 0 && (
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
      )}
      {operation.kind === 'present' && (
        <>
          <ValueSourceField
            definition={props.definition}
            operationId={operation.id}
            label="Message"
            value={operation.message}
            expectedType={t.string}
            allowLiteral
            onChange={(expression) =>
              props.run(
                (definition) => changePresentMessage(definition, operation.id, expression),
                'Message changed.',
              )
            }
          />
          <AudienceField definition={props.definition} operation={operation} run={props.run} />
          <label>
            Privacy
            <select
              aria-label="Message privacy"
              value={operation.privacy}
              onChange={(event) =>
                props.run(
                  (definition) =>
                    updateOperation(definition, operation.id, (item) =>
                      item.kind === 'present'
                        ? { ...item, privacy: event.target.value as 'public' | 'private' }
                        : item,
                    ),
                  'Message privacy changed.',
                )
              }
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </>
      )}
      {operation.kind === 'input.wait' && (
        <>
          <ValueSourceField
            definition={props.definition}
            operationId={operation.id}
            label="Participant"
            value={operation.participant}
            expectedType={t.participant}
            allowLiteral
            onChange={(expression) =>
              props.run(
                (definition) => changeInputParticipant(definition, operation.id, expression),
                'Participant changed.',
              )
            }
          />
          <label>
            Prompt
            <input
              aria-label="Input prompt"
              value={operation.prompt}
              onChange={(event) =>
                props.run(
                  (definition) => setInputPrompt(definition, operation.id, event.target.value),
                  'Prompt changed.',
                )
              }
            />
          </label>
          <label>
            Options
            <input
              aria-label="Input options"
              value={operation.options.join(', ')}
              onChange={(event) =>
                props.run(
                  (definition) =>
                    setInputOptions(definition, operation.id, uniqueOptions(event.target.value)),
                  'Choice options changed.',
                )
              }
            />
          </label>
          <ReadOnlyOutput label="Result" value={operation.output} />
          <p className="authoring-ui-note">
            Options remain unique. Result identity is read-only because changing it requires
            scope-wide output migration.
          </p>
        </>
      )}
      {operation.kind === 'composite.invoke' && (
        <InvocationInspector {...props} operation={operation} />
      )}
      {operation.kind === 'control.parallel' && (
        <>
          <Property label="Join" value="All branches" />
          <p className="authoring-ui-note">
            IR v1 restricts branches to independent Show message, Ask for choice, or Wait
            operations. Projection remains under Issue #1 review.
          </p>
        </>
      )}
      {operation.kind === 'end' && <p>This terminal step has no editable properties.</p>}
      {operation.kind === 'sequence' && (
        <p>This structural sequence is edited through its insertion boundaries.</p>
      )}
      {operationReferences(props.definition, operation).map((reference) => (
        <button
          key={reference.path}
          className="authoring-ui-reference-inspector"
          onClick={() => props.onNavigateReference(reference)}
        >
          <span>{reference.label}</span>
          <strong>{referenceValue(reference)}</strong>
          <small>Inspect typed reference</small>
        </button>
      ))}
      {operation.kind !== 'sequence' && (
        <button
          className="authoring-ui-danger"
          onClick={() => {
            props.run(
              (definition) => deleteOperationCommand(definition, operation.id),
              `${operationLabel(operation)} deleted. References were not silently repaired.`,
            );
            props.onDeleted();
          }}
        >
          Delete step
        </button>
      )}
      <small className="authoring-ui-semantic-id">Semantic ID · {operation.id}</small>
    </section>
  );
}

function InvocationInspector(
  props: Parameters<typeof Inspector>[0] & {
    readonly operation: Extract<Operation, { readonly kind: 'composite.invoke' }>;
  },
) {
  const workflow = props.definition.composites.find(
    (item) => item.id === props.operation.compositeId,
  );
  return (
    <>
      <Property label="Workflow" value={workflow?.name ?? props.operation.compositeId} />
      <p className="authoring-ui-note">
        Target switching is read-only until inputs and outputs can be reconciled atomically.
      </p>
      {workflow?.inputs.map((port) => {
        const binding = props.operation.arguments[port.name];
        return binding ? (
          <ValueSourceField
            key={port.name}
            definition={props.definition}
            operationId={props.operation.id}
            label={displayName(port.name)}
            value={binding}
            expectedType={port.type}
            allowLiteral
            onChange={(expression) =>
              props.run(
                (definition) =>
                  changeWorkflowArgument(definition, props.operation.id, port.name, expression),
                `${displayName(port.name)} binding changed.`,
              )
            }
          />
        ) : null;
      })}
      {Object.entries(props.operation.outputs).map(([port, target]) => (
        <ReadOnlyOutput key={port} label={`${displayName(port)} output`} value={target} />
      ))}
      <button
        className="authoring-ui-primary"
        onClick={() => props.onOpenWorkflow(props.operation.compositeId)}
      >
        Open Workflow
      </button>
    </>
  );
}

function ReferenceInspector(
  props: Parameters<typeof Inspector>[0] & {
    readonly operation: Operation;
    readonly reference: OperationReference;
  },
) {
  const source = referenceValue(props.reference);
  return (
    <section aria-label={`${props.reference.label} reference details`}>
      <span className="authoring-ui-badge">TYPED REFERENCE</span>
      <h3>{props.reference.label}</h3>
      <Property label="Source" value={source} />
      <Property label="Type" value={typeLabel(props.reference.expectedType)} />
      <ValueSourceField
        definition={props.definition}
        operationId={props.operation.id}
        label="Change"
        value={props.reference.expression}
        expectedType={props.reference.expectedType}
        allowLiteral={allowsLiteral(props.reference.path)}
        allowRuntime={props.reference.path !== 'collectionVariable'}
        onChange={(expression) =>
          props.run(
            (definition) =>
              changeReference(definition, props.operation, props.reference.path, expression),
            `${props.reference.label} source changed.`,
          )
        }
      />
      {props.semanticNavigation ? (
        <button
          className="authoring-ui-primary"
          onClick={() => props.onNavigateSource(props.reference)}
        >
          Go to source
        </button>
      ) : (
        <small>Semantic navigation is disabled in this experiment configuration.</small>
      )}
    </section>
  );
}

function ResourceInspector(
  props: Parameters<typeof Inspector>[0] & { readonly variable: VariableDeclaration },
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

function WorkflowInspector(
  props: Parameters<typeof Inspector>[0] & { readonly workflow: CompositeDefinition },
) {
  return (
    <section aria-label={`${props.workflow.name} Workflow details`}>
      <span className="authoring-ui-badge">REUSABLE WORKFLOW</span>
      <label>
        Name
        <input
          aria-label="Workflow name"
          value={props.workflow.name}
          onChange={(event) =>
            props.run(
              (definition) =>
                renameWorkflowCommand(definition, props.workflow.id, event.target.value),
              'Workflow name changed; semantic ID stayed stable.',
            )
          }
        />
      </label>
      <Property
        label="Inputs"
        value={
          props.workflow.inputs.map((item) => `${item.name}: ${typeLabel(item.type)}`).join(', ') ||
          'None'
        }
      />
      <Property
        label="Outputs"
        value={
          props.workflow.outputs
            .map((item) => `${item.name}: ${typeLabel(item.type)}`)
            .join(', ') || 'None'
        }
      />
      <p className="authoring-ui-note">
        Ports and version are read-only in this pass. Name and semantic ID are distinct.
      </p>
      <button
        className="authoring-ui-primary"
        onClick={() => props.onOpenWorkflow(props.workflow.id)}
      >
        Open Workflow
      </button>
      <button
        className="authoring-ui-danger"
        onClick={() => {
          props.run(
            (definition) => deleteWorkflowCommand(definition, props.workflow.id),
            `${props.workflow.name} deleted. Invocations were preserved for diagnostics.`,
          );
          props.onDeleted();
        }}
      >
        Delete Workflow
      </button>
    </section>
  );
}

function RuntimeInspector() {
  return (
    <section aria-label="Runtime data details">
      <span className="authoring-ui-badge">RUNTIME · READ-ONLY</span>
      <h3>Players</h3>
      <p>
        The authoritative running session supplies joined participants. Authors can reference this
        collection but cannot edit its contents.
      </p>
    </section>
  );
}

function ReadOnlyOutput(props: { readonly label: string; readonly value: string }) {
  return (
    <>
      <Property label={props.label} value={props.value} />
      <p className="authoring-ui-note">
        Output identity is read-only to prevent dangling references.
      </p>
    </>
  );
}

function Property(props: { readonly label: string; readonly value: string }) {
  return (
    <dl className="authoring-ui-property">
      <dt>{props.label}</dt>
      <dd>{displayName(props.value)}</dd>
    </dl>
  );
}

function changeReference(
  definition: GameDefinition,
  operation: Operation,
  path: string,
  expression: Expression,
): GameDefinition {
  switch (operation.kind) {
    case 'set':
      return path === 'value'
        ? setStateValue(definition, operation.id, operation.variable, expression)
        : definition;
    case 'random.select':
      return path === 'from'
        ? changeRandomSelectSource(definition, operation.id, expression)
        : definition;
    case 'present':
      if (path === 'message') return changePresentMessage(definition, operation.id, expression);
      if (path === 'audience.id')
        return changeAudience(definition, operation.id, { kind: 'participant', id: expression });
      if (path === 'audience.ids')
        return changeAudience(definition, operation.id, { kind: 'participants', ids: expression });
      return definition;
    case 'input.wait':
      return path === 'participant'
        ? changeInputParticipant(definition, operation.id, expression)
        : definition;
    case 'control.if':
      return path === 'condition.left'
        ? setConditionOperand(definition, operation.id, 'left', expression)
        : path === 'condition.right'
          ? setConditionOperand(definition, operation.id, 'right', expression)
          : definition;
    case 'control.foreach':
      return path === 'collection'
        ? changeForeachCollection(definition, operation.id, expression)
        : definition;
    case 'collection.shuffle':
      return path === 'collection'
        ? changeShuffleSource(definition, operation.id, expression)
        : definition;
    case 'collection.draw':
      return path === 'collectionVariable' && expression.kind === 'variable'
        ? changeDrawSource(definition, operation.id, expression.name)
        : definition;
    case 'composite.invoke':
      return path.startsWith('arguments.')
        ? changeWorkflowArgument(definition, operation.id, path.slice(10), expression)
        : definition;
    default:
      return definition;
  }
}

function typeLabel(type: TypeRef): string {
  return type.kind === 'collection'
    ? `Collection<${typeLabel(type.element)}>`
    : displayName(type.kind);
}
function referenceValue(reference: OperationReference): string {
  return reference.expression.kind === 'variable'
    ? reference.expression.name
    : reference.expression.kind === 'participants'
      ? 'Players'
      : expressionLabel(reference.expression);
}
function allowsLiteral(path: string): boolean {
  return !['from', 'collection', 'collectionVariable', 'audience.ids'].includes(path);
}
function uniqueOptions(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
function compatibleDefault(type: TypeRef): Expression {
  return literal(type.kind === 'number' ? 0 : type.kind === 'boolean' ? false : '', type);
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
function emptyOperation(): Operation {
  return { id: 'missing', kind: 'end' };
}
