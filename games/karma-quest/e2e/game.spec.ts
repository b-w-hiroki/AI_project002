import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";
import { KARMA_REQUESTS } from "../src/logic/karma";
import { OUTCOME_ART, outcomeArtKey } from "../src/outcomeArt";

declare global { interface Window { __qaGame: Phaser.Game } }

const errors = new WeakMap<Page, string[]>();
const allowedConsoleErrors = new WeakMap<Page, RegExp[]>();
test.use({ hasTouch: true, locale: "ja-JP", viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  allowedConsoleErrors.set(page, []);
  page.on("pageerror", error => messages.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !allowedConsoleErrors.get(page)?.some(pattern => pattern.test(message.text()))) {
      messages.push(`console: ${message.text()}`);
    }
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
        return;
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
    throw lastError;
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test("stalled portal initialization falls back to a playable home", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__qaPortalStarts", 0);
    Reflect.set(window, "CrazyGames", { SDK: {
      init: () => new Promise<void>(resolve => Reflect.set(window, "__qaReleasePortal", resolve)),
      user: { systemInfo: { locale: "en-US" } },
      game: { gameplayStart: () => Reflect.set(window, "__qaPortalStarts", Number(Reflect.get(window, "__qaPortalStarts")) + 1) },
    } });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await page.evaluate(() => Reflect.get(window, "__qaReleasePortal")());
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "lang"))).toBe("ja");
  expect(await page.evaluate(() => Reflect.get(window, "__qaPortalStarts"))).toBe(0);
  await page.screenshot({ path: `../../docs/review/karma-sdk-timeout-${test.info().project.name || test.info().project.use.browserName || "chromium"}.png` });
});

test("home keeps live progress values, capital context, and long request copy", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_total_eval_v1", "9876");
    localStorage.setItem("karma_quest_best_stage_v1", "12");
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const read = (name: string) => {
      let value = "";
      const visit = (node: Phaser.GameObjects.GameObject): void => {
        if (node.name === name && node.type === "Text" && Reflect.get(node, "visible") !== false) value = (node as Phaser.GameObjects.Text).text;
        if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
      };
      scene.children.list.forEach(visit);
      return value;
    };
    return { total: read("home-total-evaluation"), best: read("home-best-stage"), capital: read("home-capital") };
  })).toEqual({ total: "累計評価 9876", best: "最高到達 12年", capital: "王都ルナティス" });
  await expect.poll(() => page.evaluate(() => {
    const keys: string[] = [];
    const visit = (node: Phaser.GameObjects.GameObject, visible = true): void => {
      const ownVisible = visible && Reflect.get(node, "visible") !== false;
      if (!ownVisible) return;
      if (node.type === "Image") keys.push((node as Phaser.GameObjects.Image).texture.key);
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(child => visit(child, ownVisible));
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(node => visit(node));
    return keys;
  })).toContain("kq-approved-avatar-visible");
  const avatarLayers = await page.evaluate(() => {
    const result: Array<{ key: string; name: string; x: number; y: number; alpha: number; rootDepth: number; rootIndex: number; childIndex: number }> = [];
    const scene = window.__qaGame.scene.getScene("GameScene");
    const visit = (node: Phaser.GameObjects.GameObject, rootDepth: number, rootIndex: number, childIndex: number, visible = true): void => {
      const ownVisible = visible && Reflect.get(node, "visible") !== false;
      if (!ownVisible) return;
      if (node.type === "Image") {
        const image = node as Phaser.GameObjects.Image;
        if (image.texture.key.includes("hero") || image.texture.key.includes("avatar")) {
          result.push({ key: image.texture.key, name: image.name, x: image.x, y: image.y, alpha: image.alpha, rootDepth, rootIndex, childIndex });
        }
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach((child, index) => visit(child, rootDepth, rootIndex, index, ownVisible));
    };
    scene.children.list.forEach((node, index) => visit(node, Number(Reflect.get(node, "depth") ?? 0), index, index));
    return result;
  });
  const approvedAvatar = avatarLayers.find(layer => layer.key === "kq-approved-avatar-visible");
  const placeholderAvatar = avatarLayers.find(layer => layer.key === "kq-dialogue-hero-v1");
  expect(approvedAvatar).toEqual(expect.objectContaining({ name: "approved-home-avatar", x: 48, y: 151, alpha: 1 }));
  expect(placeholderAvatar).toBeUndefined();

  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "homeRequest", {
    id: "merchant_monster", faction: "merchant", karmaDelta: 8,
    text: "王都へ続く街道に魔物が現れ、荷車も旅人も安全に通れません。護衛を派遣していただけませんか？",
  }));
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let result: { left: number; right: number; top: number; bottom: number } | null = null;
    const visit = (node: Phaser.GameObjects.GameObject): void => {
      if (node.name === "home-request-body" && Reflect.get(node, "visible") !== false) {
        const box = (node as Phaser.GameObjects.Text).getBounds();
        result = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return result ? {
      visible: true,
      insideCard: result.left >= 120 && result.right <= 415 && result.top >= 618 && result.bottom <= 724,
    } : { visible: false, insideCard: false };
  })).toEqual({ visible: true, insideCard: true });
});

test("browser back recreates the home and starts one journey", async ({ page }) => {
  await page.goto("/?visit=second");
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await page.goBack();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(() => phase(page)).toBe("title");
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "stage"))).toBe(1);
});

test("English responsive UI contains no Japanese", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?lang=en");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.waitForTimeout(700);
  const scene = await page.evaluate(() => window.__qaGame.scene.getScene("GameScene").scene.key);
  expect(scene).toBe("GameScene");
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
});

test("English fallback localizes the title and first request flow", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.waitForFunction(() => !!window.__qaGame);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
      }
      return out;
    };
    return collect(scene.children.list);
  })).toEqual(expect.arrayContaining(["Karma Quest", "Begin Journey"]));

  await tapPoint(page, 225, 650);
  await expect.poll(() => phase(page)).toBe("karma");
  const state = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const karmaGroup = Reflect.get(scene, "karmaGroup") as Phaser.GameObjects.Container;
    return {
      lang: Reflect.get(scene, "lang"),
      request: (karmaGroup.getByName("requestText") as Phaser.GameObjects.Text).text,
      faction: (karmaGroup.getByName("factionLabel") as Phaser.GameObjects.Text).text,
    };
  });
  expect(state.lang).toBe("en");
  expect(state.request).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
  expect(state.faction).toMatch(/Faction/);
});

test("common buttons only confirm the pointer that pressed them", { tag: "@webkit-regression" }, async ({ page }) => {
  await tapPoint(page, 47, 253);
  const emit = (event: string, id: number) => page.evaluate(({ event, id }) => {
    let target: Phaser.GameObjects.GameObject | undefined;
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name.startsWith("cta:効果音")) target = node;
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    if (!target) throw new Error("Visible sound control missing");
    target.emit(event, { id });
  }, { event, id });
  const enabled = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return Reflect.get(scene, "isSoundEnabled").call(scene);
  });
  await emit("pointerdown", 1);
  await emit("pointerdown", 2);
  await emit("pointerup", 2);
  expect(await enabled()).toBe(true);
  await emit("pointerout", 2);
  await emit("pointerup", 1);
  expect(await enabled()).toBe(false);
  await emit("pointerup", 1);
  expect(await enabled()).toBe(false);
  await emit("pointerdown", 1);
  await emit("pointerout", 1);
  await emit("pointerup", 1);
  expect(await enabled()).toBe(false);
  await tapPoint(page, 225, 475);
  expect(await enabled()).toBe(true);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-pointer-owner.png" });
});

test("sound settings remain usable when their storage access is denied", { tag: "@webkit-regression" }, async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "karma_quest_sound_v1") throw new DOMException("Blocked", "SecurityError");
      return read.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "karma_quest_sound_v1") throw new DOMException("Full", "QuotaExceededError");
      write.call(this, key, value);
    };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  const enabled = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return Reflect.get(scene, "isSoundEnabled").call(scene);
  });
  expect(await enabled()).toBe(true);
  await tapPoint(page, 47, 253);
  for (const expected of [false, true, false]) {
    await tapPoint(page, 225, 475);
    await expect.poll(enabled).toBe(expected);
  }
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-sound-storage-denied.png" });
  await tapPoint(page, 225, 551);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  expect(await enabled()).toBe(true);
});

test("sound preference is operable in both home layouts and survives reload", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__qaAudioStarts", 0);
    Reflect.set(window, "__qaAudioProbeReliable", Boolean(window.AudioContext));
    const AudioCtor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const original = AudioCtor.prototype.createOscillator;
    AudioCtor.prototype.createOscillator = function () {
      const oscillator = original.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when?: number) => {
        Reflect.set(window, "__qaAudioStarts", Number(Reflect.get(window, "__qaAudioStarts")) + 1);
        start(when);
      };
      return oscillator;
    };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await tapPoint(page, 47, 253);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-sound-portrait.png" });
  await tapPoint(page, 225, 475);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("karma_quest_sound_v1"))).toBe("off");
  expect(await page.evaluate(() => Reflect.get(window, "__qaAudioStarts"))).toBe(0);
  await tapPoint(page, 225, 551);
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tapPoint(page, 62, 348);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-sound-landscape.png" });
  await tapPoint(page, 400, 316);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("karma_quest_sound_v1"))).toBe("on");
  const audioProbe = await page.evaluate(() => ({
    reliable: Boolean(Reflect.get(window, "__qaAudioProbeReliable")),
    starts: Number(Reflect.get(window, "__qaAudioStarts")),
  }));
  if (audioProbe.reliable) expect(audioProbe.starts).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "isSoundEnabled").call(window.__qaGame.scene.getScene("GameScene")))).toBe(true);
  await tapPoint(page, 62, 348);
  await tapPoint(page, 400, 316);
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "isSoundEnabled").call(window.__qaGame.scene.getScene("GameScene")))).toBe(false);
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

