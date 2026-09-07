import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = [
  'packages/game-ir',
  'packages/game-validator',
  'packages/engine-core',
  'packages/engine-runtime',
  'packages/authoring-domain',
  'packages/multiplayer-protocol',
];
const forbidden = {
  'packages/game-ir': [
    'react',
    'fastify',
    '@traquenard/authoring-domain',
    '@traquenard/engine-runtime',
  ],
  'packages/game-validator': [
    'react',
    'fastify',
    '@traquenard/authoring-domain',
    '@traquenard/engine-runtime',
  ],
  'packages/engine-core': [
    'node:',
    'react',
    'fastify',
    '@traquenard/authoring-domain',
    '@traquenard/engine-runtime',
    'kysely',
    'pg',
  ],
  'packages/engine-runtime': ['react', 'fastify', '@traquenard/authoring-domain', 'kysely', 'pg'],
  'packages/authoring-domain': [
    'react',
    '@dnd-kit',
    '@traquenard/engine-core',
    '@traquenard/engine-runtime',
  ],
  'packages/multiplayer-protocol': [
    'react',
    'fastify',
    '@traquenard/engine-core',
    '@traquenard/engine-runtime',
  ],
};
const failures = [];
for (const root of roots) {
  for (const file of walk(join(root, 'src'))) {
    const source = readFileSync(file, 'utf8');
    for (const dependency of forbidden[root])
      if (source.includes(`from '${dependency}`) || source.includes(`from "${dependency}`))
        failures.push(`${relative('.', file)} imports forbidden ${dependency}`);
    if (root === 'packages/engine-core') {
      for (const token of ['Math.random(', 'Date.now(', 'setTimeout(', 'setInterval('])
        if (source.includes(token)) failures.push(`${relative('.', file)} uses forbidden ${token}`);
    }
  }
}
const protocol = readFileSync('packages/multiplayer-protocol/src/index.ts', 'utf8');
for (const trustedKind of ['time.advance', 'participant.disconnected', 'participant.reconnected'])
  if (protocol.includes(`z.literal('${trustedKind}')`))
    failures.push(`public multiplayer protocol exposes trusted system input ${trustedKind}`);

const authoring = readFileSync('packages/authoring-domain/src/index.ts', 'utf8');
if (!authoring.includes('type TypeRef') || !authoring.includes('sameType('))
  failures.push('authoring compatibility must derive from Game IR TypeRef semantics');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Architecture dependency and engine-purity checks passed.');

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}
