import { defineConfig } from "@playwright/test";

const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5174",
    // PW_CHROMIUM_PATH が明示された環境だけ外部 Chromium を使う。
    // GitHub Actions では `playwright install chromium` が管理するブラウザを自動解決する。
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
  },
});
