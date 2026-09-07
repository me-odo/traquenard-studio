import { writeFile } from 'node:fs/promises';
import { axiomDescriptors } from '../packages/engine-core/src/index.ts';

const rows = axiomDescriptors
  .map(
    (axiom) =>
      `| \`${axiom.id}\` | ${axiom.version} | ${axiom.responsibility} | ${axiom.inputs.join(', ') || '—'} | ${axiom.outputs.join(', ') || '—'} | ${axiom.effects.join(', ') || '—'} | ${axiom.errors.join(', ') || '—'} |`,
  )
  .join('\n');
const document = `# Engine Axiom Registry\n\n> Generated from \`packages/engine-core/src/axioms.ts\`. Do not edit manually. Run \`pnpm docs:axioms\`.\n\nAll axioms are deterministic for explicit state, seed/RNG state, logical time, and ordered external inputs. Serialization uses the corresponding Game IR v1 discriminator; execution details and contract tests live with the registry.\n\n| Identifier | Version | Responsibility | Inputs | Outputs | Effects | Errors |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
await writeFile(new URL('../docs/generated/axioms.md', import.meta.url), document);
