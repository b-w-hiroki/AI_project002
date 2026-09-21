import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";

declare global { interface Window { __qaGame: Phaser.Game } }

const errors = new WeakMap<Page, string[]>();
test.use({ hasTouch: true, locale: "ja-JP", viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", error => messages.push(error.message));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

async function tapPoint(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const size = await canvas.evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
}

const phase = (page: Page) => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "phase"));

async function checkFrame(page: Page, name: string) {
  await expect.poll(async () => {
    const box = await page.locator("canvas").boundingBox();
    const viewport = page.viewportSize()!;
    return !!box && box.width > 0 && box.height > 0 && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1;
  }).toBe(true);
  await expect.poll(async () => page.locator("canvas").evaluate(node => {
    const canvas = node as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    return Math.abs(box.width / box.height - canvas.width / canvas.height);
  })).toBeLessThan(0.02);
  await page.screenshot({ path: "e2e/screenshots/" + name + ".png" });
}

test("touch starts a challenge and rotation preserves play", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapPoint(page, 225, 705);
  await expect.poll(() => phase(page)).toBe("playing");
  await checkFrame(page, "portrait-play");
  const portraitBefore = await page.locator("canvas").screenshot();
  await tapPoint(page, 128, 390);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(portraitBefore)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  const before = await page.locator("canvas").screenshot();
  await tapPoint(page, 470, 170);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await checkFrame(page, "landscape-play");
});

test("portrait result keeps the mock hierarchy", async ({ page }) => {
  await tapPoint(page, 225, 705);
  await expect.poll(() => phase(page)).toBe("playing");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "sessionRemaining", 1));
  await expect.poll(() => phase(page)).toBe("result");
  await checkFrame(page, "portrait-result");
});

test("high-accuracy result shows an S grade in portrait and landscape", async ({ page }) => {
  await tapPoint(page, 225, 705);
  await expect.poll(() => phase(page)).toBe("playing");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "results", Array.from({ length: 12 }, (_, index) => ({
      correct: true,
      timedOut: false,
      reactionMs: 620 + index * 8,
      mode: index % 2 === 0 ? "content" : "color",
      switched: index % 3 === 0,
    })));
    Reflect.set(scene, "turboPoints", 18);
    Reflect.get(scene, "endSession").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await page.waitForTimeout(280);
  await checkFrame(page, "portrait-result-grade-s");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await checkFrame(page, "landscape-result-grade-s");
});

test("landscape FLOW mode gets a visible board aura", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSession").call(scene);
    Reflect.set(scene, "turboStreak", 5);
    Reflect.set(scene, "turboPoints", 12);
  });
  await expect.poll(() => phase(page)).toBe("playing");
  await page.waitForTimeout(100);
  await checkFrame(page, "landscape-flow-aura");
});

