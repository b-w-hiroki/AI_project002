import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";

declare global { interface Window { __qaGame: Phaser.Game } }

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
  page.on("console", message => {
    if (message.type() === "error") messages.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", request => {
    if (request.url().startsWith("http://localhost:15176")) {
      messages.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
    }
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
  await waitForSceneReady(page);
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test("portrait phone uses the available viewport height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => {
    const box = await page.locator("canvas").boundingBox();
    return box ? {
      top: box.y,
      bottomGap: 844 - (box.y + box.height),
      height: box.height,
    } : null;
  }).toMatchObject({
    top: expect.any(Number),
    bottomGap: expect.any(Number),
    height: expect.any(Number),
  });

  const box = await page.locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(820);
  expect(box!.y).toBeLessThanOrEqual(12);
  expect(844 - (box!.y + box!.height)).toBeLessThanOrEqual(12);
});

test("short portrait separates opponent guidance and keeps primary actions touchable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  const layout = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const bounds = (name: string) => {
      const node = find(scene.children.list, name) as Phaser.GameObjects.Container | Phaser.GameObjects.Text;
      const rect = node.getBounds();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      opponent: bounds("title-opponent-charge"),
      hint: bounds("title-opponent-hint"),
      battle: bounds("title-battle"),
      gacha: bounds("title-gacha"),
      logicalHeight: window.__qaGame.canvas.height,
    };
  });
  const box = (await page.locator("canvas").boundingBox())!;
  expect(layout.hint.top - layout.opponent.bottom).toBeGreaterThanOrEqual(8);
  expect(layout.battle.height * box.height / layout.logicalHeight).toBeGreaterThanOrEqual(44);
  expect(layout.gacha.bottom).toBeLessThanOrEqual(layout.logicalHeight - 16);
  await checkFrame(page, "short-portrait-title-flow");
});

test("compact portrait keeps the guided move reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "title-mode-guide") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const guide = find(scene.children.list);
    return guide ? Number.parseInt(guide.style.fontSize, 10) : null;
  })).toBe(23);
  const intro = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const findText = (nodes: Phaser.GameObjects.GameObject[], match: (node: Phaser.GameObjects.Text) => boolean): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.type === "Text" && match(node as Phaser.GameObjects.Text)) return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = findText((node as Phaser.GameObjects.Container).list, match);
          if (nested) return nested;
        }
      }
      return null;
    };
    const guide = findText(scene.children.list, node => node.name === "title-mode-guide")!;
    const status = guide.parentContainer.list[2] as Phaser.GameObjects.Text;
    return {
      guideBottom: guide.getBounds().bottom,
      statusTop: status.getBounds().top,
      guideFontSize: Number.parseInt(guide.style.fontSize, 10),
    };
  });
  await checkFrame(page, "compact-portrait-title-before");
  await expect.poll(async () => {
    const box = await page.locator("canvas").boundingBox();
    return box ? intro.guideFontSize * box.width / 450 : 0;
  }).toBeGreaterThanOrEqual(14);
  expect(intro.statusTop - intro.guideBottom).toBeGreaterThanOrEqual(8);
  const titleHitHeight = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container | null => {
      for (const node of nodes) {
        if (node.name === "title-battle") return node as Phaser.GameObjects.Container;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const battle = find(scene.children.list)!;
    const hit = battle.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    return hit.input?.hitArea.height as number;
  });
  const titleCanvas = (await page.locator("canvas").boundingBox())!;
  const titleLogicalHeight = await page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).height);
  expect(titleHitHeight * titleCanvas.height / titleLogicalHeight).toBeGreaterThanOrEqual(44);
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await readBattleStatus(page)).map(label => label.text)).toEqual([
    expect.stringMatching(/^自分HP \d+$/), expect.stringMatching(/^残\d+秒$/), expect.stringMatching(/^相手HP \d+$/),
  ]);
  const status = await readBattleStatus(page);
  await expect.poll(async () => {
    const box = await page.locator("canvas").boundingBox();
    return box ? Math.min(...status.map(label => label.fontSize)) * box.width / 450 : 0;
  }).toBeGreaterThanOrEqual(14);
  expect(status[0]!.left).toBeGreaterThanOrEqual(8);
  expect(status[2]!.right).toBeLessThanOrEqual(442);
  for (const label of status) {
    expect(label.top).toBeGreaterThanOrEqual(8);
    expect(label.bottom).toBeLessThanOrEqual(54);
  }
  expect(status[0]!.right).toBeLessThan(status[1]!.left);
  expect(status[1]!.right).toBeLessThan(status[2]!.left);
  const readLayout = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | null => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return null;
    };
    const kick = find(scene.children.list, "mobile-move-kick") as Phaser.GameObjects.Container;
    const ougi = find(scene.children.list, "mobile-ougi-landscape") as Phaser.GameObjects.Container;
    const ring = find(scene.children.list, "mobile-counter-ring") as Phaser.GameObjects.Graphics;
    const readyRing = find(scene.children.list, "mobile-ougi-ready-ring") as Phaser.GameObjects.Graphics;
    const hit = kick.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const ougiHit = ougi.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    return {
      ringVisible: ring.visible,
      readyRingVisible: readyRing.visible,
      readyRingX: readyRing.x,
      readyRingY: readyRing.y,
      ringX: ring.x,
      kickX: kick.x,
      hitHeight: hit.input?.hitArea.height as number,
      hitBottom: kick.y + hit.input!.hitArea.height / 2,
      ougiX: ougi.x,
      ougiY: ougi.y,
      ougiTop: ougi.y - ougiHit.input!.hitArea.height / 2,
      ougiHitHeight: ougiHit.input?.hitArea.height as number,
      logicalHeight: window.__qaGame.canvas.height,
    };
  });
  await expect.poll(async () => (await readLayout()).ringVisible).toBe(true);
  const layout = await readLayout();
  const canvas = (await page.locator("canvas").boundingBox())!;
  expect(layout.ringVisible).toBe(true);
  expect(layout.ringX).toBe(layout.kickX);
  expect(layout.readyRingVisible).toBe(false);
  expect(layout.hitHeight * canvas.height / layout.logicalHeight).toBeGreaterThanOrEqual(44);
  expect(layout.hitBottom).toBeLessThan(layout.logicalHeight - 16);
  expect(layout.ougiHitHeight * canvas.height / layout.logicalHeight).toBeGreaterThanOrEqual(44);
  expect(layout.ougiTop).toBeGreaterThan(layout.hitBottom);
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("奥義 0% · 編成 1/1 · 1応酬目"))).toBe(true);
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  const guidedTell = await readBattleTell(page);
  expect(guidedTell.fontPx).toBeGreaterThanOrEqual(14);
  expect(guidedTell.left).toBeGreaterThanOrEqual(55);
  expect(guidedTell.right).toBeLessThanOrEqual(395);
  expect(guidedTell.top).toBeGreaterThanOrEqual(guidedTell.panelTop);
  expect(guidedTell.bottom).toBeLessThanOrEqual(guidedTell.panelBottom);
  await checkFrame(page, "compact-portrait-guided-move");
  await tapVisibleText(page, "蹴");
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  const enemyHpBeforeOugi = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as { enemyHp: number };
    Reflect.set(scene, "battle", { ...battle, playerGauge: 100 });
    return battle.enemyHp;
  });
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("奥義 準備完了 · 編成 1/1"))).toBe(true);
  await expect.poll(async () => (await readLayout()).readyRingVisible).toBe(true);
  expect((await readLayout()).readyRingX).toBe(layout.ougiX);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => {
    const current = await readLayout();
    return current.readyRingVisible && current.readyRingX === current.ougiX && current.readyRingY === current.ougiY && current.ougiX === 735;
  }).toBe(true);
  await checkFrame(page, "landscape-ougi-ready");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => {
    const current = await readLayout();
    return current.readyRingVisible && current.readyRingX === current.ougiX && current.readyRingY === current.ougiY && current.ougiX === layout.ougiX;
  }).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.shakeEffect.isRunning && !camera.flashEffect.isRunning;
  })).toBe(true);
  await checkFrame(page, "compact-portrait-ougi-ready");
  await tapPoint(page, layout.ougiX, layout.ougiTop + layout.ougiHitHeight - 1);
  await expect.poll(() => page.evaluate(() => {
    const battle = Reflect.get(window.__qaGame.scene.getScene("GameScene"), "battle") as { playerGauge: number; enemyHp: number };
    return { gauge: battle.playerGauge, enemyHp: battle.enemyHp };
  })).toMatchObject({ gauge: 0, enemyHp: expect.any(Number) });
  await expect.poll(async () => (await readLayout()).readyRingVisible).toBe(false);
  const enemyHpAfterOugi = await page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "battle") as { enemyHp: number }).enemyHp);
  expect(enemyHpAfterOugi).toBeLessThan(enemyHpBeforeOugi);
});

