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
} from '@traquenard/game-ir';
import { validateDefinition, type ValidationResult } from '@traquenard/game-validator';

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
  readonly requires: readonly string[];
  readonly provides: readonly string[];
  readonly create: (id: string) => DraftBlock;
}

export const blockCatalog: readonly BlockCatalogEntry[] = [
  {
    kind: 'select-player',
    label: 'Choose player',
    summary: 'Deterministically selects from joined players.',
    requires: ['players'],
    provides: ['selectedPlayer'],
    create: (id) => ({ id, kind: 'select-player', output: 'selectedPlayer' }),
  },
  {
    kind: 'display',
    label: 'Display prompt',
    summary: 'Shows server-filtered presentation intent.',
    requires: [],
    provides: [],
    create: (id) => ({ id, kind: 'display', message: 'Get ready!', audience: 'everyone' }),
  },
  {
    kind: 'ask-selected',
    label: 'Ask selected player',
    summary: 'Waits for a typed choice from the selected player.',
    requires: ['selectedPlayer'],
    provides: ['answer'],
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
    requires: [],
    provides: [],
    create: (id) => ({ id, kind: 'wait', durationMs: 1000 }),
  },
  {
    kind: 'end',
    label: 'End game',
    summary: 'Completes the session.',
    requires: [],
    provides: [],
    create: (id) => ({ id, kind: 'end' }),
  },
] as const;

export function availableBlocks(
  draft: GameDraft,
): readonly (BlockCatalogEntry & { readonly compatible: boolean; readonly reason?: string })[] {
  const provided = new Set(['players']);
  for (const block of draft.blocks) {
    const entry = blockCatalog.find((item) => item.kind === block.kind);
    entry?.provides.forEach((item) => provided.add(item));
  }
  return blockCatalog.map((entry) => {
    const missing = entry.requires.filter((requirement) => !provided.has(requirement));
    return missing.length === 0
      ? { ...entry, compatible: true }
      : { ...entry, compatible: false, reason: `Requires ${missing.join(', ')}` };
  });
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
