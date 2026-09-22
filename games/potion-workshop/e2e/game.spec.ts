import { expect, test } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";

declare global { interface Window { __qaGame: Phaser.Game } }

const SAVE_KEY = "ai_project002_save_v1";

test.beforeEach(async ({ page }) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.waitForTimeout(600);
});

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
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

test("portrait and landscape workshop are captured for visual QA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/portrait-workshop.png", animations: "disabled" });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await canvasSize(page)).width).toBe(800);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/landscape-workshop.png", animations: "disabled" });
});

test("visual QA: brewing shows a magical burst", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  await clickBrew(page);
  await page.waitForTimeout(90);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-brew-burst.png",
    animations: "disabled",
  });
});



test("prestige opens two town choices and moves to the selected town", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });
  const initial = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      potions: 2_000_000,
      totalBrewed: 1_000_000,
      lifetimeBrewed: Math.max(Number(state.lifetimeBrewed ?? 0), 1_000_000),
      prestigeCount: 0,
      townIndex: 0,
    });
    Reflect.get(scene, "showTownChoice").call(scene);
    const modal = Reflect.get(scene, "townChoiceModal") as Phaser.GameObjects.Container;
    const names = modal.list
      .filter(node => node.type === "Zone" && node.name.startsWith("town-choice-"))
      .map(node => node.name);
    return { names, state: Reflect.get(scene, "state") };
  });
  expect(initial.names).toEqual(["town-choice-1", "town-choice-2"]);

  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-town-choice.png",
    animations: "disabled",
  });

  const next = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const modal = Reflect.get(scene, "townChoiceModal") as Phaser.GameObjects.Container;
    const choose = modal.getData("chooseTown") as (townIndex: number) => void;
    choose(2);
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    return {
      townIndex: state.townIndex,
      prestigeCount: state.prestigeCount,
      essence: state.essence,
    };
  });
  expect(next.townIndex).toBe(2);
  expect(next.prestigeCount).toBe(1);
  expect(Number(next.essence)).toBeGreaterThanOrEqual(1);

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(saved.state.townIndex).toBe(2);
  expect(saved.state.prestigeCount).toBe(1);
});

test("visual QA: all workshop generators have distinct shelf silhouettes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      counts: {
        apprentice: 1,
        cauldron: 1,
        garden: 1,
        golem: 1,
        portal: 1,
        observatory: 1,
        dragon: 1,
        worldTree: 1,
      },
    });
    Reflect.get(scene, "refreshWorkshopDecor").call(scene);
  });
  await page.waitForTimeout(80);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-workshop-all-equipment.png",
    animations: "disabled",
  });
});

