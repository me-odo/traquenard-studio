import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';

export const IR_VERSION = 1 as const;
export type ParticipantId = string;

export type TypeRef =
  | { kind: 'string' | 'number' | 'boolean' | 'participant' | 'card' }
  | { kind: 'collection'; element: TypeRef };

export type Value = string | number | boolean | Card | readonly Value[];

export interface CompositePort {
  readonly name: string;
  readonly type: TypeRef;
}

export interface Card {
  readonly id: string;
  readonly suit: string;
  readonly rank: string;
}

export type Expression =
  | { kind: 'literal'; value: Value; valueType: TypeRef }
  | { kind: 'variable'; name: string }
  | { kind: 'participants' }
  | { kind: 'equals'; left: Expression; right: Expression };

export type Audience =
  | { kind: 'everyone' }
  | { kind: 'host' }
  | { kind: 'participant'; id: Expression }
  | { kind: 'participants'; ids: Expression }
  | { kind: 'team'; teamId: string }
  | { kind: 'role'; roleId: string };

interface OperationBase {
  readonly id: string;
}

export type Operation =
  | (OperationBase & { kind: 'sequence'; steps: readonly Operation[] })
  | (OperationBase & { kind: 'set'; variable: string; value: Expression })
  | (OperationBase & {
      kind: 'random.select';
      from: Expression;
      output: string;
    })
  | (OperationBase & {
      kind: 'present';
      audience: Audience;
      message: Expression;
      privacy: 'public' | 'private';
    })
  | (OperationBase & {
      kind: 'input.wait';
      participant: Expression;
      prompt: string;
      options: readonly string[];
      output: string;
    })
  | (OperationBase & {
      kind: 'control.if';
      condition: Expression;
      then: Operation;
      else?: Operation | undefined;
    })
  | (OperationBase & {
      kind: 'control.foreach';
      collection: Expression;
      itemVariable: string;
      body: Operation;
    })
  | (OperationBase & {
      kind: 'control.parallel';
      branches: readonly Operation[];
      join: 'all';
    })
  | (OperationBase & { kind: 'time.wait'; durationMs: number })
  | (OperationBase & {
      kind: 'collection.shuffle';
      collection: Expression;
      output: string;
    })
  | (OperationBase & {
      kind: 'collection.draw';
      collectionVariable: string;
      output: string;
    })
  | (OperationBase & {
      kind: 'composite.invoke';
      compositeId: string;
      arguments: Readonly<Record<string, Expression>>;
      outputs: Readonly<Record<string, string>>;
    })
  | (OperationBase & { kind: 'end' });

export interface VariableDeclaration {
  readonly name: string;
  readonly type: TypeRef;
  readonly initial?: Value | undefined;
}

export interface CompositeDefinition {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly inputs: readonly CompositePort[];
  readonly outputs: readonly CompositePort[];
  readonly implementation: Operation;
}

export interface GameDefinition {
  readonly irVersion: typeof IR_VERSION;
  readonly gameId: string;
  readonly title: string;
  readonly variables: readonly VariableDeclaration[];
  readonly composites: readonly CompositeDefinition[];
  readonly root: Operation;
}

export interface AssetReference {
  readonly packId: string;
  readonly version: string;
  readonly contentHash: string;
}

export interface GameArtifact {
  readonly artifactFormat: 1;
  readonly gameVersion: number;
  readonly artifactId: string;
  readonly definition: GameDefinition;
  readonly assets: readonly AssetReference[];
  readonly contentHash: string;
}

const TypeRefSchema: z.ZodType<TypeRef> = z.lazy(() =>
  z.union([
    z.object({ kind: z.enum(['string', 'number', 'boolean', 'participant', 'card']) }),
    z.object({ kind: z.literal('collection'), element: TypeRefSchema }),
  ]),
);

const CardSchema = z.object({ id: z.string().min(1), suit: z.string(), rank: z.string() });
const ValueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), CardSchema, z.array(ValueSchema)]),
);
const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('literal'), value: ValueSchema, valueType: TypeRefSchema }),
    z.object({ kind: z.literal('variable'), name: z.string().min(1) }),
    z.object({ kind: z.literal('participants') }),
    z.object({ kind: z.literal('equals'), left: ExpressionSchema, right: ExpressionSchema }),
  ]),
);
const AudienceSchema: z.ZodType<Audience> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('everyone') }),
  z.object({ kind: z.literal('host') }),
  z.object({ kind: z.literal('participant'), id: ExpressionSchema }),
  z.object({ kind: z.literal('participants'), ids: ExpressionSchema }),
  z.object({ kind: z.literal('team'), teamId: z.string().min(1) }),
  z.object({ kind: z.literal('role'), roleId: z.string().min(1) }),
]);

