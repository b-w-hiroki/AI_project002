import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(500); // 初回描画待ち
});

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("右キーでプレイヤーが移動する（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("攻撃キー(X)で剣の演出が表示される", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.keyboard.press("x");
  await page.waitForTimeout(80); // 攻撃判定の有効時間内
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("visual QA: phone portrait 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: "e2e/screenshots/side-portrait-390x844.png", animations: "disabled" });
});

test("visual QA: phone landscape 844x390", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: "e2e/screenshots/side-landscape-844x390.png", animations: "disabled" });
});
