import { expect, test } from "@playwright/test";

const GAME_W = 800;
const GAME_H = 760;
const BREW_X = 205;
const BREW_Y = 446;
const SAVE_KEY = "ai_project002_save_v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(600); // 初回描画待ち
});

async function clickBrew(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const sx = box.width / GAME_W;
  const sy = box.height / GAME_H;
  await page.mouse.click(box.x + BREW_X * sx, box.y + BREW_Y * sy);
}

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("大釜をクリックするとポーションが増える（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await clickBrew(page);
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("進行状況が localStorage に自動セーブされる", async ({ page }) => {
  await clickBrew(page);

  // Scene側はフレームdeltaの累積5秒で保存する。ソフトウェア描画のCIでは低FPSになり、
  // 実時間5.5秒より遅れて閾値へ届くことがあるため、固定sleepではなく保存発火を待つ。
  await expect
    .poll(
      () => page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
      { timeout: 15_000, intervals: [500, 1_000, 1_500] },
    )
    .not.toBeNull();

  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const data = JSON.parse(raw!);
  expect(data.state.totalBrewed).toBeGreaterThanOrEqual(1);
});
