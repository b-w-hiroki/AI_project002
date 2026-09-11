import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const SANDBOX_CHROMIUM_PATH = "/opt/pw-browsers/chromium";
// リモートコンテナではプリインストール済み Chromium を使う（playwright install 不要）。
// GitHub Actions 等、そのパスが存在しない環境では未指定のままにし、
// `playwright install` で通常インストールされたブラウザを使わせる。
const chromiumExecutablePath =
  process.env.PW_CHROMIUM_PATH ?? (existsSync(SANDBOX_CHROMIUM_PATH) ? SANDBOX_CHROMIUM_PATH : undefined);

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5174",
    launchOptions: {
      executablePath: chromiumExecutablePath,
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
  },
});
