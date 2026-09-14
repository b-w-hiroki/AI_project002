import { defineConfig } from "@playwright/test";

const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:15178",
    // Use an explicit local browser, or Playwright-managed Chromium in CI.
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: "npm run dev -- --port 15178",
    url: "http://localhost:15178",
    reuseExistingServer: false,
  },
});
