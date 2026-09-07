import { describe, expect, it } from 'vitest';
import { compatibilityAtSlot, insertionSlots, sequentialDraft, blockCatalog } from './index.js';

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
