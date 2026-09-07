import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173',
    env: {
      NODE_ENV: 'test',
      TRAQUENARD_TEST_SEMANTIC_SEED: 'server-test:2',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