test("English fallback localizes title, roster, and mobile controls", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.waitForFunction(() => !!window.__qaGame);
  await waitForSceneReady(page);
  await expect.poll(() => page.locator("html").getAttribute("lang")).toBe("en");

  const labels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
      }
      return out;
    };
    return collect(scene.children.list);
  });
  expect(labels).toContain("Fist Legend");
  expect(labels).toContain("Battle");
  expect(labels).toContain("Gauntlet");
  expect(labels).toContain("Story");
  expect(labels).toContain("Gacha");
  expect(labels).toContain("Ryuga");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBeLessThan(301);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "title-mode-guide") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const guide = find(scene.children.list);
    if (!guide) return null;
    const status = guide.parentContainer.list[2] as Phaser.GameObjects.Text;
    return Number.parseInt(guide.style.fontSize, 10) === 16 ? status.getBounds().top - guide.getBounds().bottom : null;
  })).toBeGreaterThanOrEqual(8);
  await checkFrame(page, "compact-portrait-title-english");
  await tapVisibleText(page, "Battle");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await readBattleStatus(page)).map(label => label.text)).toEqual([
    expect.stringMatching(/^YOU HP \d+$/), expect.stringMatching(/^\d+s$/), expect.stringMatching(/^CPU HP \d+$/),
  ]);
  const englishStatus = await readBattleStatus(page);
  expect(englishStatus[0]!.right).toBeLessThan(englishStatus[1]!.left);
  expect(englishStatus[1]!.right).toBeLessThan(englishStatus[2]!.left);
  expect(englishStatus[2]!.right).toBeLessThanOrEqual(442);
  for (const label of englishStatus) expect(label.bottom).toBeLessThanOrEqual(54);
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  const englishTell = await readBattleTell(page);
  expect(englishTell.fontPx).toBeGreaterThanOrEqual(14);
  expect(englishTell.left).toBeGreaterThanOrEqual(55);
  expect(englishTell.right).toBeLessThanOrEqual(395);
  expect(englishTell.top).toBeGreaterThanOrEqual(englishTell.panelTop);
  expect(englishTell.bottom).toBeLessThanOrEqual(englishTell.panelBottom);
  await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
  await checkFrame(page, "compact-portrait-battle-english");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "beat", 3));
  await expect.poll(async () => (await readBattleTell(page)).text).toContain("Beats: Punch>Ki>Kick>Punch");
  const englishRule = await readBattleTell(page);
  expect(englishRule.left).toBeGreaterThanOrEqual(55);
  expect(englishRule.right).toBeLessThanOrEqual(395);
  expect(englishRule.top).toBeGreaterThanOrEqual(englishRule.panelTop);
  expect(englishRule.bottom).toBeLessThanOrEqual(englishRule.panelBottom);
  await checkFrame(page, "compact-portrait-rule-english");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): string => {
      for (const node of nodes) {
        if (node.name === "mobile-result-next") return (node as Phaser.GameObjects.Text).text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return "";
    };
    return find(scene.children.list);
  })).toContain("Team Change");
  await waitForCompactResult(page);
  const englishNext = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "mobile-result-next") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const next = find(scene.children.list)!;
    const bounds = next.getBounds();
    const canvas = window.__qaGame.canvas;
    return {
      text: next.text,
      fontPx: Number.parseFloat(next.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      left: bounds.left,
      right: bounds.right,
      logicalWidth: canvas.width,
    };
  });
  expect(englishNext.text).toContain("Team Change");
  await expect.poll(() => visibleCopy(page)).toContain("Change Team");
  expect(englishNext.fontPx).toBeGreaterThanOrEqual(14);
  expect(englishNext.left).toBeGreaterThan(16);
  expect(englishNext.right).toBeLessThan(englishNext.logicalWidth - 16);
  const englishReward = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container | null => {
      for (const node of nodes) {
        if (node.name === "mobile-result-reward") return node as Phaser.GameObjects.Container;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const reward = find(scene.children.list)!;
    const [label, value, balance] = reward.list.filter(node => node.type === "Text") as Phaser.GameObjects.Text[];
    const bounds = (node: Phaser.GameObjects.GameObject & { getBounds: () => Phaser.Geom.Rectangle }) => {
      const box = node.getBounds();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    return {
      label: bounds(label!),
      value: bounds(value!),
      balance: bounds(balance!),
      plate: bounds(reward),
      labelFontPx: Number.parseFloat(label!.style.fontSize) * window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width,
      balanceFontPx: Number.parseFloat(balance!.style.fontSize) * window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width,
    };
  });
  expect(englishReward.labelFontPx).toBeGreaterThanOrEqual(10);
  expect(englishReward.balanceFontPx).toBeGreaterThanOrEqual(10);
  expect(englishReward.label.right).toBeLessThan(englishReward.balance.left);
  expect(englishReward.balance.bottom).toBeLessThan(englishReward.value.top);
  expect(englishReward.value.right).toBeLessThan(englishReward.plate.right - 8);
  await checkFrame(page, "compact-portrait-result-english");
});


async function tapPoint(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const size = await canvas.evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
}

const phase = (page: Page) => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "phase"));

async function tapVisibleText(page: Page, value: string): Promise<void> {
  const point = await page.evaluate(value => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    let text: Phaser.GameObjects.Text | undefined;
    const visit = (node: Phaser.GameObjects.GameObject): void => {
      if (text || !node.visible) return;
      if (node.type === "Text" && (node as Phaser.GameObjects.Text).text === value) text = node as Phaser.GameObjects.Text;
      if (node.type === "Container") (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    if (!text) return null;
    const bounds = text.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }, value);
  expect(point).not.toBeNull();
  await tapPoint(page, point!.x, point!.y);
}

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

async function readBattleStatus(page: Page) {
  return page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === name) return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return null;
    };
    return ["mobile-battle-status", "mobile-battle-timer", "mobile-battle-enemy-status"].map(name => {
      const label = find(scene.children.list, name)!;
      const bounds = label.getBounds();
      return {
        text: label.text, fontSize: Number.parseInt(label.style.fontSize, 10),
        left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      };
    });
  });
}

async function readBattleTell(page: Page) {
  return page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "mobile-battle-tell") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const tell = find(scene.children.list)!;
    const box = tell.getBounds();
    const canvas = window.__qaGame.canvas;
    const panelTop = 350 + (canvas.height - 800) * 0.18;
    return {
      text: tell.text,
      fontPx: Number.parseFloat(tell.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      panelTop, panelBottom: panelTop + 95,
    };
  });
}

async function visibleCopy(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const collect = (nodes: Phaser.GameObjects.GameObject[]): string[] => nodes.flatMap(node => {
      if (!Reflect.get(node, "visible")) return [];
      if (node.type === "Container") return collect((node as Phaser.GameObjects.Container).list);
      return node.type === "Text" ? [(node as Phaser.GameObjects.Text).text] : [];
    });
    return collect(window.__qaGame.scene.getScene("GameScene").children.list);
  });
}

for (const lang of ["ja", "en"] as const) {
  test(`short portrait special gauge is readable and fits (${lang})`, async ({ page }) => {
    await page.goto(`/?lang=${lang}`);
    await waitForSceneReady(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startSingleBattle").call(window.__qaGame.scene.getScene("GameScene")));
    await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
    const read = () => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | undefined => {
        for (const node of nodes) {
          if (node.name === "mobile-battle-gauge") return node as Phaser.GameObjects.Text;
          if (node.type === "Container") { const result = find((node as Phaser.GameObjects.Container).list); if (result) return result; }
        }
        return undefined;
      };
      const gauge = find(scene.children.list)!;
      const bounds = gauge.getBounds();
      return { text: gauge.text, fontPx: Number.parseFloat(gauge.style.fontSize) * window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width,
        left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    });
    await expect.poll(async () => (await read()).text).toContain(lang === "ja" ? "奥義 0%" : "SPECIAL 0%");
    const gauge = await read();
    expect(gauge.fontPx).toBeGreaterThanOrEqual(14);
    expect(gauge.left).toBeGreaterThanOrEqual(10);
    expect(gauge.right).toBeLessThanOrEqual(440);
    expect(gauge.top).toBeGreaterThanOrEqual(66);
    expect(gauge.bottom).toBeLessThanOrEqual(98);
    expect(gauge.text).toContain(lang === "ja" ? "編成 1/1 · 1応酬目" : "TEAM 1/1 · TURN 1");
    await expect.poll(() => page.evaluate(() => !window.__qaGame.scene.getScene("GameScene").cameras.main.flashEffect.isRunning)).toBe(true);
    await page.screenshot({ path: `e2e/screenshots/short-portrait-gauge-${lang}.png` });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "selectedTeam", ["ryuga", "renka", "gaku"]);
      Reflect.set(scene, "activeFighterIndex", 2);
      Reflect.set(scene, "beat", 9);
    });
    await expect.poll(async () => (await read()).text).toContain(lang === "ja" ? "編成 3/3 · 10応酬目" : "TEAM 3/3 · TURN 10");
    const later = await read();
    expect(later.left).toBeGreaterThanOrEqual(10);
    expect(later.right).toBeLessThanOrEqual(440);
    expect(later.top).toBeGreaterThanOrEqual(66);
    expect(later.bottom).toBeLessThanOrEqual(98);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "battle", { ...Reflect.get(scene, "battle"), playerGauge: 100 });
    });
    await expect.poll(async () => (await read()).text).toContain(lang === "ja" ? "奥義 準備完了" : "SPECIAL READY");
    const ready = await read();
    expect(ready.fontPx).toBeGreaterThanOrEqual(14);
    expect(ready.left).toBeGreaterThanOrEqual(10);
    expect(ready.right).toBeLessThanOrEqual(440);
    expect(ready.top).toBeGreaterThanOrEqual(66);
    expect(ready.bottom).toBeLessThanOrEqual(98);
    await page.screenshot({ path: `e2e/screenshots/short-portrait-gauge-ready-${lang}.png` });
  });
}

