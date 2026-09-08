import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { parseGameDefinition, type GameDefinition } from '@traquenard/game-ir';

const REVIEW_SESSION_SCHEMA_VERSION = 1;
const REVIEW_SESSION_PREFIX = 'traquenard:authoring-review';

export interface ReviewSessionIdentity {
  readonly baselineId: string;
  readonly surfaceId: string;
  readonly fixtureId: string;
  readonly semanticConfiguration?: string;
}

export interface ReviewSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ReviewSessionEnvelope {
  readonly schemaVersion: typeof REVIEW_SESSION_SCHEMA_VERSION;
  readonly baselineId: string;
  readonly surfaceId: string;
  readonly fixtureId: string;
  readonly semanticConfiguration: string;
  readonly canonicalGameId: string;
  readonly definition: GameDefinition;
}

export function reviewSessionStorageKey(identity: ReviewSessionIdentity): string {
  return [
    REVIEW_SESSION_PREFIX,
    `v${REVIEW_SESSION_SCHEMA_VERSION}`,
    identity.baselineId,
    identity.surfaceId,
    identity.fixtureId,
    identity.semanticConfiguration ?? 'default',
  ]
    .map(encodeURIComponent)
    .join(':');
}

export function labReviewSessionIdentity(
  baselineId: string,
  labId: string,
  fixtureId: string,
  semanticConfiguration?: string,
): ReviewSessionIdentity {
  return {
    baselineId,
    surfaceId: `lab:${labId}`,
    fixtureId,
    ...(semanticConfiguration ? { semanticConfiguration } : {}),
  };
}

export function loadReviewSessionDefinition(
  identity: ReviewSessionIdentity,
  canonicalDefinition: GameDefinition,
  storage: ReviewSessionStorage | undefined = browserSessionStorage(),
): GameDefinition {
  const fallback = () => structuredClone(canonicalDefinition);
  if (!storage) return fallback();
  const key = reviewSessionStorageKey(identity);
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return fallback();
    const candidate: unknown = JSON.parse(serialized);
    if (!isCompatibleEnvelope(candidate, identity, canonicalDefinition)) {
      storage.removeItem(key);
      return fallback();
    }
    const definition = parseGameDefinition(candidate.definition);
    if (
      definition.gameId !== canonicalDefinition.gameId ||
      definition.irVersion !== canonicalDefinition.irVersion
    ) {
      storage.removeItem(key);
      return fallback();
    }
    return structuredClone(definition);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage recovery is best-effort; authoring must still open from its canonical fixture.
    }
    return fallback();
  }
}

export function saveReviewSessionDefinition(
  identity: ReviewSessionIdentity,
  canonicalDefinition: GameDefinition,
  definition: GameDefinition,
  storage: ReviewSessionStorage | undefined = browserSessionStorage(),
): void {
  if (!storage) return;
  const envelope: ReviewSessionEnvelope = {
    schemaVersion: REVIEW_SESSION_SCHEMA_VERSION,
    baselineId: identity.baselineId,
    surfaceId: identity.surfaceId,
    fixtureId: identity.fixtureId,
    semanticConfiguration: identity.semanticConfiguration ?? 'default',
    canonicalGameId: canonicalDefinition.gameId,
    definition,
  };
  try {
    storage.setItem(reviewSessionStorageKey(identity), JSON.stringify(envelope));
  } catch {
    // Review persistence is a convenience and must never prevent in-memory authoring.
  }
}

export function clearReviewSessionDefinition(
  identity: ReviewSessionIdentity,
  storage: ReviewSessionStorage | undefined = browserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(reviewSessionStorageKey(identity));
  } catch {
    // Reset still restores the in-memory canonical fixture when storage is unavailable.
  }
}

export function useReviewSessionDefinition(
  canonicalDefinition: GameDefinition,
  identity: ReviewSessionIdentity,
): {
  readonly definition: GameDefinition;
  readonly setDefinition: Dispatch<SetStateAction<GameDefinition>>;
  readonly resetDefinition: () => void;
} {
  const [definition, setDefinitionState] = useState(() =>
    loadReviewSessionDefinition(identity, canonicalDefinition),
  );
  const setDefinition: Dispatch<SetStateAction<GameDefinition>> = useCallback(
    (update) => {
      setDefinitionState((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        saveReviewSessionDefinition(identity, canonicalDefinition, next);
        return next;
      });
    },
    [canonicalDefinition, identity],
  );
  const resetDefinition = useCallback(() => {
    clearReviewSessionDefinition(identity);
    setDefinitionState(structuredClone(canonicalDefinition));
  }, [canonicalDefinition, identity]);
  return { definition, setDefinition, resetDefinition };
}

function browserSessionStorage(): ReviewSessionStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function isCompatibleEnvelope(
  candidate: unknown,
  identity: ReviewSessionIdentity,
  canonicalDefinition: GameDefinition,
): candidate is ReviewSessionEnvelope {
  if (!candidate || typeof candidate !== 'object') return false;
  const envelope = candidate as Partial<ReviewSessionEnvelope>;
  return (
    envelope.schemaVersion === REVIEW_SESSION_SCHEMA_VERSION &&
    envelope.baselineId === identity.baselineId &&
    envelope.surfaceId === identity.surfaceId &&
    envelope.fixtureId === identity.fixtureId &&
    envelope.semanticConfiguration === (identity.semanticConfiguration ?? 'default') &&
    envelope.canonicalGameId === canonicalDefinition.gameId &&
    envelope.definition !== undefined
  );
}
