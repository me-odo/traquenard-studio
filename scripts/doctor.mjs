import { execFileSync } from 'node:child_process';

const checks = [];
function command(name, args = ['--version'], required = true) {
  try {
    const output = execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .trim()
      .split('\n')[0];
    checks.push({ name, ok: true, required, detail: output });
    return output;
  } catch {
    checks.push({
      name,
      ok: false,
      required,
      detail: required
        ? 'missing — install it before continuing'
        : 'optional integration unavailable',
    });
    return '';
  }
}

const nodeVersion = process.versions.node;
const nodeMajor = Number(nodeVersion.split('.')[0]);
checks.push({
  name: 'node',
  ok: nodeMajor === 24,
  required: true,
  detail:
    nodeMajor === 24
      ? `${nodeVersion} (supported LTS)`
      : `${nodeVersion} — use Node 24.x from .nvmrc`,
});
command('pnpm');
command('git');
command('docker', ['--version'], false);
command('gh', ['--version'], false);
try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  checks.push({ name: 'GitHub auth', ok: true, required: false, detail: 'authenticated' });
} catch {
  checks.push({
    name: 'GitHub auth',
    ok: false,
    required: false,
    detail: 'optional — run gh auth login to manage issues or push',
  });
}
checks.push({
  name: 'DATABASE_URL',
  ok: Boolean(process.env.DATABASE_URL),
  required: false,
  detail: process.env.DATABASE_URL ? 'configured' : 'optional — in-memory runtime is the default',
});

for (const check of checks)
  console.log(`${check.ok ? '✓' : check.required ? '✗' : '○'} ${check.name}: ${check.detail}`);
if (checks.some((check) => check.required && !check.ok)) process.exitCode = 1;
