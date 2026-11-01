import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const caminhoHeadlessShellLocal =
  'C:/Users/rafae/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    launchOptions: existsSync(caminhoHeadlessShellLocal)
      ? {
          executablePath: caminhoHeadlessShellLocal,
          args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
        }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
