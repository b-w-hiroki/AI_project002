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

test("touch starts battle and a move advances the beat after rotation", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapVisibleText(page, "バトル開始");
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
  await checkFrame(page, "portrait-result");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await checkFrame(page, "landscape-result");
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
  await page.waitForTimeout(260);
  await checkFrame(page, "portrait-result-ko");
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
    return (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text;
  })).toContain("蓮花");
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

  await tapPoint(page, 225, 715);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      index: Reflect.get(scene, "activeFighterIndex"),
      label: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
    };
  })).toEqual({ index: 1, label: "PLAYER · 蓮花 [2/3]" });
  await page.waitForTimeout(300);
  await checkFrame(page, "portrait-switch-renka");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await page.waitForTimeout(80);
  await tapPoint(page, 300, 402);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      index: Reflect.get(scene, "activeFighterIndex"),
      label: (Reflect.get(scene, "playerLabel") as Phaser.GameObjects.Text).text,
    };
  })).toEqual({ index: 2, label: "PLAYER · 岳 [3/3]" });
  await page.waitForTimeout(300);
  await checkFrame(page, "landscape-switch-gaku");
});

