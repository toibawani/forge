import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke coverage for the loop the product exists for: sign up, practise, see a
 * score, see it on the dashboard. It runs against a real database because every
 * interesting failure in that loop is a database one.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["line"]] : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The runner has to work on a phone: keyboard, touch targets, no horizontal scroll.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
