import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";

declare global {
  interface Window {
    __qaGame: Phaser.Game;
  }
}

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

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("haja mode activates once, exposes the selected identity, and expires", async ({ page }) => {
  const state = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
    Reflect.get(scene, "activateHajaMode").call(scene, "go");
    return {
      phase: Reflect.get(scene, "phase"),
      mode: Reflect.get(scene, "hajaMode"),
      used: Reflect.get(scene, "hajaUsed"),
      remaining: Reflect.get(scene, "hajaRemainingMs"),
    };
  });

  expect(state.phase).toBe("battle");
  expect(state.mode).toBe("go");
  expect(state.used).toBe(true);
  expect(state.remaining).toBeGreaterThan(4_500);
  await page.screenshot({ path: "e2e/screenshots/portrait-haja-go.png" });

  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "hajaRemainingMs", 1);
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaMode"))).toBeNull();

  const secondActivation = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "activateHajaMode").call(scene, "shun");
    return Reflect.get(scene, "hajaMode");
  });
  expect(secondActivation).toBeNull();

  await page.screenshot({ path: "e2e/screenshots/portrait-haja-used.png" });
});
