import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The mobile suite sets its own device profile, so it would otherwise
      // run twice with the desktop one fighting it.
      testIgnore: /reader-mobile\.spec\.ts/,
    },
    {
      name: 'pixel-7',
      testMatch: /reader-mobile\.spec\.ts/,
    },
  ],
})
