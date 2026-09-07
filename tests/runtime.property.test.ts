import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createSession, projectEvents, type Participant } from '@traquenard/engine-runtime';
import {
  referenceCardRound,
  referenceSequential,
} from '../packages/game-simulator/src/reference-games.js';

const participants: readonly Participant[] = [
  { id: 'p1', name: 'Host', isHost: true, required: true },
  { id: 'p2', name: 'Guest', isHost: false, required: true },
];

describe('runtime properties', () => {
  it('same artifact and internal semantic seed always produce the same initial semantic trace', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const options = {
          sessionId: 's',
          joinCode: 'CODE',
          artifact: referenceSequential,
          participants,
          semanticSeed: `property-seed:${seed}`,
        };
        expect(createSession(options)).toEqual(createSession(options));
      }),
      { seed: 20260907 },
    );
  });

  it('private participant payloads never project to a different viewer', () => {
    fc.assert(
      fc.property(fc.constantFrom('p1', 'p2'), (viewer) => {
        const session = createSession({
          sessionId: 's',
          joinCode: 'CODE',
          artifact: referenceCardRound,
          participants,
          semanticSeed: 'property-seed:7',
        });
        const projection = JSON.stringify(projectEvents(session, viewer));
        expect(projection.includes('Your private card')).toBe(viewer === 'p2');
      }),
      { seed: 20260907 },
    );
  });
});