test("home progress stays readable and separated on a compact phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => Math.round((await page.locator("canvas").boundingBox())?.width ?? 0)).toBe(314);
  for (const value of [0, 9876, 99999999, Number.MAX_SAFE_INTEGER]) {
    await page.evaluate(value => {
      localStorage.setItem("karma_quest_total_eval_v1", String(value));
      localStorage.setItem("karma_quest_best_stage_v1", "12");
    }, value);
    await page.reload();
    await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
    const labels = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const root = scene.children.list.find(node => node.type === "Container" &&
        !!(node as Phaser.GameObjects.Container).getByName("home-total-evaluation")) as Phaser.GameObjects.Container;
      const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
      return ["home-total-evaluation", "home-best-stage", "home-capital"].map(name => {
        const label = root.getByName(name) as Phaser.GameObjects.Text;
        const box = label.getBounds();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          size: Number.parseFloat(String(label.style.fontSize)) * scale };
      });
    });
    expect(labels[0].size).toBeGreaterThanOrEqual(14);
    expect(labels[1].size).toBeGreaterThanOrEqual(14);
    expect(labels[0].left).toBeGreaterThan(234);
    expect(labels[0].right).toBeLessThan(430);
    expect(labels[0].bottom).toBeLessThan(labels[1].top);
    expect(labels[1].bottom).toBeLessThan(labels[2].top);
    expect(labels[2].bottom).toBeLessThan(206);
  }
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "../../docs/review/karma-home-readable-progress.png" });
});

test("portrait navigation remains at least 14 physical pixels at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  const result = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const home = scene.children.list
      .find(node => node.type === "Container" && node.visible
        && !!(node as Phaser.GameObjects.Container).getByName("home-nav:0")) as Phaser.GameObjects.Container;
    const labels = home.list
      .filter(node => node.type === "Text")
      .map(node => node as Phaser.GameObjects.Text)
      .filter(node => node.visible && ((node.y >= 735) || (node.x < 80 && node.y >= 230 && node.y <= 590)));
    const canvas = window.__qaGame.canvas;
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    const entries = labels.map(node => ({ text: node.text, size: Number.parseFloat(String(node.style.fontSize)) * scale }));
    return { count: entries.length, minimum: Math.min(...entries.map(entry => entry.size)), entries };
  });
  expect(result.count).toBeGreaterThanOrEqual(10);
  expect(result.minimum, JSON.stringify(result.entries)).toBeGreaterThanOrEqual(14);
});

async function tapPoint(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const size = await canvas.evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
}

test("notch insets and changing browser height preserve choices and touch coordinates", async ({ page }) => {
  // Chromium env() emulation: this verifies layout, not physical Safari behavior.
  const cdp = await page.context().newCDPSession(page);
  await tapPoint(page, 225, 650);
  await expect.poll(() => phase(page)).toBe("karma");
  const request = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "currentRequest").id);
  for (const sample of [
    { width: 390, height: 844, top: 59, right: 0, bottom: 34, left: 0 },
    { width: 390, height: 660, top: 59, right: 0, bottom: 34, left: 0 },
    { width: 844, height: 390, top: 0, right: 0, bottom: 21, left: 59 },
    { width: 844, height: 320, top: 0, right: 59, bottom: 21, left: 0 },
    { width: 390, height: 844, top: 59, right: 0, bottom: 34, left: 0 },
  ]) {
    const { width, height, ...insets } = sample;
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await expect.poll(async () => {
      const box = await page.locator("canvas").boundingBox();
      return !!box && box.x >= insets.left - 1 && box.y >= insets.top - 1
        && box.x + box.width <= width - insets.right + 1
        && box.y + box.height <= height - insets.bottom + 1;
    }).toBe(true);
    await expect.poll(() => page.locator("canvas").evaluate(node => {
      const c = node as HTMLCanvasElement, b = c.getBoundingClientRect();
      return Math.abs(b.width / b.height - c.width / c.height);
    })).toBeLessThan(0.02);
    expect(await phase(page)).toBe("karma");
    expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "currentRequest").id)).toBe(request);
  }
  await page.screenshot({ path: "../../docs/review/karma-safe-area-choice.png" });
  await tapPoint(page, 225, 598);
  await expect.poll(() => phase(page)).not.toBe("karma");
});

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
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 15000 }).toBe(0);
  await checkFrame(page, "portrait-karma");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tapPoint(page, 591, 301);
  await expect.poll(() => phase(page), { timeout: 15000 }).toBe("reaction");
  await expect.poll(() => page.locator("canvas").evaluate(node => ({
    width: (node as HTMLCanvasElement).width,
    height: (node as HTMLCanvasElement).height,
  }))).toEqual({ width: 800, height: 450 });
  await checkFrame(page, "landscape-after-choice");
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/landscape-after-choice.png" });
});

test("custom selections only confirm their pressing pointer", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  const emit = (name: string, event: string, id: number) => page.evaluate(({ name, event, id }) => {
    let target: Phaser.GameObjects.GameObject | undefined;
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name === name) target = node;
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    if (!target) throw new Error(`Missing visible selection: ${name}`);
    target.emit(event, { id });
  }, { name, event, id });
  const foreignRelease = async (name: string) => {
    await emit(name, "pointerdown", 101);
    await emit(name, "pointerdown", 102);
    await emit(name, "pointerup", 102);
    await emit(name, "pointerout", 102);
  };
  await foreignRelease("home-start-card");
  expect(await phase(page)).toBe("title");
  await emit("home-start-card", "pointerup", 101);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "deity", "valor");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  const selected = () => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "highlightRows") as Array<{selected: boolean}>).filter(row => row.selected).length);
  for (const wide of [false, true]) {
    await page.setViewportSize(wide ? { width: 806, height: 456 } : { width: 456, height: 806 });
    await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(wide ? 800 : 450);
    const name = `report-row-${wide ? "wide" : "portrait"}:0`;
    // Test pointer ownership after resize settles; resize itself intentionally cancels presses.
    await page.evaluate(() => new Promise<void>(resolve => {
      const scale = window.__qaGame.scale;
      let timer: ReturnType<typeof setTimeout>;
      const settled = () => { scale.off("resize", changed); resolve(); };
      const changed = () => { clearTimeout(timer); timer = setTimeout(settled, 250); };
      scale.on("resize", changed);
      changed();
    }));
    await foreignRelease(name);
    expect(await selected()).toBe(0);
    await emit(name, "pointerup", 101);
    expect(await selected()).toBe(1);
    await emit(name, "pointerup", 101);
    expect(await selected()).toBe(1);
    await emit(name, "pointerdown", 101);
    await emit(name, "pointerout", 101);
    await emit(name, "pointerup", 101);
    expect(await selected()).toBe(1);
    await emit(name, "pointerdown", 101);
    await emit(name, "pointerup", 101);
    expect(await selected()).toBe(0);
  }
  const deity = () => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"));
  await foreignRelease("report-god-wide:mercy");
  expect(await deity()).toBe("valor");
  await emit("report-god-wide:mercy", "pointerup", 101);
  expect(await deity()).toBe("mercy");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-selection-pointer-owner.png" });
});

test("landscape report marks the selected deity and preserves it through rotation", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "deity", "valor");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  const labels = () => page.evaluate(() => {
    const result: string[] = [];
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name.startsWith("report-god-label:")) result.push((node as Phaser.GameObjects.Text).text);
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    return result;
  });
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(labels).toEqual(["✓ 軍神", "慈愛神"]);
  await page.evaluate(() => {
    Reflect.set(window, "__godFrameClears", 0);
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (node.name.startsWith("report-god-frame:")) {
        const graphics = node as Phaser.GameObjects.Graphics;
        const clear = graphics.clear;
        graphics.clear = function () {
          Reflect.set(window, "__godFrameClears", Number(Reflect.get(window, "__godFrameClears")) + 1);
          return clear.call(this);
        };
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
  });
  await page.evaluate(() => new Promise<void>(resolve => {
    let frames = 0;
    const step = () => { if (++frames >= 10) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }));
  expect(await page.evaluate(() => Reflect.get(window, "__godFrameClears"))).toBe(0);
  await tapPoint(page, 699, 144);
  await expect.poll(labels).toEqual(["軍神", "✓ 慈愛神"]);
  expect(await page.evaluate(() => Reflect.get(window, "__godFrameClears"))).toBe(2);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-god-selected.png" });
  await useNativePortrait(page);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"))).toBe("mercy");
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(labels).toEqual(["軍神", "✓ 慈愛神"]);
  await tapPoint(page, 519, 144);
  await expect.poll(labels).toEqual(["✓ 軍神", "慈愛神"]);
});

test("report action explains empty selection and reflects the selected count", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  const label = () => page.evaluate(() => {
    let value = "";
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name === "report-submit-label") {
        const label = node as Phaser.GameObjects.Text;
        if (label.alpha !== 1 || label.parentContainer.alpha !== 1) throw new Error("Report guidance text must remain fully opaque");
        value = label.text;
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    return value;
  });
  await expect.poll(label).toBe("出来事を選んでください");
  await tapPoint(page, 225, 680);
  expect(await phase(page)).toBe("report");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-empty-contrast.png" });
  await tapPoint(page, 225, 291);
  await expect.poll(label).toBe("1件を報告する");
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(label).toBe("1件を報告する");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-ready-contrast.png" });
  await tapPoint(page, 215, 150);
  await expect.poll(label).toBe("出来事を選んでください");
  await tapPoint(page, 609, 405);
  expect(await phase(page)).toBe("report");
  await tapPoint(page, 215, 150);
  await expect.poll(label).toBe("1件を報告する");
  await tapPoint(page, 609, 405);
  await expect.poll(() => phase(page)).not.toBe("report");
});

