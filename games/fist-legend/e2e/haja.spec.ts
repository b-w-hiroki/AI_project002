import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";

declare global {
  interface Window {
    __qaGame: Phaser.Game;
  }
}

const errors = new WeakMap<Page, string[]>();

test.use({ hasTouch: true, locale: "ja-JP", viewport: { width: 390, height: 844 } });

async function waitForSceneReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const scene = window.__qaGame?.scene?.getScene("GameScene");
    return !!scene && scene.sys.isActive() && !!Reflect.get(scene, "titleGroup");
  });
}

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
  await waitForSceneReady(page);
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

test("compact tablet Haja choices have readable touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    return (root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container).x;
  })).toBe(330);
  const choices = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const canvas = window.__qaGame.canvas;
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    return root.list.filter(node => node.type === "Container").map(node => {
      const button = node as Phaser.GameObjects.Container;
      const label = button.list.find(child => child.type === "Text") as Phaser.GameObjects.Text;
      return {
        label: label.text,
        x: button.x,
        y: button.y,
        hitPx: (button.input!.hitArea.height as number) * scale,
        fontPx: Number.parseFloat(label.style.fontSize) * scale,
      };
    });
  });
  expect(choices.map(choice => choice.label)).toEqual(["剛", "柔", "瞬"]);
  for (const choice of choices) {
    expect(choice.hitPx, choice.label).toBeGreaterThanOrEqual(44);
    expect(choice.fontPx, choice.label).toBeGreaterThanOrEqual(14);
  }
  const guidance = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return {
      statusPx: Number.parseFloat(status!.style.fontSize) * scale,
      hintPx: Number.parseFloat(hint!.style.fontSize) * scale,
      statusBottom: status!.getBounds().bottom,
      hintTop: hint!.getBounds().top,
      hintBottom: hint!.getBounds().bottom,
      hitTop: (() => {
        const button = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
        return button.y - (button.input!.hitArea.height as number) / 2;
      })(),
    };
  });
  expect(guidance.statusPx).toBeGreaterThanOrEqual(14);
  expect(guidance.hintPx).toBeGreaterThanOrEqual(14);
  expect(guidance.statusBottom).toBeLessThan(guidance.hintTop);
  expect(guidance.hintBottom).toBeLessThan(guidance.hitTop);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/small-tablet-haja-touch.png" });
  const canvas = (await page.locator("canvas").boundingBox())!;
  const logical = await page.locator("canvas").evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(canvas.x + choices[0]!.x * canvas.width / logical.width,
    canvas.y + (choices[0]!.y + 38) * canvas.height / logical.height);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaMode"))).toBe("go");
  await expect.poll(() => page.evaluate(() => {
    const root = window.__qaGame.scene.getScene("GameScene").children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    return { status: status!.text, hint: hint!.text, separated: status!.getBounds().bottom < hint!.getBounds().top };
  })).toMatchObject({ status: expect.stringContaining("覇者・剛"), hint: "与ダメージ+40%", separated: true });
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/small-tablet-haja-active.png" });
});
