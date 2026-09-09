import { describe, expect, it } from 'vitest';
import { classifySourcePath, evaluateSourceShape } from './source-shape-check.mjs';

const production = (path, lines) => ({ path, lines, category: 'production' });

describe('source-shape checker', () => {
  it('passes production files below the soft budget', () => {
    expect(evaluateSourceShape([production('apps/web/src/Small.tsx', 499)], {})).toEqual({
      failures: [],
      warnings: [],
    });
  });

  it('warns above the soft budget', () => {
    const result = evaluateSourceShape([production('apps/web/src/Review.tsx', 501)], {});
    expect(result.failures).toEqual([]);
    expect(result.warnings[0]).toContain('SOURCE SHAPE WARNING');
  });

  it('fails above the hard ceiling', () => {
    const result = evaluateSourceShape([production('packages/example/src/Huge.ts', 801)], {});
    expect(result.failures[0]).toContain('SOURCE SHAPE FAILURE');
  });

  it('classifies tests and fixtures outside production enforcement', () => {
    expect(classifySourcePath('apps/web/src/example.test.ts')).toBe('test');
    expect(classifySourcePath('packages/example/src/fixtures/catalog.ts')).toBe('fixture');
    const inventory = [
      { path: 'apps/web/src/example.test.ts', lines: 900, category: 'test' },
      { path: 'packages/example/src/fixtures/catalog.ts', lines: 900, category: 'fixture' },
    ];
    expect(evaluateSourceShape(inventory, {}).failures).toEqual([]);
  });

  it('accepts an explicit valid exception', () => {
    const path = 'packages/example/src/Registry.ts';
    const result = evaluateSourceShape([production(path, 900)], {
      [path]: {
        reason: 'Static declarative registry with no behavioral orchestration.',
        issue: null,
      },
    });
    expect(result).toEqual({ failures: [], warnings: [] });
  });

  it('rejects stale exception paths', () => {
    const result = evaluateSourceShape([], {
      'packages/example/src/Missing.ts': { reason: 'Temporary debt.', issue: '#10' },
    });
    expect(result.failures[0]).toContain('nonexistent file');
  });

  it('rejects exceptions without a reason', () => {
    const path = 'packages/example/src/Huge.ts';
    const result = evaluateSourceShape([production(path, 900)], { [path]: { issue: '#10' } });
    expect(result.failures[0]).toContain('non-empty reason');
  });
});