test("landscape report shows the authoritative evaluation preview", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  const read = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let display = "";
    let top = 0, bottom = 0;
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name === "landscape-report-preview") {
        const text = node as Phaser.GameObjects.Text;
        display = text.text; top = text.getBounds().top; bottom = text.getBounds().bottom;
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return { display, source: (Reflect.get(scene, "reportPreview") as Phaser.GameObjects.Text).text, top, bottom };
  });
  await expect.poll(async () => (await read()).display).toContain("評価 0");
  await tapPoint(page, 215, 150);
  await expect.poll(async () => (await read()).display).toContain("選択 1/2");
  for (const x of [519, 699]) {
    await tapPoint(page, x, 144);
    await expect.poll(async () => { const result = await read(); return result.display === result.source; }).toBe(true);
    const result = await read();
    expect(result.display).toMatch(/評価 [1-9]/);
    expect(result.top).toBeGreaterThan(174);
    expect(result.bottom).toBeLessThan(375);
  }
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-landscape-report-evaluation.png" });
});

test("report explains how to replace a full selection in both layouts", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "deeds", [{ id: "help", label: "村人を助けた", quality: 4, tag: "mercy" }]);
    Reflect.set(scene, "cheerCount", 1);
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  const read = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let hint = "";
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name === "report-selection-hint") hint = (node as Phaser.GameObjects.Text).text;
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return { hint, selected: (Reflect.get(scene, "highlightRows") as Array<{selected: boolean}>).map(row => row.selected) };
  });
  await tapPoint(page, 225, 291);
  await tapPoint(page, 225, 365);
  await expect.poll(async () => (await read()).hint).toContain("変更するには選択を外す");
  await tapPoint(page, 225, 439);
  expect((await read()).selected).toEqual([true, true, false]);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-limit-portrait.png" });
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(async () => (await read()).hint).toContain("変更するには選択を外す");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-limit-landscape.png" });
  await tapPoint(page, 215, 150);
  await expect.poll(async () => (await read()).hint).toContain("最大2つ");
  await tapPoint(page, 215, 310);
  await expect.poll(async () => (await read()).selected).toEqual([false, true, true]);
  await expect.poll(async () => (await read()).hint).toContain("変更するには選択を外す");
});

test("report row frames redraw only when their selection changes", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  for (const wide of [false, true]) {
    await page.setViewportSize(wide ? { width: 806, height: 456 } : { width: 456, height: 806 });
    await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(wide ? 800 : 450);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const frames = await page.evaluate(() => {
      Reflect.set(window, "__rowFrameClears", 0);
      let count = 0;
      const visit = (node: Phaser.GameObjects.GameObject) => {
        if (Reflect.get(node, "visible") === false) return;
        if (node.name.startsWith("report-row-frame:")) {
          count++;
          const graphics = node as Phaser.GameObjects.Graphics;
          const clear = graphics.clear;
          graphics.clear = function () {
            Reflect.set(window, "__rowFrameClears", Number(Reflect.get(window, "__rowFrameClears")) + 1);
            return clear.call(this);
          };
        }
        if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
      };
      window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
      return count;
    });
    expect(frames).toBe(1);
    const clears = () => page.evaluate(() => Reflect.get(window, "__rowFrameClears"));
    await page.evaluate(() => new Promise<void>(resolve => {
      let count = 0;
      const step = () => { if (++count >= 10) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }));
    expect(await clears()).toBe(0);
    await tapPoint(page, wide ? 215 : 225, wide ? 150 : 291);
    await expect.poll(clears).toBe(1);
    await tapPoint(page, wide ? 215 : 225, wide ? 150 : 291);
    await expect.poll(clears).toBe(2);
  }
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-row-redraw.png" });
});

test("report confirmation stays visible until the next year without duplicate rewards", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
    scene.time.timeScale = 0;
  });
  await tapPoint(page, 225, 291);
  await tapPoint(page, 225, 680);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("報告しました");
  const evaluation = await page.evaluate(() => localStorage.getItem("karma_quest_total_eval_v1"));
  expect(Number(evaluation)).toBeGreaterThan(0);
  await tapPoint(page, 225, 680);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-sent-portrait.png" });
  await page.setViewportSize({ width: 806, height: 456 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("報告しました");
  await tapPoint(page, 609, 405);
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_total_eval_v1"))).toBe(evaluation);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-sent-landscape.png" });
  await page.evaluate(() => { window.__qaGame.scene.getScene("GameScene").time.timeScale = 1; });
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "stage"))).toBe(2);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "reportSubmitting"))).toBe(false);
});

test("home and report selections cancel interrupted presses", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  const interrupt = async (x: number, y: number, kind: "blur" | "hidden") => {
    const box = (await page.locator("canvas").boundingBox())!;
    const size = await page.locator("canvas").evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
    await page.mouse.move(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
    await page.mouse.down();
    await page.evaluate(kind => {
      if (kind === "blur") {
        window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus"));
      } else {
        window.__qaGame.events.emit("hidden"); window.__qaGame.events.emit("visible");
      }
    }, kind);
    await page.mouse.up();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await interrupt(225, 682, "blur");
  expect(await phase(page)).toBe("title");
  await tapPoint(page, 225, 682);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "deity", "valor");
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  const selected = () => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "highlightRows") as Array<{selected: boolean}>).filter(row => row.selected).length);
  for (const wide of [false, true]) {
    await page.setViewportSize(wide ? { width: 806, height: 456 } : { width: 456, height: 806 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(wide ? 800 : 450);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    for (const kind of ["blur", "hidden"] as const) {
      await interrupt(wide ? 215 : 225, wide ? 150 : 291, kind);
      expect(await selected()).toBe(0);
    }
    await tapPoint(page, wide ? 215 : 225, wide ? 150 : 291);
    expect(await selected()).toBe(1);
    await tapPoint(page, wide ? 215 : 225, wide ? 150 : 291);
    expect(await selected()).toBe(0);
  }
  await interrupt(699, 144, "hidden");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"))).toBe("valor");
  await tapPoint(page, 699, 144);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"))).toBe("mercy");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-report-interrupted.png" });
});

test("interrupted choice presses cancel before a fresh tap", { tag: "@webkit-regression" }, async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "startRun").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  for (const interruption of ["blur", "hidden", "rotation"] as const) {
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + 225, box.y + 598);
    await page.mouse.down();
    if (interruption === "rotation") {
      await page.setViewportSize({ width: 806, height: 456 });
      await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
      await useNativePortrait(page);
    } else {
      await page.evaluate(kind => {
        if (kind === "blur") {
          window.dispatchEvent(new Event("blur"));
          window.dispatchEvent(new Event("focus"));
        } else {
          // Browser automation cannot hide a real tab reliably; exercise the
          // same Phaser events emitted by its visibility handler.
          window.__qaGame.events.emit("hidden");
          window.__qaGame.events.emit("visible");
        }
      }, interruption);
    }
    await page.mouse.up();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await phase(page)).toBe("karma");
  }
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-choice-interrupted.png" });
  await tapPoint(page, 225, 598);
  await expect.poll(() => phase(page)).toBe("reaction");
});

test("Canvas choice buttons darken on press and cancel on drag out", { tag: "@webkit-regression" }, async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "Canvas fallback regression");
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "startRun").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  const pixel = () => page.locator("canvas").evaluate(node => {
    const context = (node as HTMLCanvasElement).getContext("2d")!;
    return Array.from(context.getImageData(125, 580, 1, 1).data).slice(0, 3);
  });
  // Sample the enamel face away from text, icons, and borders.
  await expect.poll(pixel).toEqual([25, 116, 175]);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + 225, box.y + 598);
  await page.mouse.down();
  await expect.poll(pixel).toEqual([16, 59, 105]);
  await page.mouse.move(box.x + 225, box.y + 550);
  await page.mouse.up();
  await expect.poll(pixel).toEqual([25, 116, 175]);
  expect(await phase(page)).toBe("karma");
});

test("portrait choice keeps the approved visual mock skeleton", async ({ page }) => {
  // The responsive controller keeps a 3px edge on each side, so 456x806 renders the
  // 450x800 design canvas at its native size for pixel-level mock comparison.
  await page.setViewportSize({ width: 456, height: 806 });
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const startRun = Reflect.get(scene, "startRun");
    if (typeof startRun === "function") await startRun.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 15000 }).toBe(0);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "currentRequest", { id: "village_food", faction: "merchant", text: "王都の周辺で、村の民が飢えています。食料を分け与えますか？", karmaDelta: 8 });
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-choice-mock.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

async function useNativePortrait(page: Page) {
  await page.setViewportSize({ width: 456, height: 806 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test("hero appearance follows dominant karma in portrait and landscape", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "startRun").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 15000 }).toBe(0);

  const activeBadges = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const labels: string[] = [];
    const visit = (node: Phaser.GameObjects.GameObject, parentVisible: boolean) => {
      const ownVisible = parentVisible && Reflect.get(node, "visible") !== false;
      if (node.name === "hero-karma-badge" && ownVisible && Number(Reflect.get(node, "alpha") ?? 1) > 0.5) {
        labels.push((node as Phaser.GameObjects.Text).text);
      }
      if ("list" in node) {
        (node as Phaser.GameObjects.Container).list.forEach(child => visit(child, ownVisible));
      }
    };
    scene.children.list.forEach(child => visit(child, true));
    return labels;
  });

  const variants = [
    [{ warrior: 12, merchant: 1, outlaw: 0, mage: 0 }, "鋼の盟約"],
    [{ warrior: 0, merchant: 12, outlaw: 1, mage: 0 }, "繁栄の盟約"],
    [{ warrior: 0, merchant: 1, outlaw: 12, mage: 0 }, "自由の盟約"],
    [{ warrior: 0, merchant: 1, outlaw: 0, mage: 12 }, "秘術の盟約"],
  ] as const;

  for (const [karma, expected] of variants) {
    await page.evaluate(value => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "karma", value), karma);
    await expect.poll(activeBadges).toContain(expected);
  }
  await checkFrame(page, "portrait-hero-karma-mage");

  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "karma",
    { warrior: 0, merchant: 1, outlaw: 12, mage: 0 }));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(activeBadges).toContain("自由の盟約");
  await checkFrame(page, "landscape-hero-karma-outlaw");
});

