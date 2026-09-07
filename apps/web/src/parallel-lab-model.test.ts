import { describe, expect, it } from 'vitest';
import { validateDefinition } from '@traquenard/game-validator';
import {
  addEmptyBranch,
  branchesFromFixture,
  insertBranchOperation,
  parallelContext,
  parallelFixtures,
  removeBranch,
} from './parallel-lab-model.js';

describe('parallel visual lab model', () => {
  it('provides valid v1 all-join fixtures with the expected branch stress cases', () => {
    expect(
      parallelFixtures.map(
        (fixture) => parallelContext(fixture.definition).parallel.branches.length,
      ),
    ).toEqual([2, 3, 3, 6]);

    for (const fixture of parallelFixtures) {
      const parallel = parallelContext(fixture.definition).parallel;
      expect(parallel.join).toBe('all');
      expect(validateDefinition(fixture.definition)).toEqual({ valid: true, issues: [] });
    }
  });

  it('keeps authoring interaction state separate from the canonical fixture', () => {
    const definition = parallelFixtures[1]!.definition;
    const canonicalBefore = JSON.stringify(definition);
    const original = branchesFromFixture(definition);
    const withEmptyBranch = addEmptyBranch(original);
    const emptyBranch = withEmptyBranch.at(-1)!;
    const withTimer = insertBranchOperation(withEmptyBranch, emptyBranch.id, 'time.wait');
    const restored = removeBranch(withTimer, emptyBranch.id);

    expect(original).toHaveLength(3);
    expect(withEmptyBranch).toHaveLength(4);
    expect(withTimer.at(-1)!.operation?.kind).toBe('time.wait');
    expect(restored).toEqual(original);
    expect(JSON.stringify(definition)).toBe(canonicalBefore);
  });
});
