import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const checks = [];
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const pinnedPnpm = packageJson.packageManager.split('@')[1];

function command(name, args = ['--version'], required = true, validate = () => true) {
  try {
    const output = execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .trim()
      .split('\n')[0];
    const ok = validate(output);
    checks.push({ name, ok, required, detail: ok ? output : `${output} — expected ${pinnedPnpm}` });
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
checks.push({
  name: 'nvm environment',
  ok: Boolean(process.env.NVM_BIN),
  required: false,
  detail: process.env.NVM_BIN
    ? process.env.NVM_BIN
    : 'optional — run ./scripts/setup-local.sh to activate .nvmrc',
});
command('corepack');
command('pnpm', ['--version'], true, (version) => version === pinnedPnpm);
command('git');
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
const docker = command('docker', ['--version'], false);
if (docker) {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    checks.push({ name: 'Docker daemon', ok: true, required: false, detail: 'available' });
  } catch {
    checks.push({
      name: 'Docker daemon',
      ok: false,
      required: false,
      detail: 'optional — start Docker Desktop for persistence integration',
    });
  }
}

try {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { chromium } from '@playwright/test'; import { existsSync } from 'node:fs'; process.stdout.write(String(existsSync(chromium.executablePath())));",
    ],
    { encoding: 'utf8' },
  );
  checks.push({
    name: 'Playwright Chromium',
    ok: result === 'true',
    required: true,
    detail: result === 'true' ? 'installed' : 'missing — run pnpm exec playwright install chromium',
  });
} catch {
  checks.push({
    name: 'Playwright Chromium',
    ok: false,
    required: true,
    detail: 'missing — run pnpm exec playwright install chromium',
  });
}

const codexHome = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'));
const requiredSkills = [
  'axiom-design-review',
  'feature-change',
  'github-issue-triage',
  'regression-verification',
  'ux-experiment',
];
const missingSkills = requiredSkills.filter(
  (skill) => !existsSync(join(codexHome, 'skills', skill, 'SKILL.md')),
);
checks.push({
  name: 'project Skills',
  ok: missingSkills.length === 0,
  required: true,
  detail:
    missingSkills.length === 0
      ? `installed in ${join(codexHome, 'skills')}`
      : `missing ${missingSkills.join(', ')} — run pnpm skills:install`,
});
checks.push({
  name: 'DATABASE_URL',
  ok: Boolean(process.env.DATABASE_URL),
  required: false,
  detail: process.env.DATABASE_URL ? 'configured' : 'optional — in-memory runtime is the default',
});

for (const check of checks)
  console.log(`${check.ok ? '✓' : check.required ? '✗' : '○'} ${check.name}: ${check.detail}`);
if (checks.some((check) => check.required && !check.ok)) process.exitCode = 1;
