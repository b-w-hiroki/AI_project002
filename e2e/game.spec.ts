import { expect, test } from "@playwright/test";

const GAME_W = 800;
const GAME_H = 760;
const BREW_X = 160;
const BREW_Y = 260;

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

test("調合ボタンをクリックするとポーションが増える（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await clickBrew(page);
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("進行状況が localStorage に自動セーブされる", async ({ page }) => {
  await clickBrew(page);
  await page.waitForTimeout(5_500); // セーブ間隔5秒を待つ
  const raw = await page.evaluate(() => localStorage.getItem("ai_project002_save_v1"));
  expect(raw).not.toBeNull();
  const data = JSON.parse(raw!);
  expect(data.state.totalBrewed).toBeGreaterThanOrEqual(1);
});