test("first battle reaches special and retry through player actions", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  const counterFor = (tell: string): string => {
    if (tell.includes("拳を引いている")) return "蹴";
    if (tell.includes("脚へ重心を移した")) return "気";
    if (tell.includes("掌に気が集まる")) return "拳";
    throw new Error(`Unknown opponent tell: ${tell}`);
  };
  for (let round = 0; round < 4; round++) {
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return Reflect.get(scene, "accepting") === true && !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
    })).toBe(true);
    const tell = (await readBattleTell(page)).text;
    const counter = counterFor(tell);
    if (round < 3) expect(tell).toContain(`${counter}で有利を取ろう`);
    else expect(tell).toContain("有利: 拳>気>蹴>拳");
    const moveName = ({ "拳": "punch", "蹴": "kick", "気": "ki" } as const)[counter as "拳" | "蹴" | "気"];
    await expect.poll(() => page.evaluate(({ moveName, guided }) => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
        for (const node of nodes) {
          if (node.name === name) return node;
          if (node.type === "Container") { const nested = find((node as Phaser.GameObjects.Container).list, name); if (nested) return nested; }
        }
        return undefined;
      };
      const ring = find(scene.children.list, "mobile-counter-ring") as Phaser.GameObjects.Graphics;
      const button = find(scene.children.list, `mobile-move-${moveName}`) as Phaser.GameObjects.Container;
      return guided ? ring.visible && ring.x === button.x && ring.y === button.y : !ring.visible;
    }, { moveName, guided: round < 3 })).toBe(true);
    await tapVisibleText(page, counter);
    await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBe(round + 1);
  }
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("奥義 準備完了"))).toBe(true);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await checkFrame(page, "first-play-special-ready");
  await tapVisibleText(page, "奥義");
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("奥義 0%")) || await phase(page) === "result").toBe(true);
  for (let attempt = 0; attempt < 3 && await phase(page) === "battle"; attempt++) {
    await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
    await tapVisibleText(page, counterFor((await readBattleTell(page)).text));
    await page.waitForTimeout(500);
  }
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => visibleCopy(page)).toContain("相手のHPを0にした");
  await expect.poll(() => visibleCopy(page)).toContain("勝利");
  await checkFrame(page, "first-play-result");
  await tapVisibleText(page, "もう一度");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await readBattleTell(page)).text).toContain("蹴で有利を取ろう");
});

test("a first battle loss explains the result and allows retry", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  for (let attempt = 0; attempt < 12; attempt++) {
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const phase = Reflect.get(scene, "phase");
      const camera = scene.cameras.main;
      return phase === "result" || (phase === "battle" && Reflect.get(scene, "accepting") === true && !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning);
    })).toBe(true);
    if (await phase(page) === "result") break;
    const tell = (await readBattleTell(page)).text;
    const move = tell.includes("拳を引いている") ? "気" : tell.includes("脚へ重心を移した") ? "拳" : tell.includes("掌に気が集まる") ? "蹴" : null;
    expect(move, `Unknown opponent tell: ${tell}`).not.toBeNull();
    const previousBeat = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"));
    await tapVisibleText(page, move!);
    await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(previousBeat);
  }
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => visibleCopy(page)).toContain("自分のHPが0になった");
  await expect.poll(() => visibleCopy(page)).toContain("敗北");
  await checkFrame(page, "first-play-defeat");
  await tapVisibleText(page, "もう一度");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await readBattleTell(page)).text).toContain("蹴で有利を取ろう");
});

test("first loop explains modes, coaches a counter, and reports an HP decision", async ({ page }) => {
  await expect.poll(() => visibleCopy(page)).toContain("対戦で練習\n3連戦で腕試し\n物語で章を進める");
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("蹴で有利を取ろう"))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | null => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return null;
    };
    const ring = find(scene.children.list, "mobile-counter-ring") as Phaser.GameObjects.Graphics | null;
    const kick = find(scene.children.list, "mobile-move-kick") as Phaser.GameObjects.Container | null;
    return Boolean(ring?.visible && kick && ring.x === kick.x && ring.y === kick.y);
  })).toBe(true);
  await tapVisibleText(page, "蹴");
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "beat", 3));
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Graphics | null => {
      for (const node of nodes) {
        if (node.name === "mobile-counter-ring") return node as Phaser.GameObjects.Graphics;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    return find(scene.children.list)?.visible;
  })).toBe(false);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  await expect.poll(async () => (await readBattleTell(page)).text).toContain("有利: 拳>気>蹴>拳");
  const japaneseRule = await readBattleTell(page);
  expect(japaneseRule.left).toBeGreaterThanOrEqual(55);
  expect(japaneseRule.right).toBeLessThanOrEqual(395);
  expect(japaneseRule.top).toBeGreaterThanOrEqual(japaneseRule.panelTop);
  expect(japaneseRule.bottom).toBeLessThanOrEqual(japaneseRule.panelBottom);
  await checkFrame(page, "compact-portrait-rule-japanese");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "battle", { ...Reflect.get(scene, "battle"), playerHp: 75, enemyHp: 25 });
    Reflect.get(scene, "finishBattle").call(scene, true);
  });
  await expect.poll(() => visibleCopy(page)).toContain("時間切れ · 残りHP 75 対 25");
  await expect.poll(() => visibleCopy(page)).toContain("WIN");
  await checkFrame(page, "portrait-result-hp-decision");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.evaluate(() => {
    const canvas = window.__qaGame.canvas;
    return { width: canvas.width, height: canvas.height, displayWidth: Math.round(canvas.getBoundingClientRect().width) };
  })).toEqual({ width: 450, height: 900, displayWidth: 280 });
  const decisionReason = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.Text | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const reason = find(scene.children.list, "mobile-result-reason")!;
    const finish = find(scene.children.list, "mobile-result-finish")!;
    const heading = find(scene.children.list, "mobile-result-heading")!;
    const bounds = reason.getBounds();
    const canvas = window.__qaGame.canvas;
    return {
      fontPx: Number.parseFloat(reason.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      finishBottom: finish.getBounds().bottom,
      headingTop: heading.getBounds().top,
      logicalWidth: canvas.width,
    };
  });
  await checkFrame(page, "compact-portrait-result-hp-reason");
  expect(decisionReason.fontPx).toBeGreaterThanOrEqual(14);
  expect(decisionReason.left).toBeGreaterThan(16);
  expect(decisionReason.right).toBeLessThan(decisionReason.logicalWidth - 16);
  expect(decisionReason.top).toBeGreaterThan(decisionReason.finishBottom);
  expect(decisionReason.bottom).toBeLessThan(decisionReason.headingTop);
  await tapVisibleText(page, "もう一度");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("蹴で有利を取ろう"))).toBe(true);
});

test("gacha discloses its illustrative scope before a draw", async ({ page }) => {
  await tapVisibleText(page, "ガチャ");
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("演出のみ・所持や能力には反映されません"))).toBe(true);
  await checkFrame(page, "portrait-gacha-scope");
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const portrait = viewport.height > viewport.width;
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(portrait ? 450 : 800);
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const group = Reflect.get(scene, "gachaGroup") as Phaser.GameObjects.Container;
      const cost = (group.getByName("gacha-cost") as Phaser.GameObjects.Text).getBounds();
      const draw = group.getByName("gacha-draw") as Phaser.GameObjects.Container;
      const back = group.getByName("gacha-back") as Phaser.GameObjects.Container;
      return cost.left >= 0 && cost.right <= window.__qaGame.canvas.width && draw.getBounds().bottom < back.getBounds().top;
    })).toBe(true);
    await checkFrame(page, `gacha-scope-${viewport.width}`);
  }
  await tapVisibleText(page, "タイトルへ戻る");
  await expect.poll(() => visibleCopy(page)).toContain("対戦で練習\n3連戦で腕試し\n物語で章を進める");
});

