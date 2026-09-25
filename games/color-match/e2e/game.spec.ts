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

test("generated answer UI is loaded and visible during play", async ({ page }) => {
  await tapPoint(page, 225, 705);
  await expect.poll(() => phase(page)).toBe("playing");
  const assetState = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const textureLoaded = scene.textures.exists("cm-answer-buttons");
    const hasVisibleImage = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
    ): boolean =>
      nodes.some(node => {
        const visible = parentVisible && ("visible" in node
          ? Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible)
          : true);
        if (!visible) return false;
        if (
          node.type === "Image" &&
          (node as Phaser.GameObjects.Image).texture.key === "cm-answer-buttons"
        ) return true;
        if (node.type === "Container") {
          return hasVisibleImage((node as Phaser.GameObjects.Container).list, visible);
        }
        return false;
      });
    const visibleImage = hasVisibleImage(scene.children.list);
    return { textureLoaded, visibleImage };
  });
  expect(assetState).toEqual({ textureLoaded: true, visibleImage: true });
});

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test("English landscape marketing UI contains no Japanese", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?lang=en");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.waitForTimeout(700);

  const visibleText = await page.evaluate(() => {
    const scenes = window.__qaGame.scene.getScenes(true);
    const collect = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
      out: string[] = [],
    ): string[] => {
      for (const node of nodes) {
        const visible = parentVisible && ("visible" in node ? Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible) : true);
        if (!visible) continue;
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, visible, out);
      }
      return out;
    };
    return scenes.flatMap(scene => collect(scene.children.list));
  });
  expect(visibleText.join("\n")).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);

  const headlineBounds = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.type === "Text" && (node as Phaser.GameObjects.Text).text.includes("Spot the mismatch")) {
          return node as Phaser.GameObjects.Text;
        }
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const node = find(scene.children.list);
    if (!node) return null;
    const bounds = node.getBounds();
    return { left: bounds.left, right: bounds.right };
  });
  expect(headlineBounds).not.toBeNull();
  expect(headlineBounds!.left).toBeGreaterThanOrEqual(48);
  expect(headlineBounds!.right).toBeLessThanOrEqual(452);
});

test("English fallback localizes the primary title and controls", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.waitForFunction(() => !!window.__qaGame);
  await expect.poll(async () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return scene?.children?.list?.length ?? 0;
  }), { timeout: 10000 }).toBeGreaterThan(0);
  const labels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const collectText = (
      nodes: Phaser.GameObjects.GameObject[],
      out: string[] = [],
    ): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") {
          collectText((node as Phaser.GameObjects.Container).list, out);
        }
      }
      return out;
    };
    return collectText(scene.children.list);
  });
  expect(labels).toContain("Color Match");
  expect(labels).toContain("Word Style");
  expect(labels).toContain("60-Second Challenge");
  expect(labels).toContain("20-Second Practice");
  await expect.poll(() => page.locator("html").getAttribute("lang")).toBe("en");
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

test("20-second weakness practice locks the weak judge and records stats", async ({ page }) => {
  const state = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startPractice").call(scene);
    const round = Reflect.get(scene, "currentRound") as { judgeMode: "content" | "color" };
    return {
      phase: Reflect.get(scene, "phase"),
      mode: Reflect.get(scene, "sessionMode"),
      duration: Reflect.get(scene, "sessionDurationMs"),
      weak: Reflect.get(scene, "practiceJudgeMode"),
      roundMode: round.judgeMode,
    };
  });
  expect(state.phase).toBe("playing");
  expect(state.mode).toBe("practice");
  expect(state.duration).toBe(20_000);
  expect(state.roundMode).toBe(state.weak);

  await checkFrame(page, "portrait-practice-weakness");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await checkFrame(page, "landscape-practice-weakness");

  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "sessionRemaining", 1));
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("color_match_performance_v1"))).not.toBeNull();
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("color_match_performance_v1") ?? "{}"));
  expect(stats[state.weak].total).toBeGreaterThanOrEqual(1);
});

