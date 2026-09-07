import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const directory of [
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'apps/web/dist',
]) {
  await rm(resolve(process.cwd(), directory), { recursive: true, force: true });
}
