import { expect, test } from "@playwright/test";

const GAME_W = 800;
const GAME_H = 760;
const BREW_X = 160;
const BREW_Y = 260;
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

  // 起動直後の1フレーム目は読み込み待ち分のdeltaが大きく計上され、クリック前でも
  // ほぼ即座に1回目の自動保存が走ることがある（totalBrewed: 0のまま）。
  // localStorageが非nullになったことだけを見ると、そのクリック前のスナップショットを
  // 拾って誤判定するため、クリックの効果（totalBrewed >= 1）が反映されるまで直接ポーリングする。
  await expect
    .poll(
      async () => {
        const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
        if (!raw) return 0;
        return JSON.parse(raw).state.totalBrewed;
      },
      { timeout: 15_000, intervals: [500, 1_000, 1_500] },
    )
    .toBeGreaterThanOrEqual(1);
});
