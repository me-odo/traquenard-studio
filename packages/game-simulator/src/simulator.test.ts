import { describe, expect, it } from 'vitest';
import { referenceArtifacts, simulateGame } from './index.js';

describe('canonical reference games', () => {
  it.each(referenceArtifacts.map((artifact) => [artifact.definition.title, artifact] as const))(
    'executes %s to a terminal state',
    (_title, artifact) => {
      const result = simulateGame(artifact, 1);
      expect(result.session.status).toBe('completed');
      expect(result.session.eventLog.at(-1)?.payload.kind).toBe('execution.completed');
    },
  );
});
