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
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const status = root.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
    return root.visible && status.text.includes("覇者・剛") && !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
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

  await expect.poll(() => page.evaluate(() => {
    const root = window.__qaGame.scene.getScene("GameScene").children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    return (root.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).text;
  })).toBe("覇者モード 使用済");
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

test("English Haja choices explain each effect on compact tablet", async ({ page }) => {
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  const read = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const buttons = root.list.filter(node => node.type === "Container") as Phaser.GameObjects.Container[];
    return {
      status: status!.text, hint: hint!.text,
      playerLabel: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
      labels: buttons.map(button => (button.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).text),
      hintWidth: hint!.getBounds().width,
      hintFont: Number.parseFloat(hint!.style.fontSize),
      buttonsFit: buttons.every(button => (button.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).width < button.width),
    };
  });
  await expect.poll(read).toMatchObject({ status: "HAJA · 1 USE / 5s", hint: "ATK Power · DEF Guard · SPD Fast", playerLabel: "PLAYER · Ryuga [1/1]", labels: ["ATK", "DEF", "SPD"], buttonsFit: true, hintFont: 20 });
  expect((await read()).hintWidth).toBeLessThanOrEqual(410);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/small-tablet-haja-english.png" });
  const canvas = (await page.locator("canvas").boundingBox())!;
  const logical = await page.locator("canvas").evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(canvas.x + 330 * canvas.width / logical.width, canvas.y + 388 * canvas.height / logical.height);
  await expect.poll(read).toMatchObject({ status: expect.stringContaining("ATK"), hint: "Damage +40%" });
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/small-tablet-haja-active-english.png" });
  for (const [mode, label, hint] of [["go", "ATK", "Damage +40%"], ["ju", "DEF", "Damage taken -50%"], ["shun", "SPD", "Faster special & recovery"]] as const) {
    await page.evaluate(mode => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.get(scene, "startSingleBattle").call(scene);
      Reflect.get(scene, "activateHajaMode").call(scene, mode);
    }, mode);
    await expect.poll(read).toMatchObject({ status: expect.stringContaining(label), hint });
    expect((await read()).hintWidth).toBeLessThanOrEqual(410);
  }
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "hajaRemainingMs", 1));
  await expect.poll(read).toMatchObject({ status: "HAJA USED", hint: "Ready next round" });
});