export const OperationSchema: z.ZodType<Operation> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      id: z.string().min(1),
      kind: z.literal('sequence'),
      steps: z.array(OperationSchema),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('set'),
      variable: z.string(),
      value: ExpressionSchema,
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('random.select'),
      from: ExpressionSchema,
      output: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('present'),
      audience: AudienceSchema,
      message: ExpressionSchema,
      privacy: z.enum(['public', 'private']),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('input.wait'),
      participant: ExpressionSchema,
      prompt: z.string().min(1),
      options: z.array(z.string()).min(1),
      output: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('control.if'),
      condition: ExpressionSchema,
      then: OperationSchema,
      else: OperationSchema.optional(),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('control.foreach'),
      collection: ExpressionSchema,
      itemVariable: z.string(),
      body: OperationSchema,
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('control.parallel'),
      branches: z.array(OperationSchema).min(1),
      join: z.literal('all'),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('time.wait'),
      durationMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('collection.shuffle'),
      collection: ExpressionSchema,
      output: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('collection.draw'),
      collectionVariable: z.string(),
      output: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      kind: z.literal('composite.invoke'),
      compositeId: z.string().min(1),
      arguments: z.record(z.string().min(1), ExpressionSchema),
      outputs: z.record(z.string().min(1), z.string().min(1)),
    }),
    z.object({ id: z.string().min(1), kind: z.literal('end') }),
  ]),
);

export const GameDefinitionSchema: z.ZodType<GameDefinition> = z.object({
  irVersion: z.literal(IR_VERSION),
  gameId: z.string().min(1),
  title: z.string().min(1),
  variables: z.array(
    z.object({ name: z.string().min(1), type: TypeRefSchema, initial: ValueSchema.optional() }),
  ),
  composites: z.array(
    z.object({
      id: z.string().min(1),
      version: z.number().int().positive(),
      name: z.string().min(1),
      inputs: z.array(z.object({ name: z.string().min(1), type: TypeRefSchema })),
      outputs: z.array(z.object({ name: z.string().min(1), type: TypeRefSchema })),
      implementation: OperationSchema,
    }),
  ),
  root: OperationSchema,
});

export const GameArtifactSchema: z.ZodType<GameArtifact> = z.object({
  artifactFormat: z.literal(1),
  gameVersion: z.number().int().positive(),
  artifactId: z.string().min(1),
  definition: GameDefinitionSchema,
  assets: z.array(z.object({ packId: z.string(), version: z.string(), contentHash: z.string() })),
  contentHash: z.string().min(1),
});

export function parseGameDefinition(input: unknown): GameDefinition {
  return GameDefinitionSchema.parse(input);
}

export function parseGameArtifact(input: unknown): GameArtifact {
  return deepFreeze(GameArtifactSchema.parse(input));
}

export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => compareCanonicalKeys(a, b))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

/** Orders keys by their unnormalized UTF-16 code units, independent of locale settings. */
export function compareCanonicalKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function contentHash(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  return `sha256-${bytesToHex(sha256(bytes))}`;
}

export function valueConformsToType(value: Value, type: TypeRef): boolean {
  switch (type.kind) {
    case 'string':
    case 'participant':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'card':
      return isCard(value);
    case 'collection':
      return (
        Array.isArray(value) &&
        (value as readonly Value[]).every((item) => valueConformsToType(item, type.element))
      );
  }
}

function isCard(value: unknown): value is Card {
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.suit === 'string' &&
    typeof candidate.rank === 'string'
  );
}

export function publishArtifact(
  definition: GameDefinition,
  gameVersion: number,
  assets: readonly AssetReference[] = [],
): GameArtifact {
  const parsed = parseGameDefinition(definition);
  const payload = { artifactFormat: 1 as const, gameVersion, definition: parsed, assets };
  const hash = contentHash(payload);
  return deepFreeze({
    ...payload,
    artifactId: `${parsed.gameId}@${gameVersion}:${hash}`,
    contentHash: hash,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const t = {
  string: { kind: 'string' } as const,
  number: { kind: 'number' } as const,
  boolean: { kind: 'boolean' } as const,
  participant: { kind: 'participant' } as const,
  card: { kind: 'card' } as const,
  collection: (element: TypeRef): TypeRef => ({ kind: 'collection', element }),
};

export const literal = (value: Value, valueType: TypeRef): Expression => ({
  kind: 'literal',
  value,
  valueType,
});
export const variable = (name: string): Expression => ({ kind: 'variable', name });
