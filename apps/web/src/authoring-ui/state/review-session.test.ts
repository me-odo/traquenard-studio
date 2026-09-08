import { describe, expect, it } from 'vitest';
import { createBaselineDocument, setWaitDuration } from '../document.js';
import {
  clearReviewSessionDefinition,
  loadReviewSessionDefinition,
  reviewSessionStorageKey,
  saveReviewSessionDefinition,
  type ReviewSessionIdentity,
  type ReviewSessionStorage,
} from './review-session.js';

class MemoryStorage implements ReviewSessionStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const rootIdentity: ReviewSessionIdentity = {
  baselineId: 'baseline-test',
  surfaceId: 'current-editor',
  fixtureId: 'current',
};

describe('review-session working copy persistence', () => {
  it('round-trips a valid mutable GameDefinition without modifying its canonical fixture', () => {
    const storage = new MemoryStorage();
    const canonical = createBaselineDocument();
    const edited = setWaitDuration(canonical, 'wait-again', 6);
    saveReviewSessionDefinition(rootIdentity, canonical, edited, storage);

    const restored = loadReviewSessionDefinition(rootIdentity, canonical, storage);
    expect(restored).toEqual(edited);
    expect(restored).not.toBe(edited);
    expect(loadReviewSessionDefinition(rootIdentity, canonical, new MemoryStorage())).toEqual(
      canonical,
    );
    expect(canonical).not.toBe(restored);
  });

  it('keys root, labs, fixtures, and semantic fixture variants independently', () => {
    const identities: readonly ReviewSessionIdentity[] = [
      rootIdentity,
      { ...rootIdentity, surfaceId: 'lab:authoring' },
      { ...rootIdentity, surfaceId: 'lab:parallel' },
      { ...rootIdentity, fixtureId: 'long-flow' },
      { ...rootIdentity, semanticConfiguration: 'semantic-a' },
    ];
    expect(new Set(identities.map(reviewSessionStorageKey))).toHaveProperty('size', 5);
  });

  it.each([
    ['malformed JSON', '{'],
    ['stale schema', JSON.stringify({ schemaVersion: 0 })],
    [
      'stale baseline',
      JSON.stringify({
        schemaVersion: 1,
        baselineId: 'old-baseline',
        surfaceId: rootIdentity.surfaceId,
        fixtureId: rootIdentity.fixtureId,
        semanticConfiguration: 'default',
        canonicalGameId: createBaselineDocument().gameId,
        definition: createBaselineDocument(),
      }),
    ],
    [
      'incompatible fixture',
      JSON.stringify({
        schemaVersion: 1,
        baselineId: rootIdentity.baselineId,
        surfaceId: rootIdentity.surfaceId,
        fixtureId: 'another-fixture',
        semanticConfiguration: 'default',
        canonicalGameId: createBaselineDocument().gameId,
        definition: createBaselineDocument(),
      }),
    ],
    [
      'incompatible definition identity',
      JSON.stringify({
        schemaVersion: 1,
        baselineId: rootIdentity.baselineId,
        surfaceId: rootIdentity.surfaceId,
        fixtureId: rootIdentity.fixtureId,
        semanticConfiguration: 'default',
        canonicalGameId: createBaselineDocument().gameId,
        definition: { ...createBaselineDocument(), gameId: 'another-game' },
      }),
    ],
  ])('recovers from %s storage by restoring canonical state', (_label, serialized) => {
    const storage = new MemoryStorage();
    const canonical = createBaselineDocument();
    const key = reviewSessionStorageKey(rootIdentity);
    storage.setItem(key, serialized);
    expect(loadReviewSessionDefinition(rootIdentity, canonical, storage)).toEqual(canonical);
    expect(storage.getItem(key)).toBeNull();
  });

  it('clears only the selected review-session working copy', () => {
    const storage = new MemoryStorage();
    const canonical = createBaselineDocument();
    const other = { ...rootIdentity, fixtureId: 'other' };
    saveReviewSessionDefinition(rootIdentity, canonical, canonical, storage);
    saveReviewSessionDefinition(other, canonical, canonical, storage);
    clearReviewSessionDefinition(rootIdentity, storage);
    expect(storage.getItem(reviewSessionStorageKey(rootIdentity))).toBeNull();
    expect(storage.getItem(reviewSessionStorageKey(other))).not.toBeNull();
  });
});