test("English Haja controls stay usable on a short phone", async ({ page }) => {
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const buttons = root.list.filter(node => node.type === "Container") as Phaser.GameObjects.Container[];
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    return { width: scene.scale.gameSize.width, x: buttons[0]!.x, status: status!.text, hint: hint!.text, labels: buttons.map(button => (button.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).text) };
  })).toEqual({ width: 450, x: 110, status: "HAJA · 1 USE / 5s", hint: "ATK Up · DEF Guard · SPD Fast", labels: ["ATK", "DEF", "SPD"] });
  // A portrait-to-portrait resize can briefly retain the previous canvas height.
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  const readGeometry = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const b = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const label = b.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
    const area = b.input!.hitArea as Phaser.Geom.Rectangle;
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container | undefined => {
      for (const node of nodes) {
        if (node.name === "mobile-move-punch") return node as Phaser.GameObjects.Container;
        if (node.type === "Container") { const found = find((node as Phaser.GameObjects.Container).list); if (found) return found; }
      }
      return undefined;
    };
    const move = find(scene.children.list)!;
    const moveHit = move.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return {
      statusPx: Number.parseFloat(status!.style.fontSize) * scale,
      hintPx: Number.parseFloat(hint!.style.fontSize) * scale,
      labelPx: Number.parseFloat(label.style.fontSize) * b.scaleY * scale,
      hitPx: area.height * b.scaleY * scale,
      hintLeft: hint!.getBounds().left, hintRight: hint!.getBounds().right,
      statusBottom: status!.getBounds().bottom, hintTop: hint!.getBounds().top, hintBottom: hint!.getBounds().bottom,
      hitTop: b.y + (area.y - b.displayOriginY) * b.scaleY,
      hitBottom: b.y + (area.y + area.height - b.displayOriginY) * b.scaleY,
      moveTop: move.y - moveHit.height / 2,
    };
  });
  await expect.poll(async () => {
    const state = await readGeometry();
    return state.hintBottom < state.hitTop && state.hitBottom < state.moveTop;
  }).toBe(true);
  const geometry = await readGeometry();
  expect(geometry.statusPx).toBeGreaterThanOrEqual(14);
  expect(geometry.hintPx).toBeGreaterThanOrEqual(14);
  expect(geometry.labelPx).toBeGreaterThanOrEqual(14);
  expect(geometry.hitPx).toBeGreaterThanOrEqual(44);
  expect(geometry.hintLeft).toBeGreaterThanOrEqual(10);
  expect(geometry.hintRight).toBeLessThanOrEqual(440);
  expect(geometry.statusBottom).toBeLessThan(geometry.hintTop);
  expect(geometry.hintBottom).toBeLessThan(geometry.hitTop);
  expect(geometry.hitBottom).toBeLessThan(geometry.moveTop);
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/short-phone-haja-english.png" });
  const canvas = (await page.locator("canvas").boundingBox())!;
  const logical = await page.locator("canvas").evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(canvas.x + 120 * canvas.width / logical.width, canvas.y + (geometry.moveTop + 3) * canvas.height / logical.height);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaUsed"))).toBe(false);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  await page.touchscreen.tap(canvas.x + 110 * canvas.width / logical.width, canvas.y + (geometry.hitBottom - 2) * canvas.height / logical.height);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaMode"))).toBe("go");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => {
    const root = window.__qaGame.scene.getScene("GameScene").children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const b = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
    const status = root.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
    return { x: b.x, height: (b.input!.hitArea as Phaser.Geom.Rectangle).height, font: Number.parseFloat(status.style.fontSize) };
  })).toEqual({ x: 330, height: 64, font: 21 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") { const found = find((node as Phaser.GameObjects.Container).list, name); if (found) return found; }
      }
      return undefined;
    };
    const tell = find(scene.children.list, "mobile-battle-tell") as Phaser.GameObjects.Text;
    const move = find(scene.children.list, "mobile-move-punch") as Phaser.GameObjects.Container;
    const moveHit = move.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const b = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
    const area = b.input!.hitArea as Phaser.Geom.Rectangle;
    const player = Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image;
    return { width: scene.scale.gameSize.width, status: status!.text, hintFont: Number.parseFloat(hint!.style.fontSize),
      separated: tell.getBounds().bottom < status!.getBounds().top,
      heroVisible: status!.getBounds().top > player.y,
      inputSeparated: b.y + (area.y + area.height - b.displayOriginY) * b.scaleY < move.y - moveHit.height / 2 };
  })).toEqual({ width: 450, status: "HAJA · 1 USE / 5s", hintFont: 23, separated: true, heroVisible: true, inputSeparated: true });
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/phone-haja-english.png" });
});

test("Japanese Haja guidance fits on a short phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const b = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
    const area = b.input!.hitArea as Phaser.Geom.Rectangle;
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return { width: scene.scale.gameSize.width, hint: hint!.text, fontPx: Number.parseFloat(hint!.style.fontSize) * scale,
      left: hint!.getBounds().left, right: hint!.getBounds().right, gap: b.y + (area.y - b.displayOriginY) * b.scaleY - hint!.getBounds().bottom,
      separated: status!.getBounds().bottom < hint!.getBounds().top };
  })).toMatchObject({ width: 450, hint: "剛=威力  柔=軽減  瞬=速攻", fontPx: expect.any(Number), separated: true });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  const bounds = await page.evaluate(() => {
    const root = window.__qaGame.scene.getScene("GameScene").children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const hint = (root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[])[1]!;
    const b = root.list.find(node => node.type === "Container") as Phaser.GameObjects.Container;
    const area = b.input!.hitArea as Phaser.Geom.Rectangle;
    return { left: hint.getBounds().left, right: hint.getBounds().right, gap: b.y + (area.y - b.displayOriginY) * b.scaleY - hint.getBounds().bottom,
      fontPx: Number.parseFloat(hint.style.fontSize) * window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width };
  });
  expect(bounds.fontPx).toBeGreaterThanOrEqual(14);
  expect(bounds.left).toBeGreaterThanOrEqual(10);
  expect(bounds.right).toBeLessThanOrEqual(440);
  expect(bounds.gap).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await page.screenshot({ path: "e2e/screenshots/short-phone-haja-japanese.png" });
});