test("home navigation opens and closes information without starting a journey behind it", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => Math.round((await page.locator("canvas").boundingBox())?.width ?? 0)).toBe(314);
  const modalVisible = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    for (const child of scene.children.list) {
      if (!("list" in child)) continue;
      const modal = (child as Phaser.GameObjects.Container).getByName("home-information") as Phaser.GameObjects.Container | null;
      if (modal) return modal.visible;
    }
    return false;
  });
  await tapPoint(page, 225, 758);
  await expect.poll(modalVisible).toBe(true);
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("title");
  await expect.poll(modalVisible).toBe(true);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/compact-320-character.png" });
  await tapPoint(page, 225, 551);
  await expect.poll(modalVisible).toBe(false);
  await tapPoint(page, 400, 758);
  await expect.poll(modalVisible).toBe(true);
  await tapPoint(page, 225, 551);
  await expect.poll(modalVisible).toBe(false);
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
});

test("home information survives rotation and closes across both layouts", async ({ page }) => {
  const rotate = async (viewport: { width: number; height: number }) => {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(viewport.width > viewport.height ? 800 : 450);
    await page.evaluate(() => new Promise<void>(resolve => {
      const scale = window.__qaGame.scale;
      let timer: ReturnType<typeof setTimeout>;
      const settled = () => { scale.off("resize", changed); resolve(); };
      const changed = () => { clearTimeout(timer); timer = setTimeout(settled, 250); };
      scale.on("resize", changed);
      changed();
    }));
  };
  const visiblePanel = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const values: string[] = [];
    for (const root of scene.children.list) {
      if (root.type !== "Container" || !(root as Phaser.GameObjects.Container).visible) continue;
      for (const child of (root as Phaser.GameObjects.Container).list) {
        if (!child.name.startsWith("home-information") || !(child as Phaser.GameObjects.Container).visible) continue;
        for (const item of (child as Phaser.GameObjects.Container).list) {
          if (item.type === "Text") values.push((item as Phaser.GameObjects.Text).text);
        }
      }
    }
    return values;
  });
  await tapPoint(page, 47, 253);
  await expect.poll(visiblePanel).toContain("冒険の案内");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-modal-rotation-portrait.png" });
  await rotate({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(visiblePanel).toContain("冒険の案内");
  await tapPoint(page, 591, 397);
  expect(await phase(page)).toBe("title");
  await expect.poll(visiblePanel).toContain("冒険の案内");
  await tapPoint(page, 400, 316);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("karma_quest_sound_v1"))).toBe("off");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-modal-rotation-landscape.png" });
  await rotate({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(visiblePanel).toContain("冒険の案内");
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("効果音 OFF");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-modal-rotation-compact.png" });
  await rotate({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 400, 385);
  await expect.poll(visiblePanel).toEqual([]);
  await rotate({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(visiblePanel).toEqual([]);
  await tapPoint(page, 225, 758);
  await expect.poll(visiblePanel).toContain("カイトの能力");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-modal-character-rotated.png" });
  await rotate({ width: 844, height: 390 });
  await expect.poll(visiblePanel).toContain("カイトの能力");
  await tapPoint(page, 400, 385);
  await expect.poll(visiblePanel).toEqual([]);
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
});

test("hero league opens from home in portrait and landscape", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_total_eval_v1", "1000");
    localStorage.setItem("karma_quest_best_stage_v1", "8");
  });

  await tapPoint(page, 315, 758);
  const readLeague = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let heading = "";
    let body = "";
    const visit = (node: Phaser.GameObjects.GameObject, visible: boolean) => {
      const ownVisible = visible && Reflect.get(node, "visible") !== false;
      if (!ownVisible) return;
      if (node.type === "Text") {
        const value = (node as Phaser.GameObjects.Text).text;
        if (value === "勇者リーグ") heading = value;
        body += `${value}\n`;
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(child => visit(child, ownVisible));
    };
    scene.children.list.forEach(child => visit(child, true));
    return { heading, body };
  });
  await expect.poll(readLeague).toMatchObject({ heading: "勇者リーグ" });
  const portraitLeague = await readLeague();
  expect(portraitLeague.body).toContain("Gold LEAGUE");
  expect(portraitLeague.body).toContain("あなた / カイト");
  await checkFrame(page, "portrait-hero-league");

  await tapPoint(page, 225, 551);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 150, 407);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.list.find(child =>
      child.type === "Container" &&
      typeof Reflect.get(child, "getByName") === "function" &&
      Reflect.get(child, "getByName").call(child, "home-information-wide"),
    ) as Phaser.GameObjects.Container | undefined;
    const modal = root?.getByName("home-information-wide") as Phaser.GameObjects.Container | null;
    return modal?.visible ?? false;
  })).toBe(true);
  await checkFrame(page, "landscape-hero-league");
});

test("league columns remain separated on compact screens and rotation", async ({ page }) => {
  await useNativePortrait(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => Math.round((await page.locator("canvas").boundingBox())?.width ?? 0)).toBe(314);
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_total_eval_v1", "1000");
    localStorage.setItem("karma_quest_best_stage_v1", "8");
  });
  await tapPoint(page, 315, 758);
  const tableState = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const tables: Phaser.GameObjects.Container[] = [];
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name === "league-table") tables.push(node as Phaser.GameObjects.Container);
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return tables.flatMap(table => table.list.filter(node => node.type === "Text").map(node => {
      const label = node as Phaser.GameObjects.Text;
      const bounds = label.getBounds();
      return { text: label.text, x: bounds.x, right: bounds.right, y: bounds.y, bottom: bounds.bottom };
    }));
  });
  const verifyColumns = async (ratingText = "1480") => {
    await expect.poll(async () => (await tableState()).length).toBe(23);
    const labels = await tableState();
    expect(labels[0].text).toContain(`Rating ${ratingText}`);
    expect(labels.filter(label => label.text === "あなた / カイト")).toHaveLength(1);
    for (let i = 0; i < 7; i++) {
      const [rank, name, rating] = labels.slice(1 + i * 3, 4 + i * 3);
      expect(rank.text).toBe(`${i + 1}位`);
      expect(rank.right).toBeLessThan(name.x);
      expect(name.right).toBeLessThan(rating.x);
      expect(i === 0 ? labels[0].bottom : labels[1 + (i - 1) * 3].bottom).toBeLessThan(rank.y);
    }
    expect(labels[21].bottom).toBeLessThan(labels[22].y);
  };
  await verifyColumns();
  await page.screenshot({ path: "../../docs/review/karma-league-compact.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await verifyColumns();
  await page.screenshot({ path: "../../docs/review/karma-league-landscape.png" });
  await tapPoint(page, 400, 385);
  await page.evaluate(() => localStorage.setItem("karma_quest_total_eval_v1", "3000"));
  await tapPoint(page, 150, 407);
  await expect.poll(async () => (await tableState()).at(-1)?.text).toBe("現在トップ！ 首位を守ろう");
  expect((await tableState())[2].text).toBe("あなた / カイト");
  await tapPoint(page, 400, 385);
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_total_eval_v1", String(Number.MAX_SAFE_INTEGER));
    localStorage.setItem("karma_quest_best_stage_v1", "12");
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => Math.round((await page.locator("canvas").boundingBox())?.width ?? 0)).toBe(314);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("累計評価 9007.1兆");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "../../docs/review/karma-large-score-home.png" });
  await tapPoint(page, 315, 758);
  await verifyColumns("9007.1兆");
  const portraitLabels = await tableState();
  // WebKit and Chromium use slightly different Japanese font metrics. Keep a
  // real inset from the compact canvas edge while the column checks above
  // continue to enforce that rank, name, and rating never overlap.
  expect(portraitLabels[0].x).toBeGreaterThanOrEqual(32);
  expect(portraitLabels[0].right).toBeLessThanOrEqual(418);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "../../docs/review/karma-large-score-league.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await verifyColumns("9007.1兆");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "../../docs/review/karma-large-score-landscape.png" });
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_total_eval_v1"))).toBe(String(Number.MAX_SAFE_INTEGER));
});

test("large raid counters fit mobile panels without changing saved values", { tag: "@webkit-regression" }, async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", JSON.stringify({ level: 100000000, hp: 0, defeats: 99999999 }));
    localStorage.setItem("karma_quest_total_eval_v1", "0");
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => window.__qaGame.scale.parentSize.width <= 320);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tapPoint(page, 135, 758);
  const labels = () => page.evaluate(() => {
    const result: { text: string; left: number; right: number }[] = [];
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if (node.name.startsWith("raid-modal")) {
        for (const child of (node as Phaser.GameObjects.Container).list) {
          if (child.type !== "Text") continue;
          const label = child as Phaser.GameObjects.Text;
          const bounds = label.getBounds();
          result.push({ text: label.text, left: bounds.left, right: bounds.right });
        }
      } else if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    return result;
  });
  await expect.poll(async () => (await labels()).length).toBeGreaterThan(0);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-large-portrait.png" });
  expect((await labels()).map(label => label.text)).toContain("評価 +20億 を受け取る");
  for (const label of await labels()) {
    expect(label.left, label.text).toBeGreaterThanOrEqual(40);
    expect(label.right, label.text).toBeLessThanOrEqual(410);
  }
  await tapPoint(page, 225, 510);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(async () => (await labels()).map(label => label.text)).toContain("評価 +20億 獲得。Lv.1億 が出現！");
  await expect.poll(async () => (await labels()).every(label => label.left >= 80 && label.right <= 720)).toBe(true);
  for (const label of await labels()) {
    expect(label.left, label.text).toBeGreaterThanOrEqual(80);
    expect(label.right, label.text).toBeLessThanOrEqual(720);
  }
  await page.waitForFunction(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-large-landscape.png" });
  expect(await page.evaluate(() => ({
    raid: JSON.parse(localStorage.getItem("karma_quest_solo_raid_v1") ?? "{}"),
    evaluation: localStorage.getItem("karma_quest_total_eval_v1"),
  }))).toEqual({ raid: { level: 100000001, hp: 35000000900, maxHp: 35000000900, defeats: 100000000 }, evaluation: "2000000060" });
});