async function resultCharactersAreClear(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const bounds = (name: string) => find(scene.children.list, name)!.getBounds();
    const fighters = [bounds("mobile-result-hero"), bounds("mobile-result-enemy")];
    const ui = [
      bounds("mobile-result-finish"),
      bounds("mobile-result-heading"),
      bounds("mobile-result-reward"),
      bounds("mobile-result-next"),
      bounds("mobile-result-primary"),
    ];
    const canvas = window.__qaGame.canvas;
    const overlaps = (a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return fighters.every(fighter =>
      fighter.left >= 0
      && fighter.right <= canvas.width
      && fighter.top >= 0
      && fighter.bottom <= canvas.height
      && ui.every(panel => !overlaps(fighter, panel)),
    );
  });
}

async function waitForCompactResult(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "mobile-result-next") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const next = find(scene.children.list);
    return !!next && Number.parseFloat(next.style.fontSize) === 27 && next.text.length > 0
      && window.__qaGame.canvas.getBoundingClientRect().width <= 300;
  })).toBe(true);
}

test("touch starts battle and a move advances the beat after rotation", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  await checkFrame(page, "portrait-battle");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await checkFrame(page, "landscape-battle-ready");
  const before = await page.locator("canvas").screenshot();
  // 横持ち専用UIの拳ボタン中央。文字検索では旧HUDの装飾文字も候補になるため、
  // 実際のタッチ領域を直接操作する。
  await tapPoint(page, 520, 392);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await expect.poll(async () => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  await checkFrame(page, "landscape-battle");
});

test("battle fighters return to tablet positions after a phone resize", async ({ page }) => {
  await tapVisibleText(page, "対戦");
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(() => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "playerSprite") as Phaser.GameObjects.Image).y)).toBeGreaterThan(400);
  await page.setViewportSize({ width: 600, height: 600 });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const player = Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image;
    const enemy = Reflect.get(scene, "enemySprite") as Phaser.GameObjects.Image;
    return { width: scene.scale.gameSize.width, height: scene.scale.gameSize.height, playerY: player.y, enemyY: enemy.y, playerHeight: player.displayHeight, enemyHeight: enemy.displayHeight };
  })).toEqual({ width: 800, height: 600, playerY: 286, enemyY: 286, playerHeight: 320, enemyHeight: 320 });
  await checkFrame(page, "phone-to-tablet-battle");
  await tapPoint(page, 250, 470);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const player = Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image;
    return { width: scene.scale.gameSize.width, x: player.x, height: player.displayHeight };
  })).toEqual({ width: 450, x: 225, height: 200 });
  expect(await phase(page)).toBe("battle");
});

test("live attack, hit, and guard visuals follow the resolved clash", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "startBattle").call(window.__qaGame.scene.getScene("GameScene")));

  const resolve = async (enemyMove: "punch" | "kick" | "ki") => {
    const baseline = await page.evaluate(enemyMove => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.get(scene, "startBattle").call(scene);
      Reflect.set(scene, "nextEnemyMove", enemyMove);
      const positions = {
        playerX: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).x,
        enemyX: (Reflect.get(scene, "enemySprite") as Phaser.GameObjects.Image).x,
      };
      Reflect.get(scene, "onPlayerMove").call(scene, "punch");
      return positions;
    }, enemyMove);
    if (enemyMove === "punch") {
      await page.waitForTimeout(55);
    } else {
      await expect.poll(() => page.evaluate(() => {
        const scene = window.__qaGame.scene.getScene("GameScene");
        return {
          playerX: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).x,
          enemyX: (Reflect.get(scene, "enemySprite") as Phaser.GameObjects.Image).x,
        };
      }).then(position => enemyMove === "ki"
        ? position.playerX - baseline.playerX
        : baseline.enemyX - position.enemyX), { intervals: [16, 32, 50], timeout: 1000 }).toBeGreaterThan(0);
    }
    const state = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const root = scene.children.getByName("combat-state-fx") as Phaser.GameObjects.Container | null;
      return {
        attack: root?.getByName("combat-attack-trail")?.visible ?? false,
        hit: root?.getByName("combat-hit-burst")?.visible ?? false,
        guard: root?.getByName("combat-guard-ring")?.visible ?? false,
        playerX: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).x,
        enemyX: (Reflect.get(scene, "enemySprite") as Phaser.GameObjects.Image).x,
      };
    });
    return { baseline, state };
  };

  const advantage = await resolve("ki");
  expect(advantage.state).toMatchObject({ attack: true, hit: true, guard: false });
  expect(advantage.state.playerX).toBeGreaterThan(advantage.baseline.playerX);
  await checkFrame(page, "approved-battle-attack-hit");

  const disadvantage = await resolve("kick");
  expect(disadvantage.state).toMatchObject({ attack: true, hit: true, guard: false });
  expect(disadvantage.state.enemyX).toBeLessThan(disadvantage.baseline.enemyX);

  const tie = await resolve("punch");
  expect(tie.state).toMatchObject({ attack: false, hit: false, guard: true });
});

test("read feedback fits the compact portrait stage", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
    scene.tweens.pauseAll();
    Reflect.get(scene, "showClash").call(scene, "advantage", "kick", "punch");
  });
  const readFeedback = async (name: string) => page.evaluate(name => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const label = scene.children.getByName(name) as Phaser.GameObjects.Text | null;
    if (!label) return null;
    const box = label.getBounds();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: window.__qaGame.canvas.width };
  }, name);
  const win = await readFeedback("presentation-read-win");
  const winDetail = await readFeedback("presentation-read-win-detail");
  expect(win).not.toBeNull();
  expect(winDetail).not.toBeNull();
  for (const label of [win!, winDetail!]) {
    expect(label.left).toBeGreaterThanOrEqual(16);
    expect(label.right).toBeLessThanOrEqual(label.width - 16);
    expect(label.top).toBeGreaterThan(98);
    expect(label.bottom).toBeLessThan(365);
  }
  await checkFrame(page, "compact-portrait-read-win");
  await page.reload();
  await page.waitForFunction(() => !!window.__qaGame);
  await waitForSceneReady(page);
  await expect.poll(() => page.locator("canvas").evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(280);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
    scene.tweens.pauseAll();
    Reflect.get(scene, "showClash").call(scene, "disadvantage", "punch", "kick");
  });
  const loss = await readFeedback("presentation-read-loss");
  expect(loss).not.toBeNull();
  expect(loss!.left).toBeGreaterThanOrEqual(16);
  expect(loss!.right).toBeLessThanOrEqual(loss!.width - 16);
  expect(loss!.top).toBeGreaterThan(98);
  expect(loss!.bottom).toBeLessThan(365);
  await checkFrame(page, "compact-portrait-read-loss");
});

test("reduced motion keeps the state cue without fighter or camera motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 800, height: 600 });
  const state = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
    Reflect.set(scene, "nextEnemyMove", "ki");
    Reflect.get(scene, "onPlayerMove").call(scene, "punch");
    const root = scene.children.getByName("combat-state-fx") as Phaser.GameObjects.Container | null;
    return {
      cue: root?.getByName("combat-hit-burst")?.visible ?? false,
      playerX: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).x,
      enemyX: (Reflect.get(scene, "enemySprite") as Phaser.GameObjects.Image).x,
      cameraFx: scene.cameras.main.flashEffect.isRunning || scene.cameras.main.shakeEffect.isRunning,
    };
  });
  expect(state).toEqual({ cue: true, playerX: 180, enemyX: 620, cameraFx: false });
});