test("landscape Haja guidance stays readable and does not steal a move tap", async ({ page }) => {
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  await page.setViewportSize({ width: 568, height: 320 });
  await expect.poll(() => page.locator("canvas").evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height, cssWidth: Math.round(node.getBoundingClientRect().width) })))
    .toEqual({ width: 800, height: 450, cssWidth: 550 });
  const read = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const buttons = root.list.filter(node => node.type === "Container") as Phaser.GameObjects.Container[];
    const b = buttons[1]!;
    const label = b.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
    const area = b.input!.hitArea as Phaser.Geom.Rectangle;
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") { const found = find((node as Phaser.GameObjects.Container).list, name); if (found) return found; }
      }
      return undefined;
    };
    const move = find(scene.children.list, "mobile-move-punch") as Phaser.GameObjects.Container;
    const moveHit = move.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return { statusPx: Number.parseFloat(status!.style.fontSize) * scale, hintPx: Number.parseFloat(hint!.style.fontSize) * scale,
      labelPx: Number.parseFloat(label.style.fontSize) * b.scaleY * scale, hintWidth: hint!.getBounds().width,
      statusBottom: status!.getBounds().bottom, hintTop: hint!.getBounds().top, hintBottom: hint!.getBounds().bottom,
      hajaTop: b.y + (area.y - b.displayOriginY) * b.scaleY,
      hajaBottom: b.y + (area.y + area.height - b.displayOriginY) * b.scaleY,
      moveTop: move.y - moveHit.height * move.scaleY / 2,
      labels: buttons.map(button => (button.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).text) };
  });
  await expect.poll(async () => ({ labels: (await read()).labels, statusPx: (await read()).statusPx })).toEqual({ labels: ["ATK", "DEF", "SPD"], statusPx: 14.4375 });
  const initial = await read();
  expect(initial.hajaBottom).toBeLessThan(initial.moveTop);
  expect(initial.statusPx).toBeGreaterThanOrEqual(14);
  expect(initial.hintPx).toBeGreaterThanOrEqual(14);
  expect(initial.labelPx).toBeGreaterThanOrEqual(14);
  expect(initial.statusBottom).toBeLessThan(initial.hintTop);
  expect(initial.hintBottom).toBeLessThan(initial.hajaTop);
  expect(initial.hintWidth).toBeLessThanOrEqual(410);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return Reflect.get(scene, "accepting") === true && !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "e2e/screenshots/short-landscape-haja-english.png" });
  const canvas = (await page.locator("canvas").boundingBox())!;
  const tap = (x: number, y: number) => page.touchscreen.tap(canvas.x + x * canvas.width / 800, canvas.y + y * canvas.height / 450);
  await tap(410, initial.moveTop + 2);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaUsed"))).toBe(false);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  await tap(400, initial.hajaBottom - 2);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "hajaMode"))).toBe("ju");
});

test("Japanese landscape Haja guidance remains readable and separated", async ({ page }) => {
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
  await page.setViewportSize({ width: 568, height: 320 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(550);
  const read = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("haja-mode-controls") as Phaser.GameObjects.Container;
    const [status, hint] = root.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const buttons = root.list.filter(node => node.type === "Container") as Phaser.GameObjects.Container[];
    const button = buttons[1]!;
    const label = button.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
    const hit = button.input!.hitArea as Phaser.Geom.Rectangle;
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return { statusFont: Number.parseFloat(status!.style.fontSize), statusPx: Number.parseFloat(status!.style.fontSize) * scale,
      hintPx: Number.parseFloat(hint!.style.fontSize) * scale, labelPx: Number.parseFloat(label.style.fontSize) * button.scaleY * scale,
      statusBottom: status!.getBounds().bottom, hintTop: hint!.getBounds().top, hintBottom: hint!.getBounds().bottom,
      hintWidth: hint!.getBounds().width, buttonTop: button.y + (hit.y - button.displayOriginY) * button.scaleY,
      labels: buttons.map(item => (item.list.find(node => node.type === "Text") as Phaser.GameObjects.Text).text) };
  });
  await expect.poll(async () => (await read()).statusFont).toBe(21);
  const state = await read();
  expect(state.labels).toEqual(["剛", "柔", "瞬"]);
  expect(state.statusPx).toBeGreaterThanOrEqual(14);
  expect(state.hintPx).toBeGreaterThanOrEqual(14);
  expect(state.labelPx).toBeGreaterThanOrEqual(14);
  expect(state.statusBottom).toBeLessThan(state.hintTop);
  expect(state.hintBottom).toBeLessThan(state.buttonTop);
  expect(state.hintWidth).toBeLessThanOrEqual(350);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return Reflect.get(scene, "accepting") === true && !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "e2e/screenshots/short-landscape-haja-japanese.png" });
});
