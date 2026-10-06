import { defineConfig } from '@playwright/test';
import { WEB_ORIGIN } from './fixtures.js';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: WEB_ORIGIN,
    browserName: 'chromium',
    headless: true,
    launchOptions: process.env.P11_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.P11_CHROMIUM_EXECUTABLE }
      : {},
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
});
