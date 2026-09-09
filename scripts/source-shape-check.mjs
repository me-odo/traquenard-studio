import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceShapeExceptions } from './source-shape-exceptions.mjs';

export const SOURCE_SHAPE_SOFT_LIMIT = 500;
export const SOURCE_SHAPE_HARD_LIMIT = 800;

const SOURCE_GROUPS = ['apps', 'packages'];

export function classifySourcePath(path) {
  const normalized = path.split(sep).join('/');
  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (!/^(apps|packages)\/[^/]+\/src\/.+\.tsx?$/.test(normalized)) return 'outside';
  if (basename.endsWith('.d.ts')) return 'declaration';
  if (/\.(test|spec)\.tsx?$/.test(basename) || /\/(?:__tests__|tests?)\//.test(normalized))
    return 'test';
  if (/\/(?:fixtures?|__fixtures__)\//.test(normalized)) return 'fixture';
  if (/\/(?:generated|__generated__)\//.test(normalized) || /\.generated\.tsx?$/.test(basename))
    return 'generated';
  if (/\/migrations?\//.test(normalized)) return 'migration';
  return 'production';
}

export function countSourceLines(source) {
  if (source.length === 0) return 0;
  const lines = source.split(/\r?\n/).length;
  return source.endsWith('\n') ? lines - 1 : lines;
}

export function collectSourceInventory(repositoryRoot) {
  return SOURCE_GROUPS.flatMap((sourceGroup) => {
    const groupRoot = join(repositoryRoot, sourceGroup);
    if (!statSync(groupRoot, { throwIfNoEntry: false })?.isDirectory()) return [];
    return readdirSync(groupRoot).flatMap((packageName) => {
      const sourceRoot = join(groupRoot, packageName, 'src');
      return statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory() ? walk(sourceRoot) : [];
    });
  })
    .filter((path) => ['.ts', '.tsx'].includes(extname(path)))
    .map((path) => {
      const repositoryPath = relative(repositoryRoot, path).split(sep).join('/');
      return {
        path: repositoryPath,
        lines: countSourceLines(readFileSync(path, 'utf8')),
        category: classifySourcePath(repositoryPath),
      };
    })
    .filter((entry) => entry.category !== 'outside')
    .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
}

export function evaluateSourceShape(
  inventory,
  exceptions,
  { softLimit = SOURCE_SHAPE_SOFT_LIMIT, hardLimit = SOURCE_SHAPE_HARD_LIMIT } = {},
) {
  const failures = [];
  const warnings = [];
  const entriesByPath = new Map(inventory.map((entry) => [entry.path, entry]));
  if (!isPlainObject(exceptions)) {
    failures.push('Source-shape exceptions must be an object keyed by exact repository path.');
    return { failures, warnings };
  }
  for (const [path, metadata] of Object.entries(exceptions)) {
    if (
      !isPlainObject(metadata) ||
      typeof metadata.reason !== 'string' ||
      !metadata.reason.trim()
    ) {
      failures.push(`Source-shape exception ${path} must include a non-empty reason.`);
      continue;
    }
    if (
      'issue' in metadata &&
      metadata.issue !== null &&
      (typeof metadata.issue !== 'string' || !metadata.issue.trim())
    )
      failures.push(`Source-shape exception ${path} has malformed issue metadata.`);
    const entry = entriesByPath.get(path);
    if (!entry) failures.push(`Source-shape exception ${path} points to a nonexistent file.`);
    else if (entry.category !== 'production')
      failures.push(`Source-shape exception ${path} does not identify production source.`);
  }
  for (const entry of inventory) {
    if (entry.category !== 'production' || exceptions[entry.path]) continue;
    if (entry.lines > hardLimit)
      failures.push(
        `SOURCE SHAPE FAILURE\n${entry.path} — ${entry.lines} lines\nHard limit: ${hardLimit}.\nSplit by durable ownership or add a reviewed exception with rationale.`,
      );
    else if (entry.lines > softLimit)
      warnings.push(
        `SOURCE SHAPE WARNING\n${entry.path} — ${entry.lines} lines\nReview whether this module owns multiple responsibilities.`,
      );
  }
  return { failures, warnings };
}

export function runSourceShapeCheck(
  repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..'),
) {
  const inventory = collectSourceInventory(repositoryRoot);
  const result = evaluateSourceShape(inventory, sourceShapeExceptions);
  for (const warning of result.warnings) console.warn(warning);
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(failure);
    return false;
  }
  console.log(
    `Source-shape checks passed (${SOURCE_SHAPE_SOFT_LIMIT} soft / ${SOURCE_SHAPE_HARD_LIMIT} hard; ${String(result.warnings.length)} warning(s)).`,
  );
  return true;
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === invokedPath && !runSourceShapeCheck()) process.exitCode = 1;