test("gacha and result screens are included in visual QA", async ({ page }) => {
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "openGacha").call(window.__qaGame.scene.getScene("GameScene")));
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "gachaGroup").visible)).toBe(true);
  await checkFrame(page, "portrait-gacha");

  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showTitle").call(scene);
    Reflect.get(scene, "startBattle").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("battle");
  await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "finishBattle").call(window.__qaGame.scene.getScene("GameScene"), true));
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const summary = scene.children.getByName("presentation-result-summary") as Phaser.GameObjects.Text | null;
    return summary?.visible ?? false;
  })).toBe(false);
  const mobileFinish = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const finish = find(scene.children.list, "mobile-result-finish") as Phaser.GameObjects.Text;
    const heading = find(scene.children.list, "mobile-result-heading") as Phaser.GameObjects.Text;
    const reward = find(scene.children.list, "mobile-result-reward") as Phaser.GameObjects.Container;
    const primary = find(scene.children.list, "mobile-result-primary") as Phaser.GameObjects.Container;
    const next = find(scene.children.list, "mobile-result-next") as Phaser.GameObjects.Text;
    const hero = find(scene.children.list, "mobile-result-hero") as Phaser.GameObjects.Image;
    const enemy = find(scene.children.list, "mobile-result-enemy") as Phaser.GameObjects.Image;
    const padding = Reflect.get(finish, "padding") as { left: number; right: number; top: number; bottom: number };
    const finishBounds = finish.getBounds();
    const headingBounds = heading.getBounds();
    const rewardBounds = reward.getBounds();
    const primaryBounds = primary.getBounds();
    const nextBounds = next.getBounds();
    const heroBounds = hero.getBounds();
    const enemyBounds = enemy.getBounds();
    return {
      text: (Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text).text,
      padding,
      finish: { top: finishBounds.y, bottom: finishBounds.y + finishBounds.height },
      heading: { top: headingBounds.y, bottom: headingBounds.y + headingBounds.height },
      reward: {
        text: reward.list.filter(node => node.type === "Text").map(node => (node as Phaser.GameObjects.Text).text),
        top: rewardBounds.y,
        bottom: rewardBounds.y + rewardBounds.height,
      },
      primary: { top: primaryBounds.y, height: primaryBounds.height },
      next: { bottom: nextBounds.bottom },
      hero: { top: heroBounds.top, bottom: heroBounds.bottom },
      enemy: { top: enemyBounds.top, bottom: enemyBounds.bottom },
    };
  });
  expect(mobileFinish.text).toBe("DRAW");
  expect(mobileFinish.padding).toMatchObject({ left: 14, right: 14, top: 14, bottom: 14 });
  expect(mobileFinish.finish.bottom).toBeLessThan(mobileFinish.heading.top);
  expect(mobileFinish.reward.text).toEqual(expect.arrayContaining(["獲得報酬", "豪拳石 +20", "所持 20"]));
  expect(mobileFinish.reward.top).toBeGreaterThan(mobileFinish.heading.bottom);
  expect(mobileFinish.reward.bottom).toBeLessThan(mobileFinish.primary.top);
  expect(mobileFinish.primary.height).toBeGreaterThanOrEqual(58);
  expect(mobileFinish.hero.top).toBeGreaterThan(mobileFinish.next.bottom);
  expect(mobileFinish.enemy.top).toBeGreaterThan(mobileFinish.next.bottom);
  expect(mobileFinish.hero.bottom).toBeLessThan(mobileFinish.primary.top);
  expect(mobileFinish.enemy.bottom).toBeLessThan(mobileFinish.primary.top);
  expect(await resultCharactersAreClear(page)).toBe(true);
  await checkFrame(page, "portrait-result");

  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(() => resultCharactersAreClear(page)).toBe(true);
  await checkFrame(page, "short-portrait-result");

  await page.setViewportSize({ width: 320, height: 568 });
  await waitForCompactResult(page);
  const compactNext = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const next = find(scene.children.list, "mobile-result-next") as Phaser.GameObjects.Text;
    const reward = find(scene.children.list, "mobile-result-reward") as Phaser.GameObjects.Container;
    const primary = find(scene.children.list, "mobile-result-primary") as Phaser.GameObjects.Container;
    const hero = find(scene.children.list, "mobile-result-hero") as Phaser.GameObjects.Image;
    const enemy = find(scene.children.list, "mobile-result-enemy") as Phaser.GameObjects.Image;
    const canvas = window.__qaGame.canvas;
    const nextBounds = next.getBounds();
    return {
      fontPx: Number.parseFloat(next.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      next: { left: nextBounds.left, right: nextBounds.right, top: nextBounds.top, bottom: nextBounds.bottom },
      rewardBottom: reward.getBounds().bottom,
      primaryTop: primary.getBounds().top,
      heroTop: hero.getBounds().top,
      enemyTop: enemy.getBounds().top,
      logicalWidth: canvas.width,
    };
  });
  expect(compactNext.fontPx).toBeGreaterThanOrEqual(14);
  expect(compactNext.next.left).toBeGreaterThan(16);
  expect(compactNext.next.right).toBeLessThan(compactNext.logicalWidth - 16);
  expect(compactNext.next.top).toBeGreaterThan(compactNext.rewardBottom);
  expect(compactNext.next.bottom).toBeLessThan(compactNext.primaryTop);
  expect(compactNext.next.bottom).toBeLessThan(compactNext.heroTop);
  expect(compactNext.next.bottom).toBeLessThan(compactNext.enemyTop);
  await checkFrame(page, "compact-portrait-result-next");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(() => resultCharactersAreClear(page)).toBe(true);
  await checkFrame(page, "landscape-result");

  const pressed = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.Container | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node as Phaser.GameObjects.Container;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const primary = find(scene.children.list, "mobile-result-primary")!;
    const shadow = primary.list[0] as Phaser.GameObjects.Rectangle;
    const background = primary.list[1] as Phaser.GameObjects.Rectangle;
    const shine = primary.list[3] as Phaser.GameObjects.Rectangle;
    const hit = primary.list.at(-1) as Phaser.GameObjects.Zone;
    hit.emit("pointerdown");
    return { fillColor: background.fillColor, shineAlpha: shine.alpha, shadowY: shadow.y };
  });
  expect(pressed).toEqual({ fillColor: 0x7f2d25, shineAlpha: 0.045, shadowY: 2 });
  await expect.poll(() => phase(page)).toBe("battle");
});

test("opponent archetypes keep distinct battle identity", async ({ page }) => {
  for (const opponent of ["rush", "counter", "charge"] as const) {
    const badge = await page.evaluate(opponent => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "opponent", opponent);
      Reflect.get(scene, "startBattle").call(scene);
      return (Reflect.get(scene, "opponentBadge") as Phaser.GameObjects.Text).text;
    }, opponent);
    expect(badge).toMatch(opponent === "rush" ? /猛攻型/ : opponent === "counter" ? /反撃型/ : /気功型/);
    await page.waitForTimeout(140);
    await checkFrame(page, `portrait-opponent-${opponent}`);
    await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "showTitle").call(window.__qaGame.scene.getScene("GameScene")));
  }
});

test("victory result shows a knockout finish", async ({ page }) => {
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return (Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text).text;
  })).toBe("K.O.");
  await expect.poll(() => visibleCopy(page)).toContain("タイトルへ");
  await page.waitForTimeout(260);
  await checkFrame(page, "portrait-result-ko");
});

test("tablet result distinguishes time decisions from knockouts", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 75, enemyHp: 25 });
    Reflect.get(scene, "finishBattle").call(scene, true);
  });
  const result = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const legacy = Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container;
    return {
      legacyVisible: legacy.visible,
      finish: (Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text).text,
      reason: (legacy.getByName("result-reason") as Phaser.GameObjects.Text).text,
      stats: (legacy.getByName("stats") as Phaser.GameObjects.Text).text,
    };
  });
  await expect.poll(result).toMatchObject({ legacyVisible: true, finish: "WIN" });
  expect((await result()).reason).toBe("時間切れ · 残りHP 75 対 25");
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "tablet-result-time-win");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "handleResultPrimary").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 25, enemyHp: 75 });
    Reflect.get(scene, "finishBattle").call(scene, true);
  });
  await expect.poll(result).toMatchObject({ legacyVisible: true, finish: "LOSE", reason: "時間切れ · 残りHP 25 対 75" });
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "tablet-result-time-lose");
});

test("the smallest tablet result keeps the time reason readable", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 75, enemyHp: 25 });
    Reflect.get(scene, "finishBattle").call(scene, true);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const finish = Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text;
    return !scene.tweens.isTweening(finish) && finish.alpha >= 0.95
      && !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
  const layout = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const group = Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container;
    const reason = group.getByName("result-reason") as Phaser.GameObjects.Text;
    const finish = Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text;
    const heading = group.getByName("heading") as Phaser.GameObjects.Text;
    const stats = group.getByName("stats") as Phaser.GameObjects.Text;
    const primary = (Reflect.get(scene, "resultPrimaryBtn") as { container: Phaser.GameObjects.Container }).container;
    const title = group.list.find(node => node.type === "Container" &&
      (node as Phaser.GameObjects.Container).list.some(child => child.type === "Text" && (child as Phaser.GameObjects.Text).text === "タイトルへ戻る")) as Phaser.GameObjects.Container;
    const summary = scene.children.getByName("presentation-result-summary") as Phaser.GameObjects.Text;
    const buttonText = (button: Phaser.GameObjects.Container) => button.list.find(child => child.type === "Text") as Phaser.GameObjects.Text;
    const canvas = window.__qaGame.canvas;
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    return {
      visible: group.visible,
      fontPx: Number.parseFloat(reason.style.fontSize) * scale,
      reasonTop: reason.getBounds().top,
      reasonBottom: reason.getBounds().bottom,
      finishBottom: finish.getBounds().bottom,
      headingTop: heading.getBounds().top,
      nextText: stats.text,
      primaryHitPx: (primary.input?.hitArea.height as number) * scale,
      titleHitPx: (title.input?.hitArea.height as number) * scale,
      primaryTextPx: Number.parseFloat(buttonText(primary).style.fontSize) * scale,
      titleTextPx: Number.parseFloat(buttonText(title).style.fontSize) * scale,
      primaryBottom: primary.getBounds().bottom,
      titleTop: title.getBounds().top,
      titleBottom: title.getBounds().bottom,
      summaryTop: summary.getBounds().top,
    };
  });
  expect(layout.visible).toBe(true);
  expect(layout.fontPx).toBeGreaterThanOrEqual(14);
  expect(layout.reasonTop).toBeGreaterThan(layout.finishBottom);
  expect(layout.reasonBottom).toBeLessThan(layout.headingTop);
  expect(layout.nextText).toContain("NEXT: 予兆を見て有利技を選ぼう");
  expect(layout.nextText).not.toContain("もう一度あそぶ");
  expect(layout.primaryHitPx).toBeGreaterThanOrEqual(44);
  expect(layout.titleHitPx).toBeGreaterThanOrEqual(44);
  expect(layout.primaryTextPx).toBeGreaterThanOrEqual(14);
  expect(layout.titleTextPx).toBeGreaterThanOrEqual(14);
  expect(layout.primaryBottom).toBeLessThan(layout.titleTop);
  expect(layout.titleBottom).toBeLessThan(layout.summaryTop);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "small-tablet-result-time-win");
  await tapPoint(page, 400, 385);
  await expect.poll(() => phase(page)).toBe("battle");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await tapPoint(page, 400, 459);
  await expect.poll(() => phase(page)).toBe("title");
});

