import type { Expression, Operation, TypeRef } from '@traquenard/game-ir';

export type OperationKind = Operation['kind'];
export type AuthoringPolicy = 'insertable' | 'structural' | 'restricted' | 'unavailable';
export type RendererPolicy = 'ordinary' | 'structured' | 'parallel' | 'internal';

export interface OperationDescriptor {
  readonly kind: OperationKind;
  readonly label: string;
  readonly explanation: string;
  readonly category: 'Data' | 'Message' | 'Input' | 'Control' | 'Workflow' | 'Internal';
  readonly policy: AuthoringPolicy;
  readonly renderer: RendererPolicy;
  readonly inspector: 'editable' | 'read-only' | 'internal';
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly references: readonly string[];
  readonly structural: boolean;
  readonly unavailableReason?: string;
}

export type ValueFamily = 'runtime' | 'authored-data' | 'flow-output' | 'workflow-input';

export interface AuthoringValue {
  readonly id: string;
  readonly label: string;
  readonly type: TypeRef;
  readonly family: ValueFamily;
  readonly sourceLabel: string;
  readonly source:
    | { readonly kind: 'runtime' }
    | { readonly kind: 'variable'; readonly variableName: string }
    | { readonly kind: 'block'; readonly blockId: string }
    | {
        readonly kind: 'composite-port';
        readonly compositeId: string;
        readonly direction: 'input';
      };
}

export interface AuthoringCandidate {
  readonly reference: AuthoringValue;
  readonly compatible: boolean;
  readonly reason?: string;
  readonly value: AuthoringValue;
}

export interface SemanticLocation {
  readonly sequenceId: string;
  readonly index: number;
  readonly workflowId?: string;
}

export interface OperationReference {
  readonly ownerOperationId: string;
  readonly path: string;
  readonly label: string;
  readonly expectedType: TypeRef;
  readonly expression: Expression;
}

export interface AuthoringDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly operationId?: string;
  readonly field?: string;
}

export type AuthoredDataKind = 'collection' | 'state' | 'string' | 'boolean';
