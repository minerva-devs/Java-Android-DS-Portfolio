import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Anchor Engine
 * 
 * Location: playwright.config.ts
 * Spec: ux-ui-recursion-workflow.md (Testing Workflow section)
 */

export default defineConfig({
  // Base URL where the engine is running
  baseURL: 'http://localhost:3160',

  // Test directory - all .test.ts files in tests/e2e/
  testDir: './tests/e2e',

  // Run tests in headless mode (no visible browser)
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Fail if 'only' is used in CI
  retries: process.env.CI ? 2 : 0, // Retry twice on CI, no retries locally
  reporter: [
    ['html', { outputFolder: '.anchor/test-output/playwright/report' }],
    ['json', { outputFile: '.anchor/test-output/playwright/report.json' }],
    ['list'], // Console-friendly list format
  ],

  // Use real engine API calls (no mock servers)
  use: {
    baseURL: 'http://localhost:3160',
    trace: 'on-first-retry', // Save traces on first retry for debugging
    screenshot: 'only-on-failure', // Take screenshots only on failure
    video: 'retain-on-failure', // Keep videos of failed tests
    screenshot: { path: '.anchor/test-output/playwright/screenshots' }, // Store screenshots in .anchor
    video: { dir: '.anchor/test-output/playwright/videos' }, // Store videos in .anchor
  },

  // Configure projects for different browsers (optional)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test other browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Timeout for each test (60 seconds - slower operations need this)
  timeout: 60 * 1000,

  // Expect tests to fail if they don't complete within this time
  expect: {
    timeout: 5000,
  },

  // Configure web server for local testing (optional - we use direct localhost)
  // webServer: {
  //   command: 'pnpm start',
  //   url: 'http://localhost:3160',
  //   reuseExistingServer: !process.env.CI,
  // },
});
