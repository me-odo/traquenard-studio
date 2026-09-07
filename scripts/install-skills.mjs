import { cp, mkdir, readdir } from 'node:fs/promises';

const source = new URL('../skills/', import.meta.url);
const target = new URL('../.agents/skills/', import.meta.url);
await mkdir(target, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isDirectory())
    await cp(new URL(`${entry.name}/`, source), new URL(`${entry.name}/`, target), {
      recursive: true,
      force: true,
    });
}
console.log('Project skills installed into .agents/skills.');
