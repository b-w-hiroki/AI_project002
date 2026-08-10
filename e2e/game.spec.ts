import { expect, test } from "@playwright/test";

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(500); // 初回描画待ち
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("カーソルキーでプレイヤーが動く（画面が変化する）", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(500);
  const before = await page.locator("canvas").screenshot();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowRight");
  const after = await page.locator("canvas").screenshot();
  expect(before.equals(after)).toBe(false);
});
