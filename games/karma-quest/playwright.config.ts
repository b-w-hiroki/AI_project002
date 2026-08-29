import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5174",
    // リモートコンテナのプリインストール Chromium を使う（playwright install は不要）
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
  },
});