test("solo raid persists damage, rewards evaluation, and advances boss level", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", JSON.stringify({
      level: 1,
      hp: 1,
      maxHp: 900,
      defeats: 0,
    }));
    localStorage.setItem("karma_quest_total_eval_v1", "0");
  });

  await tapPoint(page, 135, 758);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const modal = scene.children.list
      .flatMap(node => "list" in node ? (node as Phaser.GameObjects.Container).list : [])
      .find(node => node.name === "raid-modal") as Phaser.GameObjects.Container | undefined;
    return modal?.visible ?? false;
  })).toBe(true);
  await checkFrame(page, "portrait-solo-raid");

  await tapPoint(page, 225, 510);
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("karma_quest_solo_raid_v1") ?? "{}").hp,
  )).toBe(0);

  await tapPoint(page, 225, 510);
  const afterClaim = await page.evaluate(() => ({
    raid: JSON.parse(localStorage.getItem("karma_quest_solo_raid_v1") ?? "{}"),
    evaluation: Number(localStorage.getItem("karma_quest_total_eval_v1") ?? "0"),
  }));
  expect(afterClaim.raid.level).toBe(2);
  expect(afterClaim.raid.defeats).toBe(1);
  expect(afterClaim.raid.hp).toBe(afterClaim.raid.maxHp);
  expect(afterClaim.evaluation).toBe(80);

  await tapPoint(page, 225, 604);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 150, 348);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const visit = (node: Phaser.GameObjects.GameObject): boolean => {
      if (node.name === "raid-modal-wide") return Reflect.get(node, "visible") === true;
      return "list" in node && (node as Phaser.GameObjects.Container).list.some(visit);
    };
    return scene.children.list.some(visit);
  })).toBe(true);
  await checkFrame(page, "landscape-solo-raid");
});

test("raid defeat and reward feedback survive rotation without duplicate rewards", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", JSON.stringify({ level: 1, hp: 1, maxHp: 900, defeats: 0 }));
    localStorage.setItem("karma_quest_total_eval_v1", "0");
  });
  const raidText = () => page.evaluate(() => {
    const texts: string[] = [];
    for (const root of window.__qaGame.scene.getScene("GameScene").children.list) {
      if (root.type !== "Container" || !(root as Phaser.GameObjects.Container).visible) continue;
      for (const panel of (root as Phaser.GameObjects.Container).list) {
        if (!panel.name.startsWith("raid-modal") || !(panel as Phaser.GameObjects.Container).visible) continue;
        for (const child of (panel as Phaser.GameObjects.Container).list) {
          if (child.type === "Text") texts.push((child as Phaser.GameObjects.Text).text);
        }
      }
    }
    return texts;
  });
  await tapPoint(page, 135, 758);
  await expect.poll(raidText).toContain("魔王へ攻撃");
  await tapPoint(page, 225, 510);
  await expect.poll(raidText).toContain("-1  魔王撃破！");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-defeat-portrait.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(raidText).toContain("-1  魔王撃破！");
  await expect.poll(raidText).toContain("評価 +80 を受け取る");
  await tapPoint(page, 62, 348);
  await expect.poll(raidText).toContain("評価 +80 を受け取る");
  await tapPoint(page, 591, 397);
  expect(await phase(page)).toBe("title");
  await tapPoint(page, 400, 330);
  await expect.poll(raidText).toContain("評価 +80 獲得。Lv.2 が出現！");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-reward-landscape.png" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(raidText).toContain("評価 +80 獲得。Lv.2 が出現！");
  await expect.poll(raidText).toContain("魔王へ攻撃");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-reward-compact.png" });
  await tapPoint(page, 47, 253);
  await expect.poll(raidText).toContain("魔王へ攻撃");
  await tapPoint(page, 225, 510);
  expect(await page.evaluate(() => Number(localStorage.getItem("karma_quest_total_eval_v1")))).toBe(80);
  await tapPoint(page, 225, 604);
  await expect.poll(raidText).toEqual([]);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(raidText).toEqual([]);
  await tapPoint(page, 150, 348);
  await expect.poll(raidText).toContain("魔王へ攻撃");
  expect((await raidText()).join(" ")).not.toContain("獲得");
});

test("corrupt raid level cannot manufacture a claimable defeat after reload", { tag: "@webkit-regression" }, async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", '{"level":0,"hp":0,"defeats":9}');
    localStorage.setItem("karma_quest_total_eval_v1", "40");
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await tapPoint(page, 135, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("魔王へ攻撃");
  expect((await loadingFeedback(page)).texts.join(" ")).toContain("HP 900 / 900");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-corrupt-level.png" });
  await tapPoint(page, 225, 510);
  const save = await page.evaluate(() => ({
    raid: JSON.parse(localStorage.getItem("karma_quest_solo_raid_v1") ?? "{}"),
    evaluation: Number(localStorage.getItem("karma_quest_total_eval_v1")),
  }));
  expect(save).toEqual({ raid: { level: 1, defeats: 0, hp: 800, maxHp: 900 }, evaluation: 40 });
});

test("incomplete raid save recovers without granting an unearned reward", { tag: "@webkit-regression" }, async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", '{"level":3,"defeats":2}');
    localStorage.setItem("karma_quest_total_eval_v1", "0");
  });
  await tapPoint(page, 135, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("魔王へ攻撃");
  expect((await loadingFeedback(page)).texts.join(" ")).toContain("HP 1600 / 1600");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-raid-save-recovery.png" });
  await tapPoint(page, 225, 510);
  const readSave = () => page.evaluate(() => ({
    raid: JSON.parse(localStorage.getItem("karma_quest_solo_raid_v1") ?? "{}"),
    evaluation: Number(localStorage.getItem("karma_quest_total_eval_v1")),
  }));
  await expect.poll(async () => (await readSave()).raid.hp).toBe(1500);
  expect(await readSave()).toEqual({ raid: { level: 3, defeats: 2, hp: 1500, maxHp: 1600 }, evaluation: 0 });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await tapPoint(page, 135, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts.join(" ")).toContain("HP 1500 / 1600");
});

test("home progress updates immediately after claiming a raid reward", async ({ page }) => {
  const homeValue = (name: string) => page.evaluate(name => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    for (const root of scene.children.list) {
      if (root.type !== "Container") continue;
      const label = (root as Phaser.GameObjects.Container).getByName(name) as Phaser.GameObjects.Text | null;
      if (label) return label.text;
    }
    return "";
  }, name);
  await expect.poll(() => homeValue("home-total-evaluation")).toBe("累計評価 0");
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_solo_raid_v1", '{"level":1,"defeats":0,"hp":0}');
    localStorage.setItem("karma_quest_best_stage_v1", "7");
  });
  await tapPoint(page, 135, 758);
  await tapPoint(page, 225, 510);
  await tapPoint(page, 225, 604);
  await expect.poll(() => homeValue("home-total-evaluation")).toBe("累計評価 80");
  await expect.poll(() => homeValue("home-best-stage")).toBe("最高到達 7年");
  expect((await loadingFeedback(page)).texts.filter(value => value.startsWith("累計評価 "))).toEqual(["累計評価 80"]);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-home-live-reward.png" });
  await tapPoint(page, 315, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts.join(" ")).toContain("Rating 500");
  await tapPoint(page, 225, 551);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("累計評価 80");
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("最高到達 7年");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(() => homeValue("home-total-evaluation")).toBe("累計評価 80");
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(() => homeValue("home-total-evaluation")).toBe("累計評価 80");
  await expect.poll(() => homeValue("home-best-stage")).toBe("最高到達 7年");
});

test("portrait title keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "homeRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りなくて剣が作れない…", karmaDelta: 5 }));
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-title-approved.png",
    animations: "disabled",
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-title-mock.png", {
    // This baseline comes from the approved October composition rendered by
    // the same Node 22/Linux browser stack used in CI.
    animations: "disabled", maxDiffPixelRatio: 0.001,
  });
});

test("home request is the first request and starts without applying karma", async ({ page }) => {
  const preview = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "homeRequest"));
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return { request: Reflect.get(scene, "currentRequest"), karma: Reflect.get(scene, "karma"), stage: Reflect.get(scene, "stage") };
  })).toEqual({ request: preview, karma: { warrior: 0, merchant: 0, outlaw: 0, mage: 0 }, stage: 1 });
});

