import type { CompositeDefinition, GameDefinition } from '@traquenard/game-ir';
import { identifier, uniqueName } from '../formatting.js';

export function createWorkflowCommand(
  definition: GameDefinition,
  requestedName = 'New workflow',
): GameDefinition {
  const id = uniqueName(
    definition.composites.map((item) => item.id),
    identifier(requestedName) || 'workflow',
  );
  const workflow: CompositeDefinition = {
    id,
    version: 1,
    name: requestedName,
    inputs: [],
    outputs: [],
    implementation: { id: `${id}-sequence`, kind: 'sequence', steps: [] },
  };
  return { ...definition, composites: [...definition.composites, workflow] };
}

export function renameWorkflowCommand(
  definition: GameDefinition,
  workflowId: string,
  name: string,
): GameDefinition {
  if (!name.trim()) return definition;
  return {
    ...definition,
    composites: definition.composites.map((item) =>
      item.id === workflowId ? { ...item, name: name.trim() } : item,
    ),
  };
}

export function deleteWorkflowCommand(
  definition: GameDefinition,
  workflowId: string,
): GameDefinition {
  return {
    ...definition,
    composites: definition.composites.filter((item) => item.id !== workflowId),
  };
}
