import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./web",
  outputDir: "./test-results",
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 420, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx expo start --web --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    cwd: "..",
  },
});
