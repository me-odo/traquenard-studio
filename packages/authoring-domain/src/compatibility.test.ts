import { describe, expect, it } from 'vitest';
import { t } from '@traquenard/game-ir';
import {
  blockCatalog,
  compatibilityAtSlot,
  compatibleValueReferences,
  insertionSlots,
  referenceCompatibility,
  sequentialDraft,
  type ValueReference,
} from './index.js';

describe('typed authoring compatibility', () => {
  it('derives compatible candidates from semantic Game IR types', () => {
    const empty = { ...sequentialDraft, blocks: [] };
    const select = blockCatalog.find((entry) => entry.kind === 'select-player')!;
    const ask = blockCatalog.find((entry) => entry.kind === 'ask-selected')!;
    const slot = insertionSlots(empty)[0]!;

    expect(compatibilityAtSlot(select, slot)).toMatchObject({ compatible: true });
    expect(compatibilityAtSlot(ask, slot)).toMatchObject({
      compatible: false,
      reason: "No participant value is available for input 'participant'.",
    });
  });

  it('exposes typed values at every sequential insertion boundary', () => {
    const slots = insertionSlots(sequentialDraft);
    expect(slots).toHaveLength(sequentialDraft.blocks.length + 1);
    expect(slots[1]!.availableValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'selectedPlayer', type: { kind: 'participant' } }),
      ]),
    );
  });
});

describe('reference compatibility', () => {
  const references: readonly ValueReference[] = [
    {
      id: 'questionsDeck',
      type: t.collection(t.card),
      source: { kind: 'variable', variableName: 'questionsDeck' },
    },
    {
      id: 'challengesDeck',
      type: t.collection(t.card),
      source: { kind: 'variable', variableName: 'challengesDeck' },
    },
    {
      id: 'currentPlayer',
      type: t.participant,
      source: { kind: 'block', blockId: 'choose-player' },
    },
  ];

  it('keeps same-type references individually identifiable', () => {
    expect(
      compatibleValueReferences(references, t.collection(t.card)).map((value) => value.id),
    ).toEqual(['questionsDeck', 'challengesDeck']);
  });

  it('explains incompatible values without treating them as candidates', () => {
    const player = referenceCompatibility(references, t.collection(t.card)).find(
      (candidate) => candidate.reference.id === 'currentPlayer',
    );
    expect(player).toEqual({
      reference: references[2],
      compatible: false,
      reason: 'Expected Collection<card>, received participant.',
    });
  });
});
