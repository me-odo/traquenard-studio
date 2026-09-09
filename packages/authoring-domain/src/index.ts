import {
  IR_VERSION,
  literal,
  publishArtifact,
  t,
  variable,
  type CompositeDefinition,
  type GameArtifact,
  type GameDefinition,
  type Operation,
  type TypeRef,
} from '@traquenard/game-ir';
import { sameType, validateDefinition, type ValidationResult } from '@traquenard/game-validator';

export type DraftBlock =
  | { readonly id: string; readonly kind: 'select-player'; readonly output: string }
  | {
      readonly id: string;
      readonly kind: 'display';
      readonly message: string;
      readonly audience: 'everyone';
    }
  | {
      readonly id: string;
      readonly kind: 'ask-selected';
      readonly prompt: string;
      readonly options: readonly string[];
      readonly output: string;
    }
  | { readonly id: string; readonly kind: 'wait'; readonly durationMs: number }
  | { readonly id: string; readonly kind: 'end' };

export interface GameDraft {
  readonly draftVersion: 1;
  readonly gameId: string;
  readonly title: string;
  readonly revision: number;
  readonly blocks: readonly DraftBlock[];
}

export interface DraftLayout {
  readonly layoutVersion: 1;
  readonly positions: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number };
}

export interface BlockCatalogEntry {
  readonly kind: DraftBlock['kind'];
  readonly label: string;
  readonly summary: string;
  readonly inputs: readonly TypedPort[];
  readonly outputs: readonly TypedPort[];
  readonly create: (id: string) => DraftBlock;
}

export interface TypedPort {
  readonly name: string;
  readonly type: TypeRef;
}

export interface ValueReference {
  readonly id: string;
  readonly type: TypeRef;
  readonly source:
    | { readonly kind: 'runtime' }
    | { readonly kind: 'variable'; readonly variableName: string }
    | { readonly kind: 'block'; readonly blockId: string }
    | {
        readonly kind: 'composite-port';
        readonly compositeId: string;
        readonly direction: 'input' | 'output';
      };
}

export interface ReferenceCompatibility {
  readonly reference: ValueReference;
  readonly compatible: boolean;
  readonly reason?: string;
}

export interface InsertionSlot {
  readonly index: number;
  readonly availableValues: readonly ValueReference[];
}

export interface BlockCompatibility extends BlockCatalogEntry {
  readonly compatible: boolean;
  readonly reason?: string;
  readonly candidates: Readonly<Record<string, readonly ValueReference[]>>;
}

export const blockCatalog: readonly BlockCatalogEntry[] = [
  {
    kind: 'select-player',
    label: 'Choose player',
    summary: 'Deterministically selects from joined players.',
    inputs: [{ name: 'players', type: t.collection(t.participant) }],
    outputs: [{ name: 'selectedPlayer', type: t.participant }],
    create: (id) => ({ id, kind: 'select-player', output: 'selectedPlayer' }),
  },
  {
    kind: 'display',
    label: 'Display prompt',
    summary: 'Shows server-filtered presentation intent.',
    inputs: [],
    outputs: [],
    create: (id) => ({ id, kind: 'display', message: 'Get ready!', audience: 'everyone' }),
  },
  {
    kind: 'ask-selected',
    label: 'Ask selected player',
    summary: 'Waits for a typed choice from the selected player.',
    inputs: [{ name: 'participant', type: t.participant }],
    outputs: [{ name: 'answer', type: t.string }],
    create: (id) => ({
      id,
      kind: 'ask-selected',
      prompt: 'Choose one',
      options: ['Yes', 'No'],
      output: 'answer',
    }),
  },
  {
    kind: 'wait',
    label: 'Wait',
    summary: 'Schedules a logical timer.',
    inputs: [],
    outputs: [],
    create: (id) => ({ id, kind: 'wait', durationMs: 1000 }),
  },
  {
    kind: 'end',
    label: 'End game',
    summary: 'Completes the session.',
    inputs: [],
    outputs: [],
    create: (id) => ({ id, kind: 'end' }),
  },
] as const;

export function availableBlocks(draft: GameDraft): readonly BlockCompatibility[] {
  const slot = insertionSlots(draft).at(-1)!;
  return blockCatalog.map((entry) => compatibilityAtSlot(entry, slot));
}

export function insertionSlots(draft: GameDraft): readonly InsertionSlot[] {
  const available: ValueReference[] = [
    {
      id: 'runtime.participants',
      type: t.collection(t.participant),
      source: { kind: 'runtime' },
    },
  ];
  const slots: InsertionSlot[] = [{ index: 0, availableValues: [...available] }];
  for (const [index, block] of draft.blocks.entries()) {
    const entry = blockCatalog.find((item) => item.kind === block.kind);
    for (const output of entry?.outputs ?? []) {
      const outputName = 'output' in block ? block.output : output.name;
      available.push({
        id: outputName,
        type: output.type,
        source: { kind: 'block', blockId: block.id },
      });
    }
    slots.push({ index: index + 1, availableValues: [...available] });
  }
  return slots;
}

