import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { axiomDescriptors } from '../packages/engine-core/src/index.ts';

const rows = axiomDescriptors
  .map(
    (axiom) =>
      `| \`${axiom.id}\` | ${axiom.version} | ${axiom.responsibility} | ${axiom.inputs.join(', ') || '—'} | ${axiom.outputs.join(', ') || '—'} | ${axiom.effects.join(', ') || '—'} | ${axiom.errors.join(', ') || '—'} |`,
  )
  .join('\n');
const document = await format(
  `# Engine Axiom Registry\n\n> Generated from \`packages/engine-core/src/axioms.ts\`. Do not edit manually. Run \`pnpm docs:axioms\`.\n\nAll axioms are deterministic for explicit state, private seed/RNG state, logical time, and ordered external inputs. Serialization uses the corresponding Game IR v1 discriminator; execution details and contract tests live with the registry.\n\n| Identifier | Version | Responsibility | Inputs | Outputs | Effects | Errors |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`,
  { parser: 'markdown' },
);
const output = new URL('../docs/generated/axioms.md', import.meta.url);
if (process.argv.includes('--check')) {
  const current = await readFile(output, 'utf8');
  if (current !== document) {
    console.error('Generated axiom documentation is stale. Run `pnpm docs:axioms`.');
    process.exit(1);
  }
} else await writeFile(output, document);
