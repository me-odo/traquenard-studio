import type { Audience, GameArtifact, Operation, ParticipantId, Value } from '@traquenard/game-ir';

export interface Participant {
  readonly id: ParticipantId;
  readonly name: string;
  readonly isHost: boolean;
  readonly required: boolean;
  readonly teamId?: string;
  readonly roleId?: string;
}

export interface ResolvedAudience {
  readonly kind: Audience['kind'];
  readonly participantIds: readonly ParticipantId[];
}

export type SemanticEvent =
  | { readonly kind: 'random.selected'; readonly operationId: string; readonly value: Value }
  | {
      readonly kind: 'collection.shuffled';
      readonly operationId: string;
      readonly value: readonly Value[];
    }
  | { readonly kind: 'collection.drawn'; readonly operationId: string; readonly value: Value }
  | {
      readonly kind: 'presentation.emitted';
      readonly operationId: string;
      readonly message: string;
      readonly privacy: 'public' | 'private';
      readonly audience: ResolvedAudience;
    }
  | {
      readonly kind: 'input.requested';
      readonly operationId: string;
      readonly participantId: ParticipantId;
      readonly prompt: string;
      readonly options: readonly string[];
      readonly audience: ResolvedAudience;
    }
  | { readonly kind: 'timer.scheduled'; readonly operationId: string; readonly dueAt: number }
  | { readonly kind: 'execution.completed'; readonly operationId: string };

export interface OperationFrame {
  readonly kind: 'operation';
  readonly operation: Operation;
  readonly locals: Readonly<Record<string, Value>>;
  readonly scopeId?: string;
}

export interface CompositeReturnFrame {
  readonly kind: 'composite.return';
  readonly scopeId: string;
  readonly callerScopeId?: string;
  readonly outputs: Readonly<Record<string, string>>;
}

export type Frame = OperationFrame | CompositeReturnFrame;

export interface PendingInput {
  readonly kind: 'input';
  readonly operationId: string;
  readonly participantId: ParticipantId;
  readonly options: readonly string[];
  readonly output: string;
  readonly scopeId?: string;
}

export interface PendingTimer {
  readonly kind: 'timer';
  readonly operationId: string;
  readonly dueAt: number;
}

export type PendingWait = PendingInput | PendingTimer;

export interface EngineState {
  readonly artifact: GameArtifact;
  readonly participants: readonly Participant[];
  readonly variables: Readonly<Record<string, Value>>;
  readonly scopes: Readonly<Record<string, Readonly<Record<string, Value>>>>;
  readonly nextScopeId: number;
  readonly frames: readonly Frame[];
  readonly pending: Readonly<Record<string, PendingWait>>;
  readonly rngState: number;
  readonly logicalTime: number;
  readonly completed: boolean;
}
