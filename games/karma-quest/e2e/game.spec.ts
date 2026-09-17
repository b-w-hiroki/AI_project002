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

test("compact phones keep the primary choice readable and tappable", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
    await expect.poll(async () => {
      const box = await page.locator("canvas").boundingBox();
      return box ? { inside: box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, scale: box.width / 450 } : null;
    }).toEqual(expect.objectContaining({ inside: true }));
    // Phaser applies its resize on the next animation frame. Wait for that frame
    // before checking the physical tap height or a previous viewport can leak in.
    await expect.poll(async () => {
      const box = await page.locator("canvas").boundingBox();
      return box ? 80 * box.width / 450 : 0;
    }).toBeGreaterThanOrEqual(52);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(async () => (await page.locator("canvas").boundingBox())?.width ?? 0).toBeLessThanOrEqual(314);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/compact-320-title.png" });
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "currentRequest", { id: "village_food", faction: "merchant", text: "王都の周辺で、村の民が飢えています。食料を分け与えますか？", karmaDelta: 8 });
  });
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/compact-320-choice.png" });
  await tapPoint(page, 225, 598);
  await expect.poll(() => phase(page)).not.toBe("karma");
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
  await expect.poll(() => page.locator("canvas").evaluate(node => ({
    width: (node as HTMLCanvasElement).width,
    height: (node as HTMLCanvasElement).height,
  }))).toEqual({ width: 800, height: 450 });
  await checkFrame(page, "landscape-after-choice");
});

test("portrait choice keeps the approved visual mock skeleton", async ({ page }) => {
  // The responsive controller keeps a 3px edge on each side, so 456x806 renders the
  // 450x800 design canvas at its native size for pixel-level mock comparison.
  await page.setViewportSize({ width: 456, height: 806 });
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
    Reflect.set(scene, "currentRequest", { id: "village_food", faction: "merchant", text: "王都の周辺で、村の民が飢えています。食料を分け与えますか？", karmaDelta: 8 });
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-choice-mock.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.035,
  });
});

async function useNativePortrait(page: Page) {
  await page.setViewportSize({ width: 456, height: 806 });
}

test("portrait title keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await expect(page.locator("canvas")).toHaveScreenshot("karma-title-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait battle keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const titleGroup = Reflect.get(scene, "titleGroup") as { setVisible(value: boolean): void };
    titleGroup.setVisible(false);
    const showBattle = Reflect.get(scene, "showBattlePhase");
    if (typeof showBattle === "function") showBattle.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("battle");
  await expect(page.locator("canvas")).toHaveScreenshot("karma-battle-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait report keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const titleGroup = Reflect.get(scene, "titleGroup") as { setVisible(value: boolean): void };
    titleGroup.setVisible(false);
    Reflect.set(scene, "deeds", [
      { id: "request", label: "戦士の派閥に力を貸した", quality: 4, tag: "valor" },
    ]);
    Reflect.set(scene, "cheerCount", 1);
    Reflect.set(scene, "deity", "mercy");
    const showReport = Reflect.get(scene, "showReportPhase");
    if (typeof showReport === "function") showReport.call(scene, { win: true, hpRatioRemaining: 0.5 });
    const rows = Reflect.get(scene, "highlightRows") as Array<{ selected: boolean }>;
    rows.slice(0, 2).forEach(row => { row.selected = true; });
    const redraw = Reflect.get(scene, "drawHighlightRow");
    rows.forEach(row => { if (typeof redraw === "function") redraw.call(scene, row); });
    const refresh = Reflect.get(scene, "refreshReportPreview");
    if (typeof refresh === "function") refresh.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("report");
  await expect(page.locator("canvas")).toHaveScreenshot("karma-report-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait final keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const titleGroup = Reflect.get(scene, "titleGroup") as { setVisible(value: boolean): void };
    titleGroup.setVisible(false);
    Reflect.set(scene, "stage", 12);
    Reflect.set(scene, "runEvaluation", 180);
    Reflect.set(scene, "legendCounts", { valor: 4, mercy: 12 });
    Reflect.set(scene, "chronicle", [
      "11年目 · 慈愛神\n魔物を討ち、道を切り開いた ／ 勇者に1回の声援を送った",
      "12年目 · 慈愛神\n魔物を討ち、道を切り開いた ／ 勇者に1回の声援を送った",
    ]);
    const showFinal = Reflect.get(scene, "showFinal");
    if (typeof showFinal === "function") showFinal.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("final");
  await expect(page.locator("canvas")).toHaveScreenshot("karma-final-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait choice reveals the world reaction scene", async ({ page }) => {
  await useNativePortrait(page);
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
    const choose = Reflect.get(scene, "onKarmaChoice");
    if (typeof choose === "function") choose.call(scene, true);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-reaction-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.01,
  });
  await page.locator("canvas").click({ position: { x: 225, y: 718 } });
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").reactionUntil)).toBe(0);
});

test("declining a request changes the world reaction copy and effects", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const startRun = Reflect.get(scene, "startRun");
    if (typeof startRun === "function") startRun.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const choose = Reflect.get(scene, "onKarmaChoice");
    if (typeof choose === "function") choose.call(scene, false);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const labels: string[] = [];
    const visit = (item: unknown): void => {
      if (!item || typeof item !== "object") return;
      const candidate = item as { text?: unknown; list?: unknown[] };
      if (typeof candidate.text === "string") labels.push(candidate.text);
      candidate.list?.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return labels;
  })).toEqual(expect.arrayContaining(["支援を見送りました", "大きく低下"]));
});
