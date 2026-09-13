import { expect, test, type Page } from "@playwright/test";

async function clickGamePoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  const size = await canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });
  if (!box || !size.width || !size.height) throw new Error("canvas bounds unavailable");
  await canvas.click({
    position: {
      x: (x / size.width) * box.width,
      y: (y / size.height) * box.height,
    },
  });
}

async function enterBattle(page: Page): Promise<void> {
  // LoadoutScene: ステージ開始は論理座標 (400, 545)。
  await clickGamePoint(page, 400, 545);
  await page.waitForTimeout(350);

  // GameScene開始直後の型選択では左側（連撃の型）を選ぶ。
  // Responsive適用後も zone の中心は論理座標 (220, 320) 付近。
  await clickGamePoint(page, 220, 320);
  await page.waitForTimeout(700);
}

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

test("visual QA: phone portrait battle 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(500);
  await enterBattle(page);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/side-portrait-battle-390x844.png",
    animations: "disabled",
  });
});

test("visual QA: phone landscape battle 844x390", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(500);
  await enterBattle(page);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/side-landscape-battle-844x390.png",
    animations: "disabled",
  });
});
