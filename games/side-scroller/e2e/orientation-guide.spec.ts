import { expect, test } from "@playwright/test";
import type Phaser from "phaser";
declare global { interface Window { __qaGame: Phaser.Game } }
for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`loadout rotation guide ${viewport.width}`, async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport, hasTouch: true });
    await page.route("**/src/main.ts", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
    });
    await page.goto(`${baseURL}/?lang=ja&visualqa=battle`);
    const guide = page.locator(".orientation-guide");
    await expect(guide).toBeVisible();
    await expect(guide.locator("h1")).toHaveText("横向きにして、森へ");
    await expect.poll(() => guide.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await guide.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    expect(await page.evaluate(() => window.__qaGame.scene.isActive("LoadoutScene"))).toBe(true);
    expect(await page.evaluate(() => window.__qaGame.scene.getScene("LoadoutScene").input.enabled)).toBe(false);
    await page.screenshot({ path: `e2e/screenshots/orientation-guide-${viewport.width}.png` });
    for (let turn = 0; turn < 2; turn++) {
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await expect(guide).toBeHidden();
      await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("LoadoutScene").input.enabled)).toBe(true);
      await page.setViewportSize(viewport);
      await expect(guide).toBeVisible();
      expect(await page.locator(".orientation-guide").count()).toBe(1);
    }
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await expect(guide).toBeHidden();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `e2e/screenshots/orientation-landscape-${viewport.width}.png` });
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("missing canvas");
    await page.touchscreen.tap(box.x + box.width * 640 / 800, box.y + box.height * 420 / 450);
    await expect.poll(() => page.evaluate(() => window.__qaGame.scene.isActive("GameScene"))).toBe(true);
    await expect(guide).toHaveCount(0);
    await page.close();
  });
}
test("missing hero keeps rotation instructions usable", async ({ browser, baseURL }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.route("**/sf-hero-approved-idle-v3.png", route => route.abort());
  await page.goto(`${baseURL}/?lang=en`);
  await expect(page.getByRole("heading", { name: "Turn sideways to begin" })).toBeVisible();
  await expect(page.locator(".orientation-guide__hero")).toBeHidden();
  await page.close();
});