test("compact tablet English win points from the tell to the counter", async ({ page }) => {
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 75, enemyHp: 25 });
    Reflect.get(scene, "finishBattle").call(scene, true);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const finish = Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text;
    return !scene.tweens.isTweening(finish) && finish.alpha >= 0.95;
  })).toBe(true);
  const result = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const stats = (Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("stats") as Phaser.GameObjects.Text;
    const finish = Reflect.get(scene, "resultFinish") as Phaser.GameObjects.Text;
    const reason = (Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("result-reason") as Phaser.GameObjects.Text;
    const primary = (Reflect.get(scene, "resultPrimaryBtn") as { container: Phaser.GameObjects.Container }).container;
    const scale = window.__qaGame.canvas.getBoundingClientRect().width / window.__qaGame.canvas.width;
    return { text: stats.text, fontPx: Number.parseFloat(stats.style.fontSize) * scale,
      reasonTop: reason.getBounds().top, finishBottom: finish.getBounds().bottom,
      nextBottom: stats.getBounds().bottom, primaryTop: primary.getBounds().top,
      left: stats.getBounds().left, right: stats.getBounds().right };
  });
  expect(result.text).toContain("NEXT: Read the tell, choose the counter");
  expect(result.text).not.toContain("Play Again");
  expect(result.fontPx).toBeGreaterThanOrEqual(14);
  expect(result.reasonTop).toBeGreaterThan(result.finishBottom);
  expect(result.nextBottom).toBeLessThan(result.primaryTop);
  expect(result.left).toBeGreaterThanOrEqual(0);
  expect(result.right).toBeLessThanOrEqual(800);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return !scene.cameras.main.flashEffect.isRunning && !scene.cameras.main.shakeEffect.isRunning;
  })).toBe(true);
  await checkFrame(page, "small-tablet-result-time-win-english");
  await tapPoint(page, 400, 385);
  await expect.poll(() => phase(page)).toBe("battle");
});

test("the smallest tablet keeps every battle action touchable", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("battle");
  const actions = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const hud = (Reflect.get(scene, "battleGroup") as Phaser.GameObjects.Container)
      .getByName("legacy-battle-hud") as Phaser.GameObjects.Container;
    const canvas = window.__qaGame.canvas;
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    return hud.list.filter(node => node.type === "Container" && node.input && node.y >= 480)
      .map(node => {
        const button = node as Phaser.GameObjects.Container;
        const label = button.list.find(child => child.type === "Text") as Phaser.GameObjects.Text;
        return {
          label: label.text,
          hitPx: (button.input!.hitArea.height as number) * scale,
          fontPx: Number.parseFloat(label.style.fontSize) * scale,
          top: button.y - (button.input!.hitArea.height as number) / 2,
          bottom: button.y + (button.input!.hitArea.height as number) / 2,
        };
      });
  });
  expect(actions).toHaveLength(5);
  for (const action of actions) {
    expect(action.hitPx, action.label).toBeGreaterThanOrEqual(44);
    expect(action.fontPx, action.label).toBeGreaterThanOrEqual(14);
  }
  expect(Math.max(...actions.slice(0, 3).map(action => action.bottom)))
    .toBeLessThan(Math.min(...actions.slice(3).map(action => action.top)));
  await checkFrame(page, "small-tablet-battle-actions");
  await tapPoint(page, 240, 480);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "beat"))).toBeGreaterThan(0);
});

test("compact tablet connects the rival tell to the counter move", async ({ page }) => {
  const readGuide = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const tell = Reflect.get(scene, "tell") as Phaser.GameObjects.Text;
    const ring = Reflect.get(scene, "legacyCounterRing") as Phaser.GameObjects.Graphics | undefined;
    const bounds = tell.getBounds();
    const canvas = window.__qaGame.canvas;
    return {
      text: tell.text,
      ring: ring ? { visible: ring.visible, x: ring.x, y: ring.y } : null,
      fontPx: Number.parseFloat(tell.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
    };
  });
  const start = async () => {
    await page.setViewportSize({ width: 600, height: 600 });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.get(scene, "startSingleBattle").call(scene);
    });
    await expect.poll(() => phase(page)).toBe("battle");
  };
  const verify = async (counter: string, wideCopy: string, rule: string, frame: string) => {
    await expect.poll(async () => (await readGuide()).text).toContain(counter);
    const opening = await readGuide();
    expect(opening.ring).toEqual({ visible: true, x: 400, y: 480 });
    expect(opening.fontPx).toBeGreaterThanOrEqual(14);
    expect(opening.left).toBeGreaterThanOrEqual(130);
    expect(opening.right).toBeLessThanOrEqual(670);
    expect(opening.top).toBeGreaterThanOrEqual(64);
    expect(opening.bottom).toBeLessThanOrEqual(128);
    await page.setViewportSize({ width: 800, height: 600 });
    await expect.poll(async () => (await readGuide()).text).toContain(wideCopy);
    expect((await readGuide()).ring?.visible).toBe(false);
    await page.setViewportSize({ width: 600, height: 600 });
    await expect.poll(async () => (await readGuide()).text).toContain(counter);
    expect((await readGuide()).ring).toEqual({ visible: true, x: 400, y: 480 });
    await expect.poll(() => page.evaluate(() => {
      const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
      return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
    })).toBe(true);
    await page.waitForTimeout(200);
    await checkFrame(page, frame);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "nextEnemyMove", "kick");
      Reflect.get(scene, "refreshTell").call(scene);
    });
    await expect.poll(async () => (await readGuide()).ring).toEqual({ visible: true, x: 560, y: 480 });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "beat", 3);
      Reflect.get(scene, "refreshTell").call(scene);
    });
    await expect.poll(async () => (await readGuide()).text).toContain(rule);
    expect((await readGuide()).ring?.visible).toBe(false);
  };

  await start();
  await verify("蹴で有利を取ろう", "編成の得意", "有利: 拳>気>蹴>拳", "small-tablet-guide-japanese");
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await start();
  await verify("Counter with Kick", "TEAM EDGE", "Beats: Punch>Ki>Kick>Punch", "small-tablet-guide-english");
});

test("three-fighter team persists and leader appears in battle", async ({ page }) => {
  const result = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const toggle = Reflect.get(scene, "toggleTeamMember") as (id: "ryuga" | "renka" | "gaku" | "mei") => void;

    toggle.call(scene, "renka");
    toggle.call(scene, "gaku");
    toggle.call(scene, "mei"); // max 3: ignored
    const capped = [...(Reflect.get(scene, "selectedTeam") as string[])];

    toggle.call(scene, "ryuga");
    toggle.call(scene, "mei");
    Reflect.get(scene, "showTitle").call(scene);
    const selected = [...(Reflect.get(scene, "selectedTeam") as string[])];
    return { capped, selected };
  });

  expect(result.capped).toEqual(["ryuga", "renka", "gaku"]);
  expect(result.selected).toEqual(["renka", "gaku", "mei"]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fist_legend_team_v1")))
    .toBe(JSON.stringify(["renka", "gaku", "mei"]));

  await checkFrame(page, "portrait-team-three");

  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startBattle").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      label: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
      texture: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).texture.key,
    };
  })).toEqual({ label: "PLAYER · 蓮花 [1/3]", texture: "fl-fighter-renka" });
  await checkFrame(page, "portrait-team-leader-battle");

});

