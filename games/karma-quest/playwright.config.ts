import { defineConfig } from "@playwright/test";

const chromiumPath = process.env.PW_CHROMIUM_PATH;
const e2ePort = process.env.KARMA_E2E_PORT ?? "15177";
const e2eUrl = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: e2eUrl,
    // Use an explicit local browser, or Playwright-managed Chromium in CI.
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: e2eUrl,
    // Opt in only for local checks while a separate long-running soak owns Vite.
    reuseExistingServer: process.env.KARMA_REUSE_SERVER === "1",
  },
});
