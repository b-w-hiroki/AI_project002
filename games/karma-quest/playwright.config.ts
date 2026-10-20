import { defineConfig } from "@playwright/test";

const chromiumPath = process.env.PW_CHROMIUM_PATH;
const e2ePort = process.env.KARMA_E2E_PORT ?? "15177";
// Match the readiness probe, browser, and Vite listener without localhost DNS selection.
const e2eHost = "127.0.0.1";
const e2eUrl = `http://${e2eHost}:${e2ePort}`;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: e2eUrl,
    // Use an explicit local browser, or Playwright-managed Chromium in CI.
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: `npm run dev -- --host ${e2eHost} --port ${e2ePort} --strictPort`,
    url: e2eUrl,
    // Opt in only for local checks while a separate long-running soak owns Vite.
    reuseExistingServer: process.env.KARMA_REUSE_SERVER === "1",
  },
});