test("battle switch cycles through the selected team on touch controls", async ({ page }) => {
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const toggle = Reflect.get(scene, "toggleTeamMember") as (id: "ryuga" | "renka" | "gaku" | "mei") => void;
    toggle.call(scene, "renka");
    toggle.call(scene, "gaku");
    Reflect.get(scene, "startBattle").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("battle");
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "activeFighterIndex"))).toBe(0);

  const readPortraitSwitchPoint = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const findByName = (
      nodes: Phaser.GameObjects.GameObject[],
      name: string,
    ): Phaser.GameObjects.GameObject | null => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const found = findByName((node as Phaser.GameObjects.Container).list, name);
          if (found) return found;
        }
      }
      return null;
    };
    const button = findByName(scene.children.list, "mobile-switch") as Phaser.GameObjects.Container | null;
    if (!button || !button.visible || !button.parentContainer?.visible) return null;
    const bounds = button.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await expect.poll(readPortraitSwitchPoint).not.toBeNull();
  const portraitSwitchPoint = await readPortraitSwitchPoint();
  expect(portraitSwitchPoint).not.toBeNull();
  await tapPoint(page, portraitSwitchPoint!.x, portraitSwitchPoint!.y);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      index: Reflect.get(scene, "activeFighterIndex"),
      label: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
      texture: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).texture.key,
    };
  })).toEqual({ index: 1, label: "PLAYER · 蓮花 [2/3]", texture: "fl-fighter-renka" });
  await page.waitForTimeout(300);
  await checkFrame(page, "portrait-switch-renka");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  const readSwitchPoint = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const findByName = (
      nodes: Phaser.GameObjects.GameObject[],
      name: string,
    ): Phaser.GameObjects.GameObject | null => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const found = findByName((node as Phaser.GameObjects.Container).list, name);
          if (found) return found;
        }
      }
      return null;
    };
    const button = findByName(
      scene.children.list,
      "mobile-switch-landscape",
    ) as Phaser.GameObjects.Container | null;
    if (!button || !button.visible || !button.parentContainer?.visible) return null;
    const bounds = button.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await expect.poll(readSwitchPoint).not.toBeNull();
  const switchPoint = await readSwitchPoint();
  await tapPoint(page, switchPoint!.x, switchPoint!.y);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      index: Reflect.get(scene, "activeFighterIndex"),
      label: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
      texture: (Reflect.get(scene, "playerSprite") as Phaser.GameObjects.Image).texture.key,
    };
  })).toEqual({ index: 2, label: "PLAYER · 岳 [3/3]", texture: "fl-fighter-gaku" });
  await page.waitForTimeout(300);
  await checkFrame(page, "landscape-switch-gaku");
});

test("rival tell connects the counter move to the selected team and result next step", async ({ page }) => {
  const reads = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "selectedTeam", ["ryuga", "gaku"]);
    Reflect.set(scene, "opponent", "rush");
    Reflect.get(scene, "startBattle").call(scene);
    const tell = Reflect.get(scene, "tell") as Phaser.GameObjects.Text;
    const first = tell.text;

    Reflect.set(scene, "selectedTeam", ["ryuga", "mei"]);
    Reflect.set(scene, "nextEnemyMove", "kick");
    Reflect.get(scene, "refreshTell").call(scene);
    const second = tell.text;
    return { first, second };
  });

  expect(reads.first).toContain("編成の得意: 岳 +18%");
  expect(reads.first).not.toContain("有利手:");
  expect(reads.second).toContain("編成の得意: 冥 +18%");
  expect(reads.second).not.toContain("有利手:");
  await checkFrame(page, "portrait-team-tactical-read");

  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  const stats = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return ((Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("stats") as Phaser.GameObjects.Text).text;
  });
  expect(stats).toContain("NEXT:");
  expect(stats).toContain("編成変更");
  const visibleResultText = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const collect = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
      out: string[] = [],
    ): string[] => {
      for (const node of nodes) {
        const visible = parentVisible && ("visible" in node
          ? Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible)
          : true);
        if (!visible) continue;
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") {
          collect((node as Phaser.GameObjects.Container).list, visible, out);
        }
      }
      return out;
    };
    return collect(scene.children.list).join("\n");
  });
  expect(visibleResultText).toContain("編成変更");
  await checkFrame(page, "portrait-result-team-change-next");
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForCompactResult(page);
  const compactAdvice = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const next = find(scene.children.list, "mobile-result-next") as Phaser.GameObjects.Text;
    const reward = find(scene.children.list, "mobile-result-reward") as Phaser.GameObjects.Container;
    const primary = find(scene.children.list, "mobile-result-primary") as Phaser.GameObjects.Container;
    const hero = find(scene.children.list, "mobile-result-hero") as Phaser.GameObjects.Image;
    const enemy = find(scene.children.list, "mobile-result-enemy") as Phaser.GameObjects.Image;
    const canvas = window.__qaGame.canvas;
    const bounds = next.getBounds();
    return {
      fontPx: Number.parseFloat(next.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      rewardBottom: reward.getBounds().bottom,
      primaryTop: primary.getBounds().top,
      heroTop: hero.getBounds().top,
      enemyTop: enemy.getBounds().top,
      logicalWidth: canvas.width,
    };
  });
  expect(compactAdvice.fontPx).toBeGreaterThanOrEqual(14);
  expect(compactAdvice.left).toBeGreaterThan(16);
  expect(compactAdvice.right).toBeLessThan(compactAdvice.logicalWidth - 16);
  expect(compactAdvice.top).toBeGreaterThan(compactAdvice.rewardBottom);
  expect(compactAdvice.bottom).toBeLessThan(compactAdvice.primaryTop);
  expect(compactAdvice.bottom).toBeLessThan(compactAdvice.heroTop);
  expect(compactAdvice.bottom).toBeLessThan(compactAdvice.enemyTop);
  await expect.poll(() => visibleCopy(page)).toContain("編成を変える");
  await checkFrame(page, "compact-portrait-result-team-change-next");
  const teamAction = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.Container | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node as Phaser.GameObjects.Container;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const title = find(scene.children.list, "mobile-result-title")!;
    const primary = find(scene.children.list, "mobile-result-primary")!;
    const titleHit = title.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const primaryHit = primary.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    const titleHeight = titleHit.input!.hitArea.height as number;
    const primaryHeight = primaryHit.input!.hitArea.height as number;
    const canvas = window.__qaGame.canvas;
    return {
      x: title.x,
      bottomTap: title.y + titleHeight / 2 - 1,
      physicalHeight: titleHeight * canvas.getBoundingClientRect().height / canvas.height,
      titleTop: title.y - titleHeight / 2,
      primaryBottom: primary.y + primaryHeight / 2,
    };
  });
  expect(teamAction.physicalHeight).toBeGreaterThanOrEqual(44);
  expect(teamAction.titleTop).toBeGreaterThanOrEqual(teamAction.primaryBottom);
  await tapPoint(page, teamAction.x, teamAction.bottomTap);
  await expect.poll(() => phase(page)).toBe("title");
  await expect.poll(() => visibleCopy(page)).toContain("TEAM 2/3 · 竜牙 / 冥 · 先頭が出場");
});


test("three-battle series advances through all opponents and clears", async ({ page }) => {
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSeries").call(scene);
  });

  const state = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      phase: Reflect.get(scene, "phase"),
      opponent: Reflect.get(scene, "opponent"),
      seriesIndex: Reflect.get(scene, "seriesIndex"),
      seriesWins: Reflect.get(scene, "seriesWins"),
      active: Reflect.get(scene, "seriesActive"),
      stats: ((Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("stats") as Phaser.GameObjects.Text)?.text ?? "",
    };
  });

  await expect.poll(state).toMatchObject({ phase: "battle", opponent: "rush", seriesIndex: 0, seriesWins: 0, active: true });

  for (const [index, opponent] of ["rush", "counter", "charge"].entries()) {
    await expect.poll(state).toMatchObject({ phase: "battle", opponent, seriesIndex: index });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
      Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
      Reflect.get(scene, "finishBattle").call(scene, false);
    });
    await expect.poll(state).toMatchObject({ phase: "result", seriesWins: index + 1 });
    if (index < 2) {
      await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "handleResultPrimary").call(window.__qaGame.scene.getScene("GameScene")));
    }
  }

  const complete = await state();
  expect(complete.stats).toContain("3連戦 COMPLETE");
  expect(complete.stats).toContain("クリアボーナス +150");
  await checkFrame(page, "portrait-three-battle-complete");
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForCompactResult(page);
  await expect.poll(() => visibleCopy(page)).toContain("3連戦クリア · 3勝");
  await expect.poll(() => visibleCopy(page)).toContain("もう一度3連戦");
  await checkFrame(page, "compact-portrait-three-battle-complete");
});