test("landscape home and chronicle support starting, rotating, and replaying", async ({ page }) => {
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "homeRequest", { id: "mage_stone", faction: "mage", text: "魔法の研究に魔石がほしいのです…", karmaDelta: 5 }));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(async () => (await page.locator("canvas").boundingBox())?.height).toBe(382);
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "onKarmaChoice").call(scene, true);
    Reflect.get(scene, "showFinal").call(scene);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.list.find(item => item.getData("refreshOverview") && Reflect.get(item, "visible")) as Phaser.GameObjects.Container;
    return root?.list.filter(item => "text" in item).map(item => Reflect.get(item, "text"));
  })).toEqual(expect.arrayContaining(["1年目 · 魔石を与えました", "この旅で刻んだ選択：1件", "9"]));
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length)).toBe(0);
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory"))).toEqual([]);
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
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/portrait-battle-current.png" });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-battle-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait report preserves selection limits and rotation state", { tag: "@webkit-regression" }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "startRun").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "stage", 12);
    Reflect.set(scene, "deeds", [
      { id: "one", label: "王都の民へ食料を届けた", quality: 4, tag: "mercy" },
      { id: "two", label: "旅人に道を案内した", quality: 4, tag: "valor" },
    ]);
    Reflect.set(scene, "cheerCount", 1);
    Reflect.get(scene, "showReportPhase").call(scene, { win: true, hpRatioRemaining: 0.5 });
  });
  await expect.poll(() => phase(page)).toBe("report");
  const selected = () => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "highlightRows") as Array<{selected: boolean}>).filter(row => row.selected).length);
  const targets = await page.evaluate(() => {
    const found: Array<{ x: number; y: number; width: number; height: number }> = [];
    const walk = (items: Phaser.GameObjects.GameObject[]) => {
      for (const item of items) {
        if (["cta:軍神", "cta:慈愛神"].includes(item.name)) {
          const bounds = (item as Phaser.GameObjects.Zone).getBounds();
          found.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
        }
        const children = (item as Phaser.GameObjects.Container).list;
        if (Array.isArray(children)) walk(children);
      }
    };
    walk(window.__qaGame.scene.getScene("GameScene").children.list);
    return found.sort((a, b) => a.x - b.x);
  });
  expect(targets).toHaveLength(2);
  const box = (await page.locator("canvas").boundingBox())!;
  for (const target of targets) {
    expect(target.height * box.height / 800).toBeGreaterThanOrEqual(44);
    expect(target.y + target.height).toBeLessThan(291 - 32);
  }
  expect(targets[0]!.x + targets[0]!.width).toBeLessThan(targets[1]!.x);
  const deity = () => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"));
  // Hit the new upper/lower margins outside the visible 56px button.
  await tapPoint(page, 323, 183);
  expect(await deity()).toBe("mercy");
  await tapPoint(page, 127, 243);
  expect(await deity()).toBe("valor");
  await page.mouse.move(box.x + 323 * box.width / 450, box.y + 183 * box.height / 800);
  await page.mouse.down();
  await page.mouse.move(box.x + 225 * box.width / 450, box.y + 250 * box.height / 800);
  await page.mouse.up();
  expect(await deity()).toBe("valor");
  expect(await selected()).toBe(0);
  await tapPoint(page, 225, 680);
  expect(await phase(page)).toBe("report");
  await tapPoint(page, 225, 291);
  await tapPoint(page, 225, 365);
  await tapPoint(page, 225, 439);
  expect(await selected()).toBe(2);
  await tapPoint(page, 225, 291);
  await tapPoint(page, 225, 513);
  expect(await selected()).toBe(2);
  await tapPoint(page, 323, 213);
  await page.setViewportSize({ width: 800, height: 450 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  expect(await selected()).toBe(2);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"))).toBe("mercy");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tapPoint(page, 225, 680);
  await expect.poll(() => phase(page)).toBe("final");
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
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/portrait-report-current.png" });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-report-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
  });
});

test("portrait final keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    await Reflect.get(scene, "startRun").call(scene);
    const choose = Reflect.get(scene, "onKarmaChoice");
    Reflect.set(scene, "currentRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りない", karmaDelta: 5 });
    await choose.call(scene, true);
    Reflect.set(scene, "stage", 2);
    Reflect.set(scene, "phase", "karma");
    Reflect.set(scene, "currentRequest", { id: "mage_book", faction: "mage", text: "禁書を読みたい", karmaDelta: 4 });
    await choose.call(scene, false);
    Reflect.set(scene, "reactionUntil", 0);
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
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.list.find(item => item.getData("refreshChronicle")) as Phaser.GameObjects.Container;
    return root.list.filter(item => item instanceof Object && "text" in item).map(item => Reflect.get(item, "text"));
  })).toEqual(expect.arrayContaining(["2年目\n支援を見送りました", "1年目 · 鉄を届けました", "この旅で刻んだ選択：2件", "14", "9", "44", "5"]));
  const chronicleSpacing = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.list.find(item => item.getData("refreshChronicle")) as Phaser.GameObjects.Container;
    const bounds = (name: string) => (root.getByName(name) as Phaser.GameObjects.Text).getBounds();
    const record = bounds("chronicleRecordCount");
    const replay = bounds("chronicleReplayHint");
    return {
      gap: replay.top - record.bottom,
      replayBottom: replay.bottom,
      replayFontSize: Number.parseFloat(String((root.getByName("chronicleReplayHint") as Phaser.GameObjects.Text).style.fontSize)),
    };
  });
  expect(chronicleSpacing.gap).toBeGreaterThanOrEqual(2);
  expect(chronicleSpacing.replayBottom).toBeLessThanOrEqual(410);
  expect(chronicleSpacing.replayFontSize).toBeGreaterThanOrEqual(14);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-final-chronicle.png",
    animations: "disabled",
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-final-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.005,
  });
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-chronicle-current.png" });
  await page.locator("canvas").click({ position: { x: 225, y: 708 } });
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return { history: Reflect.get(scene, "choiceHistory"), outcome: Reflect.get(scene, "lastOutcome"), reaction: Reflect.get(scene, "reactionUntil"), karma: Reflect.get(scene, "karma") };
  })).toEqual({ history: [], outcome: undefined, reaction: 0, karma: { warrior: 0, merchant: 0, outlaw: 0, mage: 0 } });
});

test("portrait choice reveals the world reaction scene", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const startRun = Reflect.get(scene, "startRun");
    if (typeof startRun === "function") await startRun.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
    .filter(child => child.depth >= 2000 && child.depth <= 2002).length), { timeout: 15000 }).toBe(0);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const choose = Reflect.get(scene, "onKarmaChoice");
    Reflect.set(scene, "currentRequest", { id: "mage_stone", faction: "mage", text: "魔法の研究に魔石がほしいのです…", karmaDelta: 5 });
    if (typeof choose === "function") await choose.call(scene, true);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("karma-reaction-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.01,
  });
  await page.locator("canvas").click({ position: { x: 225, y: 718 } });
  await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").reactionUntil)).toBe(0);
});

test("declining a request changes the world reaction copy and effects", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const startRun = Reflect.get(scene, "startRun");
    if (typeof startRun === "function") await startRun.call(scene);
  });
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const choose = Reflect.get(scene, "onKarmaChoice");
    if (typeof choose === "function") await choose.call(scene, false);
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
  })).toEqual(expect.arrayContaining(["支援を見送りました", "+1", "変化なし"]));
});

test("reaction waits for Next across rotation and advances only once", async ({ page }) => {
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "qaProgressCount", 0);
    for (const name of ["showEncounterPhase", "showBattlePhase"]) {
      const original = Reflect.get(scene, name);
      Reflect.set(scene, name, function () {
        Reflect.set(scene, "qaProgressCount", Reflect.get(scene, "qaProgressCount") + 1);
        return original.call(scene);
      });
    }
    Reflect.set(scene, "stage", 7);
    await Reflect.get(scene, "onKarmaChoice").call(scene, true);
    // A repeated choice must not apply karma or append another record.
    await Reflect.get(scene, "onKarmaChoice").call(scene, true);
  });
  await expect.poll(() => phase(page)).toBe("reaction");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  expect(await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return { progress: Reflect.get(scene, "qaProgressCount"), records: Reflect.get(scene, "choiceHistory").length };
  })).toEqual({ progress: 0, records: 1 });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const screen = scene.children.list.find(item => item.visible && "getByName" in item &&
      (item as Phaser.GameObjects.Container).getByName("reactionYear")) as Phaser.GameObjects.Container;
    return (screen?.getByName("reactionYear") as Phaser.GameObjects.Text)?.text;
  })).toBe("7年目  春");
  await tapPoint(page, 579, 376);
  await expect.poll(() => phase(page)).toMatch(/^(battle|encounter)$/);
  expect(await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "continueAfterReaction").call(scene);
    return Reflect.get(scene, "qaProgressCount");
  })).toBe(1);
});

test("landscape dialogue keeps the request through rotation and both actions work", async ({ page }) => {
  for (const [accepted, width, height] of [[true, 800, 360], [false, 932, 430]] as const) {
    await page.evaluate(async () => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      await Reflect.get(scene, "startRun").call(scene);
      Reflect.set(scene, "currentRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りなくて剣が作れない…", karmaDelta: 5 });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
    await expect.poll(() => page.evaluate(() => window.__qaGame.scene.getScene("GameScene").children.list
      .filter(child => child.depth >= 2000 && child.depth <= 2002).length)).toBe(0);
    expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "currentRequest").id)).toBe("warrior_iron");
    const box = await page.locator("canvas").boundingBox();
    expect(box!.height / 450 * 80).toBeGreaterThanOrEqual(52);
    await tapPoint(page, 591, accepted ? 301 : 397);
    await expect.poll(() => phase(page)).toBe("reaction");
    expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "karma"))).toEqual(
      accepted ? { warrior: 5, merchant: 0, outlaw: 0, mage: 0 } : { warrior: 0, merchant: 1, outlaw: 1, mage: 1 });
  }
});

