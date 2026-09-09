import type { GameDefinition } from '@traquenard/game-ir';

export type MobilePanel = 'flow' | 'data' | 'workflows' | 'inspector';

export type Selection =
  | { readonly kind: 'operation'; readonly id: string }
  | { readonly kind: 'reference'; readonly operationId: string; readonly path: string }
  | { readonly kind: 'runtime' }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'workflow'; readonly id: string };

export interface NavigationContext {
  readonly selection: Selection;
  readonly workflowId?: string;
}

export type DefinitionCommand = (definition: GameDefinition) => GameDefinition;
export type RunCommand = (command: DefinitionCommand, status: string) => void;
