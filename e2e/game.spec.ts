import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(600); // 初回描画待ち
});

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("調合ボタンをクリックするとポーションが増える（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  // 調合ボタン（キャンバス座標 180,300 付近）をクリック
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 800;
  await page.mouse.click(box.x + 180 * scale, box.y + 300 * scale);
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("進行状況が localStorage に自動セーブされる", async ({ page }) => {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 800;
  await page.mouse.click(box.x + 180 * scale, box.y + 300 * scale);
  await page.waitForTimeout(5_500); // セーブ間隔5秒を待つ
  const raw = await page.evaluate(() => localStorage.getItem("ai_project002_save_v1"));
  expect(raw).not.toBeNull();
  const data = JSON.parse(raw!);
  expect(data.state.totalBrewed).toBeGreaterThanOrEqual(1);
});