test("all request results keep readable text separated on compact phones", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await page.locator("canvas").boundingBox())?.width).toBe(314);
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  for (const request of KARMA_REQUESTS) for (const accepted of [true, false]) {
    await page.evaluate(async ({ request, accepted }) => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "phase", "karma");
      Reflect.set(scene, "currentRequest", request);
      await Reflect.get(scene, "onKarmaChoice").call(scene, accepted);
    }, { request, accepted });
    for (const mode of ["reaction", "wide", "final", "wide-final"]) {
      if (mode !== "reaction") {
        await page.setViewportSize(mode === "final" ? { width: 320, height: 568 } : { width: 844, height: 390 });
        await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(mode === "final" ? 450 : 800);
      }
      if (mode === "final") await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "showFinal").call(window.__qaGame.scene.getScene("GameScene")));
      await expect.poll(() => page.evaluate(({ mode, expectedArt, outcomeKeys }) => {
        const scene = window.__qaGame.scene.getScene("GameScene");
        const labels: Phaser.GameObjects.Text[] = [];
        const artwork: string[] = [];
        const visit = (node: Phaser.GameObjects.GameObject): void => {
          if (Reflect.get(node, "visible") === false) return;
          if ("text" in node) labels.push(node as Phaser.GameObjects.Text);
          if ("texture" in node) artwork.push((node as Phaser.GameObjects.Image).texture.key);
          if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
        };
        scene.children.list.forEach(visit);
        const byName = (name: string) => labels.find(label => label.name === name);
        const body = byName(mode === "wide-final" ? "landscape-chronicle-body" : mode === "final" ? "chronicleBody" : "reactionBody");
        const other = byName(mode === "wide-final" ? "landscape-chronicle-title" : mode === "final" ? "chronicleTitle" : "reactionQuote");
        if (!body || !other) return false;
        const a = body.getBounds(), b = other.getBounds();
        const canvas = document.querySelector("canvas")!;
        const scale = canvas.getBoundingClientRect().width / canvas.width;
        const readable = [body, ...labels.filter(label => label.name.startsWith("stat:"))]
          .every(label => Number.parseFloat(String(label.style.fontSize)) * scale >= 14);
        const separated = a.bottom + 3 <= b.top || b.bottom + 3 <= a.top;
        const inside = a.left >= 20 && a.right <= canvas.width - 20 && (mode !== "final" || a.bottom <= 303)
          && (mode !== "wide-final" || (a.left >= 540 && a.top >= 145 && a.bottom <= 283));
        const activeArt = artwork.filter(key => outcomeKeys.includes(key));
        return readable && separated && inside && activeArt.length === 1 && activeArt[0] === expectedArt;
      }, { mode, expectedArt: outcomeArtKey(request.id, accepted), outcomeKeys: Object.entries(OUTCOME_ART).filter(([id]) => id !== "village_food").flatMap(([, keys]) => [...keys]) }), { message: `${request.id}, accepted=${accepted}, ${mode}` }).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  }
});

test("choice explanation follows the current request's actual faction and delta", async ({ page }) => {
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  for (const request of [
    { id: "warrior_iron", faction: "warrior", text: "鉄が足りなくて剣が作れない…", karmaDelta: 5, expected: "戦士の力 +5・勇者が成長" },
    { id: "mage_book", faction: "mage", text: "禁書を読む許可がほしい…", karmaDelta: 4, expected: "魔術師の力 +4・勇者が成長" },
  ]) {
    await page.evaluate(value => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "currentRequest", value), request);
    await expect.poll(() => page.evaluate(() => {
      const labels: string[] = [];
      const visit = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const item = node as { text?: string; list?: unknown[] };
        if (item.text) labels.push(item.text);
        item.list?.forEach(visit);
      };
      window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
      return labels;
    })).toContain(request.expected);
  }
});

test("requester portraits follow every request in home and rotated dialogue", async ({ page }) => {
  test.setTimeout(120000);
  const portraits = () => page.evaluate(() => {
    const keys: string[] = [];
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (Reflect.get(node, "visible") === false) return;
      if ("texture" in node) {
        const key = (node as Phaser.GameObjects.Image).texture.key;
        if (key.startsWith("kq-dialogue-") && !key.includes("hero")) keys.push(key);
      }
      if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    window.__qaGame.scene.getScene("GameScene").children.list.forEach(visit);
    return keys;
  });
  for (const request of KARMA_REQUESTS) {
    await page.setViewportSize({ width: 320, height: 568 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
    await page.evaluate(request => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "phase", "title"); Reflect.set(scene, "homeRequest", request);
    }, request);
    await expect.poll(portraits).toEqual([`kq-dialogue-${request.faction}-${request.faction === "warrior" ? "v3" : "v1"}`]);
    await page.setViewportSize({ width: 800, height: 360 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
    await expect.poll(portraits).toEqual([`kq-dialogue-${request.faction}-${request.faction === "warrior" ? "v3" : "v1"}`]);
    const copyBounds = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      let bounds: { left: number; right: number; top: number; bottom: number } | null = null;
      const visit = (node: Phaser.GameObjects.GameObject) => {
        if (node.name === "landscape-home-request-body") {
          const rect = (node as Phaser.GameObjects.Text).getBounds();
          bounds = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }
        if ("list" in node) (node as Phaser.GameObjects.Container).list.forEach(visit);
      };
      scene.children.list.forEach(visit);
      return bounds;
    });
    expect(copyBounds).not.toBeNull();
    expect(copyBounds!.left).toBeGreaterThan(530);
    expect(copyBounds!.right).toBeLessThan(780);
    expect(copyBounds!.top).toBeGreaterThan(150);
    expect(copyBounds!.bottom).toBeLessThan(280);
    await page.setViewportSize({ width: 320, height: 568 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
    // Canvas resize precedes the scene update which activates portrait input.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await tapPoint(page, 225, 660);
    await expect.poll(() => phase(page)).toBe("karma");
    await page.waitForFunction(() => !window.__qaGame.scene.getScene("GameScene").children.list.some(child => child.depth >= 2000 && child.depth <= 2002));
    await expect.poll(portraits).toEqual([`kq-dialogue-${request.faction}-${request.faction === "warrior" ? "v3" : "v1"}`]);
    await page.setViewportSize({ width: 800, height: 360 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
    await expect.poll(portraits).toEqual([`kq-dialogue-${request.faction}-${request.faction === "warrior" ? "v3" : "v1"}`]);
  }
});

test("landscape home information opens without activating the journey behind it", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  // ワールド(index=1)は専用Raidモーダルを開くため、共通情報モーダルの対象外。
  for (const index of [0, 2, 3, 4, 5, 6]) {
    await tapPoint(page, 62 + (index % 4) * 88, index < 4 ? 348 : 407);
    await expect.poll(() => page.evaluate(() => {
      const find = (node: Phaser.GameObjects.GameObject): boolean => {
        if (node.name === "home-information-wide") return Reflect.get(node, "visible") === true;
        return "list" in node && (node as Phaser.GameObjects.Container).list.some(find);
      };
      return window.__qaGame.scene.getScene("GameScene").children.list.some(find);
    })).toBe(true);
    await tapPoint(page, 760, 397);
    expect(await phase(page)).toBe("title");
    await tapPoint(page, 400, 385);
  }
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
});

test("landscape encounter battle and report remain operable through rotation", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "stage", 12);
    Reflect.get(scene, "showEncounterPhase").call(scene);
  });
  await tapPoint(page, 591, 322);
  await expect.poll(() => phase(page)).toBe("battle");
  await tapPoint(page, 591, 396);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "cheerCount"))).toBe(1);
  await expect.poll(() => phase(page), { timeout: 10000 }).toBe("report");
  await tapPoint(page, 609, 405);
  expect(await phase(page)).toBe("report");
  await tapPoint(page, 215, 150);
  await tapPoint(page, 699, 144);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "deity"))).toBe("mercy");
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 609, 405);
  await expect.poll(() => phase(page)).toBe("final");
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
});

test("best year survives an interrupted journey and a new start", async ({ page }) => {
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await tapPoint(page, 225, 598);
  await expect.poll(() => phase(page)).toBe("reaction");
  await tapPoint(page, 225, 750);
  await expect.poll(() => phase(page)).toMatch(/^(encounter|battle)$/);
  if (await phase(page) === "encounter") await tapPoint(page, 225, 460);
  await expect.poll(() => phase(page)).toBe("battle");
  await tapPoint(page, 225, 560);
  await expect.poll(() => phase(page)).toBe("report");
  await tapPoint(page, 225, 291);
  await tapPoint(page, 225, 680);
  await expect.poll(() => phase(page)).toBe("karma");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("karma_quest_best_stage_v1"))).toBe("2");
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("最高到達 2年");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-best-year-checkpoint.png" });
  const total = await page.evaluate(() => Number(localStorage.getItem("karma_quest_total_eval_v1")));
  await tapPoint(page, 315, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts.join(" ")).toContain(`Rating ${total + 120}`);
  await tapPoint(page, 225, 551);
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "stage"))).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_best_stage_v1"))).toBe("2");
});

test("a normal twelve-year journey finishes using touch in both orientations", async ({ page }) => {
  test.setTimeout(180000);
  await tapPoint(page, 225, 660);
  for (let year = 1; year <= 12; year++) {
    await expect.poll(() => phase(page)).toBe("karma");
    expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "stage"))).toBe(year);
      expect(await page.evaluate(() => Number(localStorage.getItem("karma_quest_best_stage_v1")))).toBe(year);
    const wide = year % 2 === 0;
    await page.setViewportSize(wide ? { width: 800, height: 360 } : { width: 320, height: 568 });
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(wide ? 800 : 450);
    await tapPoint(page, wide ? 591 : 225, wide ? 301 : 598);
    await expect.poll(() => phase(page)).toBe("reaction");
    await tapPoint(page, wide ? 579 : 225, wide ? 376 : 750);
    await expect.poll(() => phase(page)).toMatch(/^(encounter|battle)$/);
    if (await phase(page) === "encounter") await tapPoint(page, wide ? 591 : 225, wide ? 322 : 460);
    await expect.poll(() => phase(page)).toBe("battle");
    await tapPoint(page, wide ? 591 : 225, wide ? 396 : 560);
    await expect.poll(() => phase(page)).toBe("report");
    await tapPoint(page, wide ? 215 : 225, wide ? 150 : 291);
    await tapPoint(page, wide ? 609 : 225, wide ? 405 : 680);
  }
  await expect.poll(() => phase(page)).toBe("final");
  expect(await page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory") as unknown[]).length)).toBe(12);
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_best_stage_v1"))).toBe("12");
});


