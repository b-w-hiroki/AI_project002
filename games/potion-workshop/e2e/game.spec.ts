import { expect, test } from "@playwright/test";

const SAVE_KEY = "ai_project002_save_v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(600);
});

async function canvasSize(page: import("@playwright/test").Page): Promise<{ width: number; height: number }> {
  return page.locator("canvas").evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
}

async function clickBrew(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const logical = await canvasSize(page);
  const portrait = logical.height > logical.width;
  const brew = portrait ? { x: 225, y: 365 } : { x: 335, y: 246 };
  await page.mouse.click(
    box.x + brew.x * (box.width / logical.width),
    box.y + brew.y * (box.height / logical.height),
  );
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

test("縦持ちと横持ちでゲーム面が切り替わる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  await expect.poll(async () => (await canvasSize(page)).width).toBe(450);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await canvasSize(page)).width).toBe(800);
  await expect.poll(async () => (await canvasSize(page)).height).toBe(450);
});

test("進行状況が localStorage に自動セーブされる", async ({ page }) => {
  await clickBrew(page);

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
