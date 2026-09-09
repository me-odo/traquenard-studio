import type { OperationReference } from '@traquenard/authoring-domain';
import type { GameDefinition, Operation } from '@traquenard/game-ir';
import type { RunCommand, Selection } from '../state/types.js';

export interface InspectorProps {
  readonly definition: GameDefinition;
  readonly selection: Selection;
  readonly operation?: Operation;
  readonly semanticNavigation: boolean;
  readonly run: RunCommand;
  readonly onOpenWorkflow: (id: string) => void;
  readonly onNavigateReference: (reference: OperationReference) => void;
  readonly onNavigateSource: (reference: OperationReference) => void;
  readonly onDeleted: () => void;
}