async function loadingFeedback(page: Page) {
  return page.evaluate(() => {
    const texts: string[] = [];
    const actions: boolean[] = [];
    const visit = (nodes: Phaser.GameObjects.GameObject[]) => {
      for (const node of nodes) {
        if (Reflect.get(node, "visible") === false) continue;
        if (node.type === "Text") texts.push((node as Phaser.GameObjects.Text).text);
        if (node.name.startsWith("cta:")) actions.push(!!node.input?.enabled);
        if (node.type === "Container") visit((node as Phaser.GameObjects.Container).list);
      }
    };
    visit(window.__qaGame.scene.getScene("GameScene").children.list);
    return { texts, actions };
  });
}

test("result images load on demand and retry without duplicate choices", async ({ page }) => {
  allowedConsoleErrors.get(page)?.push(/Failed to load resource: net::ERR_FAILED/);
  await page.waitForFunction(() => window.__qaGame.scene.getScene("GameScene").sys.isActive());
  expect(await page.evaluate(() => performance.getEntriesByType("resource").filter(r => r.name.includes("kq-outcome-")).length)).toBe(0);
  const key = "kq-outcome-warrior_iron-accept-v2";
  let attempts = 0;
  let failRequests = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/${key}.webp`, async route => {
    attempts++;
    if (failRequests) { await route.abort(); return; }
    await gate;
    await route.continue();
  });
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "currentRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りない", karmaDelta: 5 });
  });
  await page.waitForFunction(() => !window.__qaGame.scene.getScene("GameScene").children.list.some(child => child.depth >= 2000 && child.depth <= 2002));
  await tapPoint(page, 225, 598);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "artError"))).toBe(true);
  await expect.poll(async () => (await loadingFeedback(page)).texts.filter(t => t === "読込失敗・この選択で再試行").length).toBe(2);
  expect((await loadingFeedback(page)).texts).toContain("依頼  戦士の派閥");
  expect((await loadingFeedback(page)).actions).toEqual([true, true]);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-loading-error-portrait.png" });
  expect(await phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory").length)).toBe(0);
  const failedAttempts = attempts;
  failRequests = false;
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 591, 301);
  await expect.poll(() => attempts).toBe(failedAttempts + 1);
  await expect.poll(async () => (await loadingFeedback(page)).actions).toEqual([false, false]);
  expect((await loadingFeedback(page)).texts).toContain("依頼  戦士の派閥");
  expect((await loadingFeedback(page)).texts.filter(t => t === "場面を準備しています…")).toHaveLength(2);
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-loading-landscape.png" });
  await tapPoint(page, 591, 397);
  expect(await phase(page)).toBe("karma");
  release();
  await expect.poll(() => phase(page)).toBe("reaction");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory").length)).toBe(1);
  expect(await page.evaluate(key => window.__qaGame.textures.exists(key), key)).toBe(true);
  expect(attempts).toBe(failedAttempts + 1);
});

test("a pending choice completes once after page freeze and resume", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route("**/kq-outcome-warrior_iron-accept-v2.webp", async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "currentRequest",
    { id: "warrior_iron", faction: "warrior", text: "鉄が足りない", karmaDelta: 5 }));
  await tapPoint(page, 225, 598);
  await expect.poll(() => requested).toBe(true);
  try {
    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    release();
    await page.setViewportSize({ width: 844, height: 390 });
  } finally {
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
  }
  await expect.poll(() => phase(page)).toBe("reaction");
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory").length)).toBe(1);
  await tapPoint(page, 579, 376);
  await expect.poll(() => phase(page)).toMatch(/^(encounter|battle)$/);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory").length)).toBe(1);
});

test("boot progress survives rotation and clears when assets are ready", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/kq-bg-capital-home-v3.webp", async route => {
    await gate;
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").children.getByName("boot-progress"));
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-boot-progress.png" });
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-boot-progress-landscape.png" });
  release();
  await page.waitForFunction(() => window.__qaGame.scene.getScene("GameScene").sys.isActive());
  expect(await page.evaluate(() => !!window.__qaGame.scene.getScene("GameScene").children.getByName("boot-progress"))).toBe(false);
  await tapPoint(page, 591, 397);
  await expect.poll(() => phase(page)).toBe("karma");
});

test("home loads only its artwork and journey preparation retries safely", async ({ page }) => {
  allowedConsoleErrors.get(page)?.push(/Failed to load resource: net::ERR_FAILED/);
  const initial = await page.evaluate(() => {
    const images = performance.getEntriesByType("resource").filter(r => r.name.includes("/images/")) as PerformanceResourceTiming[];
    return { hasDialogue: images.some(r => r.name.includes("kq-bg-dialogue-arcade")), bytes: images.reduce((sum, r) => sum + r.encodedBodySize, 0) };
  });
  expect(initial.hasDialogue).toBe(false);
  expect(initial.bytes).toBeLessThan(2_100_000);
  let failRequests = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/kq-bg-dialogue-arcade-v1.webp", async route => {
    if (failRequests) { await route.abort(); return; }
    await gate; await route.continue();
  });
  await tapPoint(page, 225, 660);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "journeyError"))).toBe(true);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("読込失敗・依頼を押して再試行");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-journey-error-portrait.png" });
  expect(await phase(page)).toBe("title");
  failRequests = false;
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(() => page.locator("canvas").evaluate(c => (c as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tapPoint(page, 591, 397);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "journeyPending"))).toBe(true);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("旅の準備中…");
  await page.locator("canvas").screenshot({ path: "../../docs/review/karma-journey-loading.png" });
  await tapPoint(page, 591, 397);
  expect(await phase(page)).toBe("title");
  release();
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "stage"))).toBe(1);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "choiceHistory").length)).toBe(0);
});


test("corrupt persisted progress does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_best_stage_v1", "-999");
    localStorage.setItem("karma_quest_total_eval_v1", "NaN");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
});

test("invalid progress recovers through home league and reward claiming", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    localStorage.setItem("karma_quest_best_stage_v1", "99");
    localStorage.setItem("karma_quest_total_eval_v1", "1.5");
    localStorage.setItem("karma_quest_solo_raid_v1", '{"level":1,"defeats":0,"hp":0}');
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(async () => Math.round((await page.locator("canvas").boundingBox())?.width ?? 0)).toBe(314);
  await page.screenshot({ path: "../../docs/review/karma-progress-recovery.png" });
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("最高到達 0年");
  expect((await loadingFeedback(page)).texts).toContain("累計評価 0");
  await tapPoint(page, 315, 758);
  await expect.poll(async () => (await loadingFeedback(page)).texts.join(" ")).toContain("Bronze LEAGUE · Rating 0");
  await tapPoint(page, 225, 551);
  await tapPoint(page, 135, 758);
  await tapPoint(page, 225, 510);
  await tapPoint(page, 225, 604);
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("累計評価 80");
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_total_eval_v1"))).toBe("80");
  await page.waitForFunction(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning);
  await page.screenshot({ path: "../../docs/review/karma-progress-recovery.png" });
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame?.scene.getScene("GameScene").sys.isActive());
  await expect.poll(async () => (await loadingFeedback(page)).texts).toContain("累計評価 80");
  await tapPoint(page, 225, 650);
  await expect.poll(() => phase(page)).toBe("karma");
  expect(await page.evaluate(() => localStorage.getItem("karma_quest_best_stage_v1"))).toBe("1");
});


test("final chronicle changes replay prompt for different choice strategies", async ({ page }) => {
  await useNativePortrait(page);
  const readPrompt = async (supported: boolean) => page.evaluate(async ({ supported }) => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const outcome = (year: number, accepted: boolean, faction: "warrior" | "merchant" | "outlaw" | "mage") => ({
      year,
      outcome: {
        faction,
        requestId: "qa",
        title: accepted ? "支援しました" : "支援を見送りました",
        body: accepted ? "支援の結果です。" : "見送った結果です。",
        quote: "",
        deltas: [0, 0, 0, 0],
      },
    });
    const history = supported
      ? [
          outcome(1, true, "warrior"),
          outcome(2, true, "mage"),
          outcome(3, true, "merchant"),
          outcome(4, false, "outlaw"),
        ]
      : [
          outcome(1, false, "warrior"),
          outcome(2, false, "mage"),
          outcome(3, false, "merchant"),
          outcome(4, true, "outlaw"),
        ];
    Reflect.set(scene, "choiceHistory", history);
    Reflect.set(scene, "stage", 12);
    Reflect.set(scene, "runEvaluation", 120);
    Reflect.set(scene, "legendCounts", { valor: 4, mercy: 4 });
    Reflect.get(scene, "showFinal").call(scene);
    await new Promise(resolve => setTimeout(resolve, 80));
    const root = scene.children.list.find(item => item.getData("refreshChronicle")) as Phaser.GameObjects.Container;
    (root.getData("refreshChronicle") as () => void)();
    return (root.getByName("chronicleReplayHint") as Phaser.GameObjects.Text | null)?.text ?? "";
  }, { supported });

  const supportPrompt = await readPrompt(true);
  const selectivePrompt = await readPrompt(false);
  expect(supportPrompt).toMatch(/次の旅|NEXT RUN/);
  expect(selectivePrompt).toMatch(/次の旅|NEXT RUN/);
  expect(supportPrompt).not.toBe(selectivePrompt);
});

test("unavailable home routes do not advertise an active hand cursor", async ({ page }) => {
  const readCursor = (name: string) => page.evaluate(target => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let cursor: string | undefined;
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (node.name === target) cursor = node.input?.cursor;
      if (node.type === "Container") (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return cursor ?? "";
  }, name);

  await expect.poll(() => readCursor("home-nav:1")).toBe("pointer");
  await expect.poll(() => readCursor("home-nav:4")).not.toBe("pointer");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => readCursor("home-nav-wide:ワールド")).toBe("pointer");
  await expect.poll(() => readCursor("home-nav-wide:ショップ")).not.toBe("pointer");
});
