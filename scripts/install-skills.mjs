import { cp, mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = new URL('../skills/', import.meta.url);
const codexHome = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'));
const target = pathToFileURL(`${join(codexHome, 'skills')}/`);
await mkdir(target, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isDirectory())
    await cp(new URL(`${entry.name}/`, source), new URL(`${entry.name}/`, target), {
      recursive: true,
      force: true,
    });
}
console.log(`Project skills installed into ${join(codexHome, 'skills')}.`);