test("a series loss advises the opening rival for the restart", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "selectedTeam", ["ryuga", "gaku"]);
    Reflect.get(scene, "startSeries").call(scene);
    let battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
    Reflect.get(scene, "handleResultPrimary").call(scene);
    battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("再挑戦: 岳 → 蹴 (+18%)"))).toBe(true);
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("1戦目から再挑戦"))).toBe(true);
  const resultLayout = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const legacy = ((Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("stats") as Phaser.GameObjects.Text).text;
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const next = find(scene.children.list, "mobile-result-next") as Phaser.GameObjects.Text;
    const reward = find(scene.children.list, "mobile-result-reward") as Phaser.GameObjects.Container;
    const primary = find(scene.children.list, "mobile-result-primary") as Phaser.GameObjects.Container;
    return { legacy, nextTop: next.getBounds().top, nextBottom: next.getBounds().bottom, rewardBottom: reward.getBounds().bottom, primaryTop: primary.getBounds().top };
  });
  expect(resultLayout.legacy).toContain("1戦目から · 再挑戦 · 岳 → 蹴 (+18%)");
  expect(resultLayout.nextTop).toBeGreaterThan(resultLayout.rewardBottom);
  expect(resultLayout.nextBottom).toBeLessThan(resultLayout.primaryTop);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "compact-portrait-series-restart");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "handleResultPrimary").call(scene);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return { phase: Reflect.get(scene, "phase"), opponent: Reflect.get(scene, "opponent"), index: Reflect.get(scene, "seriesIndex") };
  })).toEqual({ phase: "battle", opponent: "rush", index: 0 });
});

test("English series restart advice fits the compact result", async ({ page }) => {
  await page.goto("/?lang=en");
  await waitForSceneReady(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "selectedTeam", ["ryuga", "gaku"]);
    Reflect.get(scene, "startSeries").call(scene);
    let battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
    Reflect.get(scene, "handleResultPrimary").call(scene);
    battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await waitForCompactResult(page);
  const layout = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[], name: string): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, name);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const next = find(scene.children.list, "mobile-result-next") as Phaser.GameObjects.Text;
    const reward = find(scene.children.list, "mobile-result-reward") as Phaser.GameObjects.Container;
    const primary = find(scene.children.list, "mobile-result-primary") as Phaser.GameObjects.Container;
    const canvas = window.__qaGame.canvas;
    const bounds = next.getBounds();
    return {
      text: next.text,
      left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      rewardBottom: reward.getBounds().bottom, primaryTop: primary.getBounds().top,
      width: canvas.width,
      fontPx: Number.parseFloat(next.style.fontSize) * canvas.getBoundingClientRect().width / canvas.width,
    };
  });
  expect(layout.text).toContain("Restart from Rival 1");
  expect(layout.text).toContain("Retry: Gaku → Kick (+18%)");
  expect(layout.fontPx).toBeGreaterThanOrEqual(14);
  expect(layout.left).toBeGreaterThan(16);
  expect(layout.right).toBeLessThan(layout.width - 16);
  expect(layout.top).toBeGreaterThan(layout.rewardBottom);
  expect(layout.bottom).toBeLessThan(layout.primaryTop);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "compact-portrait-series-restart-english");
});

test("rapid result taps advance only one rival", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSeries").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(() => phase(page)).toBe("result");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container | null => {
      for (const node of nodes) {
        if (node.name === "mobile-result-primary") return node as Phaser.GameObjects.Container;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const button = find(scene.children.list)!;
    const hit = button.list.find(node => node.type === "Zone") as Phaser.GameObjects.Zone;
    hit.emit("pointerdown");
    hit.emit("pointerdown");
  });
  const seriesState = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return { phase: Reflect.get(scene, "phase"), opponent: Reflect.get(scene, "opponent"), seriesIndex: Reflect.get(scene, "seriesIndex") };
  });
  await expect.poll(seriesState).toEqual({ phase: "battle", opponent: "counter", seriesIndex: 1 });
  await page.waitForTimeout(150);
  expect(await seriesState()).toEqual({ phase: "battle", opponent: "counter", seriesIndex: 1 });
  await expect.poll(async () => {
    const copy = await visibleCopy(page);
    return copy.some(value => value.includes("自分HP 100")) && copy.some(value => value.includes("気で有利を取ろう"));
  }).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const camera = window.__qaGame.scene.getScene("GameScene").cameras.main;
    return !camera.flashEffect.isRunning && !camera.shakeEffect.isRunning;
  })).toBe(true);
  await page.waitForTimeout(200);
  await checkFrame(page, "rapid-result-next-rival");
});

test("special ready cue appears only when the move can be accepted", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSingleBattle").call(scene);
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, playerGauge: 100 });
    Reflect.set(scene, "accepting", false);
  });
  const state = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Graphics | null => {
      for (const node of nodes) {
        if (node.name === "mobile-ougi-ready-ring") return node as Phaser.GameObjects.Graphics;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    return { accepting: Reflect.get(scene, "accepting"), ring: find(scene.children.list)?.visible ?? false };
  });
  await expect.poll(async () => (await visibleCopy(page)).some(value => value.includes("奥義 準備完了"))).toBe(true);
  expect(await state()).toEqual({ accepting: false, ring: false });
  await page.waitForTimeout(200);
  await checkFrame(page, "compact-portrait-ougi-waiting");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "accepting", true));
  await expect.poll(state).toEqual({ accepting: true, ring: true });
});

test("story mode persists cleared chapters and resumes from the next opponent", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("fist_legend_story_progress_v1", "0");
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startStory").call(scene);
  });

  const storyState = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      phase: Reflect.get(scene, "phase"),
      opponent: Reflect.get(scene, "opponent"),
      chapter: Reflect.get(scene, "storyChapterIndex"),
      progress: Reflect.get(scene, "storyProgress"),
      active: Reflect.get(scene, "storyActive"),
      stats: ((Reflect.get(scene, "resultGroup") as Phaser.GameObjects.Container).getByName("stats") as Phaser.GameObjects.Text)?.text ?? "",
      stored: Number(localStorage.getItem("fist_legend_story_progress_v1") ?? "0"),
    };
  });

  await expect.poll(storyState).toMatchObject({ phase: "battle", opponent: "rush", chapter: 0, progress: 0, active: true });

  // 第一章クリア
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  await expect.poll(storyState).toMatchObject({ phase: "result", progress: 1, stored: 1 });

  // タイトルへ戻っても第二章から再開できる。
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "showTitle").call(scene);
    Reflect.get(scene, "startStory").call(scene);
  });
  await expect.poll(storyState).toMatchObject({ phase: "battle", opponent: "counter", chapter: 1, progress: 1, active: true });

  // 第二章
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
    Reflect.get(scene, "handleResultPrimary").call(scene);
  });
  await expect.poll(storyState).toMatchObject({ phase: "battle", opponent: "charge", chapter: 2, progress: 2, stored: 2 });

  // 最終章
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const battle = Reflect.get(scene, "battle") as Record<string, unknown>;
    Reflect.set(scene, "battle", { ...battle, enemyHp: 0 });
    Reflect.get(scene, "finishBattle").call(scene, false);
  });
  const complete = await storyState();
  expect(complete.phase).toBe("result");
  expect(complete.progress).toBe(3);
  expect(complete.stored).toBe(3);
  expect(complete.stats).toContain("物語 COMPLETE");
  expect(complete.stats).toContain("ボーナス +200");
  await checkFrame(page, "portrait-story-complete");
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForCompactResult(page);
  await expect.poll(() => visibleCopy(page)).toContain("物語クリア · 全3章");
  await expect.poll(() => visibleCopy(page)).toContain("物語を再演");
  await checkFrame(page, "compact-portrait-story-complete");
});



test("corrupt persisted progress does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("fist_legend_currency_v1", "-999");
    localStorage.setItem("fist_legend_team_v1", "{broken");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});

test("phone landscape keeps every title mode visible and tappable", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  const readTitle = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const labels: string[] = [];
    const named: Record<string, Array<{ visible: boolean; input: boolean; y: number }>> = {};
    const visit = (node: Phaser.GameObjects.GameObject, parentVisible = true) => {
      const visible = parentVisible && Reflect.get(node, "visible") !== false;
      if (node.type === "Text" && visible) labels.push((node as Phaser.GameObjects.Text).text);
      if (node.name.startsWith("title-")) {
        const input = !!node.input?.enabled || (node.type === "Container"
          && (node as Phaser.GameObjects.Container).list.some(child => !!child.input?.enabled));
        (named[node.name] ??= []).push({ visible, input, y: Reflect.get(node, "y") });
      }
      if (node.type === "Container") (node as Phaser.GameObjects.Container).list.forEach(child => visit(child, visible));
    };
    scene.children.list.forEach(node => visit(node));
    return { labels, named };
  });
  await expect.poll(async () => {
    const title = await readTitle();
    return ["title-battle", "title-series", "title-story", "title-gacha"].every(name =>
      title.named[name]?.some(item => item.visible && item.input && item.y <= 400),
    );
  }).toBe(true);
  const title = await readTitle();
  expect(title.labels).toEqual(expect.arrayContaining(["対戦", "3連戦", "物語", "ガチャ"]));
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/landscape-title.png", animations: "disabled" });
});
