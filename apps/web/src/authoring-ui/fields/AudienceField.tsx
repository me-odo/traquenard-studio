import { changeAudience, valueCandidatesForOperation } from '@traquenard/authoring-domain';
import { literal, t, variable, type GameDefinition, type Operation } from '@traquenard/game-ir';
import type { RunCommand } from '../state/types.js';
import { ValueSourceField } from './ValueSourceField.js';

export function AudienceField(props: {
  readonly definition: GameDefinition;
  readonly operation: Extract<Operation, { readonly kind: 'present' }>;
  readonly run: RunCommand;
}) {
  const audience = props.operation.audience;
  return (
    <fieldset className="authoring-ui-value-field">
      <legend>Audience</legend>
      <select
        aria-label="Audience kind"
        value={audience.kind}
        onChange={(event) => {
          const kind = event.target.value;
          const participant = valueCandidatesForOperation(
            props.definition,
            props.operation.id,
            t.participant,
          ).find((item) => item.compatible)?.value;
          const next =
            kind === 'participant'
              ? ({
                  kind,
                  id: participant
                    ? variable(participant.id)
                    : literal('participant', t.participant),
                } as const)
              : kind === 'participants'
                ? ({ kind, ids: { kind: 'participants' } } as const)
                : kind === 'team'
                  ? ({ kind, teamId: 'team' } as const)
                  : kind === 'role'
                    ? ({ kind, roleId: 'role' } as const)
                    : kind === 'host'
                      ? ({ kind } as const)
                      : ({ kind: 'everyone' } as const);
          props.run(
            (definition) => changeAudience(definition, props.operation.id, next),
            'Message audience changed.',
          );
        }}
      >
        <option value="everyone">Everyone</option>
        <option value="host">Host</option>
        <option value="participant">One participant</option>
        <option value="participants">Participant collection</option>
        <option value="team">Fixed team</option>
        <option value="role">Fixed role</option>
      </select>
      {audience.kind === 'participant' && (
        <ValueSourceField
          definition={props.definition}
          operationId={props.operation.id}
          label="Participant audience"
          value={audience.id}
          expectedType={t.participant}
          onChange={(expression) =>
            props.run(
              (definition) =>
                changeAudience(definition, props.operation.id, {
                  kind: 'participant',
                  id: expression,
                }),
              'Participant audience changed.',
            )
          }
        />
      )}
      {audience.kind === 'participants' && (
        <ValueSourceField
          definition={props.definition}
          operationId={props.operation.id}
          label="Participants audience"
          value={audience.ids}
          expectedType={t.collection(t.participant)}
          onChange={(expression) =>
            props.run(
              (definition) =>
                changeAudience(definition, props.operation.id, {
                  kind: 'participants',
                  ids: expression,
                }),
              'Participants audience changed.',
            )
          }
        />
      )}
      {(audience.kind === 'team' || audience.kind === 'role') && (
        <small>Team and role identifiers are fixed authored IDs in Game IR v1.</small>
      )}
    </fieldset>
  );
}
