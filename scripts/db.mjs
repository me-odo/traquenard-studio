import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const action = process.argv[2];
if (!['migrate', 'reset'].includes(action))
  throw new Error('Usage: node scripts/db.mjs migrate|reset');
const connection =
  process.env.DATABASE_URL ?? 'postgres://traquenard:traquenard@localhost:5432/traquenard';
if (new URL(connection).pathname !== '/traquenard')
  throw new Error('Refusing database operation: DATABASE_URL database must be exactly traquenard.');
if (action === 'reset') {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'traquenard',
      '-d',
      'traquenard',
      '-c',
      'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ],
    { stdio: 'inherit' },
  );
}
const migration = readFileSync(
  new URL('../apps/server/migrations/001_initial.sql', import.meta.url),
  'utf8',
);
execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'traquenard', '-d', 'traquenard'],
  { input: migration, stdio: ['pipe', 'inherit', 'inherit'] },
);