export function compatibilityAtSlot(
  entry: BlockCatalogEntry,
  slot: InsertionSlot,
): BlockCompatibility {
  const candidates = Object.fromEntries(
    entry.inputs.map((input) => [
      input.name,
      slot.availableValues.filter((value) => sameType(value.type, input.type)),
    ]),
  );
  const missing = entry.inputs.filter((input) => candidates[input.name]?.length === 0);
  return missing.length === 0
    ? { ...entry, compatible: true, candidates }
    : {
        ...entry,
        compatible: false,
        candidates,
        reason: `No ${showType(missing[0]!.type)} value is available for input '${missing[0]!.name}'.`,
      };
}

/**
 * Presentation-neutral compatibility for choosing a value at a typed input.
 * Consumers may show incompatible values for explanation, but must not select them.
 */
export function referenceCompatibility(
  references: readonly ValueReference[],
  expectedType: TypeRef,
): readonly ReferenceCompatibility[] {
  return references.map((reference) =>
    sameType(reference.type, expectedType)
      ? { reference, compatible: true }
      : {
          reference,
          compatible: false,
          reason: `Expected ${showType(expectedType)}, received ${showType(reference.type)}.`,
        },
  );
}

export function compatibleValueReferences(
  references: readonly ValueReference[],
  expectedType: TypeRef,
): readonly ValueReference[] {
  return referenceCompatibility(references, expectedType)
    .filter((candidate) => candidate.compatible)
    .map((candidate) => candidate.reference);
}

export function describeType(type: TypeRef): string {
  return showType(type);
}

export function appendBlock(draft: GameDraft, kind: DraftBlock['kind'], id: string): GameDraft {
  const entry = availableBlocks(draft).find((item) => item.kind === kind);
  if (!entry?.compatible) throw new Error(entry?.reason ?? `Unknown block '${kind}'.`);
  return { ...draft, revision: draft.revision + 1, blocks: [...draft.blocks, entry.create(id)] };
}

export function compileDraft(draft: GameDraft): GameDefinition {
  const operations = draft.blocks.map(compileBlock);
  return {
    irVersion: IR_VERSION,
    gameId: draft.gameId,
    title: draft.title,
    variables: [
      { name: 'selectedPlayer', type: t.participant },
      { name: 'answer', type: t.string },
    ],
    composites: [],
    root: { id: 'root', kind: 'sequence', steps: operations },
  };
}

export function validateDraft(draft: GameDraft): ValidationResult {
  if (draft.blocks.length === 0)
    return {
      valid: false,
      issues: [{ path: 'blocks', code: 'empty_game', message: 'Add at least one block.' }],
    };
  return validateDefinition(compileDraft(draft));
}

/** Validates a mutable authoring document against the canonical Game IR contract. */
export function validateWorkingDefinition(definition: GameDefinition): ValidationResult {
  return validateDefinition(definition);
}

export function publishDraft(draft: GameDraft, gameVersion: number): GameArtifact {
  const validation = validateDraft(draft);
  if (!validation.valid) throw new Error(validation.issues.map((item) => item.message).join(' '));
  return publishArtifact(compileDraft(draft), gameVersion);
}

export const sequentialDraft: GameDraft = {
  draftVersion: 1,
  gameId: 'sequential-interaction',
  title: 'Sequential interaction',
  revision: 1,
  blocks: [
    { id: 'select', kind: 'select-player', output: 'selectedPlayer' },
    { id: 'intro', kind: 'display', message: 'A player has been selected.', audience: 'everyone' },
    {
      id: 'ask',
      kind: 'ask-selected',
      prompt: 'Choose a challenge',
      options: ['Mime', 'Story'],
      output: 'answer',
    },
    { id: 'finish', kind: 'end' },
  ],
};

function compileBlock(block: DraftBlock): Operation {
  switch (block.kind) {
    case 'select-player':
      return {
        id: block.id,
        kind: 'random.select',
        from: { kind: 'participants' },
        output: block.output,
      };
    case 'display':
      return {
        id: block.id,
        kind: 'present',
        audience: { kind: 'everyone' },
        message: literal(block.message, t.string),
        privacy: 'public',
      };
    case 'ask-selected':
      return {
        id: block.id,
        kind: 'input.wait',
        participant: variable('selectedPlayer'),
        prompt: block.prompt,
        options: block.options,
        output: block.output,
      };
    case 'wait':
      return { id: block.id, kind: 'time.wait', durationMs: block.durationMs };
    case 'end':
      return { id: block.id, kind: 'end' };
  }
}

export type { CompositeDefinition };

export * from './authoring.js';

function showType(type: TypeRef): string {
  return type.kind === 'collection' ? `Collection<${showType(type.element)}>` : type.kind;
}
