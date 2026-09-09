import { changeInputParticipant, changePresentMessage } from '@traquenard/authoring-domain';
import { t, type Operation } from '@traquenard/game-ir';
import { setInputOptions, setInputPrompt, updateOperation } from '../../document.js';
import { AudienceField } from '../../fields/AudienceField.js';
import { ValueSourceField } from '../../fields/ValueSourceField.js';
import { ReadOnlyOutput } from '../presentation.js';
import type { InspectorProps } from '../types.js';

export function CommunicationOperationFields(
  props: InspectorProps & { readonly operation: Operation },
) {
  const { operation } = props;
  if (operation.kind === 'present')
    return (
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
    );
  if (operation.kind === 'input.wait')
    return (
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
    );
  return null;
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
