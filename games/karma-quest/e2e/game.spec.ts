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

test("touch starts a journey and a choice records a deed after rotation", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapPoint(page, 225, 650);
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 5000 }).toBe(0);
  await checkFrame(page, "portrait-karma");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  const before = await page.locator("canvas").screenshot();
  await tapPoint(page, 510, 385);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await expect.poll(() => phase(page)).not.toBe("karma");
  await checkFrame(page, "landscape-after-choice");
});

test("portrait choice keeps the approved visual mock skeleton", async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 800 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const startRun = Reflect.get(scene, "startRun");
    if (typeof startRun === "function") startRun.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 5000 }).toBe(0);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "currentRequest", { faction: "warrior", text: "実戦で腕試しがしたい…", karmaDelta: 8 });
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-choice-mock.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.002,
  });
});
