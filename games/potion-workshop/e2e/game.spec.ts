import { expect, test } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";

declare global { interface Window { __qaGame: Phaser.Game } }

const SAVE_KEY = "ai_project002_save_v1";
const runtimeErrors = new WeakMap<import("@playwright/test").Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("requestfailed", request => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.waitForTimeout(600);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test("English locale covers responsive workshop and town choice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });

  const responsiveLabels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
      }
      return out;
    };
    return {
      lang: Reflect.get(scene, "lang"),
      labels: collect(scene.children.list),
    };
  });
  expect(responsiveLabels.lang).toBe("en");
  expect(responsiveLabels.labels).toContain("Potion Workshop");
  expect(responsiveLabels.labels).toContain("TAP TO BREW");
  expect(responsiveLabels.labels).toContain("TODAY'S ORDERS");
  expect(responsiveLabels.labels).toContain("UPGRADE");
  expect(responsiveLabels.labels).toContain("Let's brew something\nwonderful today!");

  const modalLabels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      potions: 2_000_000,
      totalBrewed: 1_000_000,
      lifetimeBrewed: Math.max(Number(state.lifetimeBrewed ?? 0), 1_000_000),
      prestigeCount: 0,
      townIndex: 0,
    });
    Reflect.get(scene, "showTownChoice").call(scene);
    const modal = Reflect.get(scene, "townChoiceModal") as Phaser.GameObjects.Container;
    const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
      }
      return out;
    };
    return collect(modal.list);
  });
  expect(modalLabels).toContain("Choose Your Next Town");
  expect(modalLabels.some(label => label.includes("Orsha, City by the Water"))).toBe(true);
  expect(modalLabels.some(label => label.includes("Ascend to This Town"))).toBe(true);
});

test("official and stirring alchemist textures decode and survive scene re-entry", async ({ page }) => {
  const readHero = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const findHero = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Image | undefined => {
      for (const node of nodes) {
        if (node.name === "workshop-hero") return node as Phaser.GameObjects.Image;
        if (node.type === "Container") {
          const found = findHero((node as Phaser.GameObjects.Container).list);
          if (found) return found;
        }
      }
      return undefined;
    };
    const hero = findHero(scene.children.list);
    const source = scene.textures.get("pw-hero-alchemist").getSourceImage() as HTMLImageElement;
    const stirringSource = scene.textures.get("pw-hero-stirring-v2").getSourceImage() as HTMLImageElement;
    return {
      heroTexture: hero?.texture.key,
      officialLoaded: scene.textures.exists("pw-hero-alchemist"),
      stirringLoaded: scene.textures.exists("pw-hero-stirring-v2"),
      approvedCatLoaded: scene.textures.exists("pw-approved-cat-visible"),
      invalidDuplicateLoaded: scene.textures.exists("pw-hero-alchemist-female"),
      sourceWidth: source.naturalWidth || source.width,
      sourceHeight: source.naturalHeight || source.height,
      stirringWidth: stirringSource.naturalWidth || stirringSource.width,
      stirringHeight: stirringSource.naturalHeight || stirringSource.height,
    };
  });

  await expect.poll(readHero).toEqual({
    heroTexture: "pw-hero-stirring-v2",
    officialLoaded: true,
    stirringLoaded: true,
    approvedCatLoaded: true,
    invalidDuplicateLoaded: false,
    sourceWidth: 512,
    sourceHeight: 512,
    stirringWidth: 640,
    stirringHeight: 640,
  });

  await page.evaluate(() => window.__qaGame.scene.getScene("idle").scene.restart());
  await expect.poll(readHero).toEqual({
    heroTexture: "pw-hero-stirring-v2",
    officialLoaded: true,
    stirringLoaded: true,
    approvedCatLoaded: true,
    invalidDuplicateLoaded: false,
    sourceWidth: 512,
    sourceHeight: 512,
    stirringWidth: 640,
    stirringHeight: 640,
  });
});

test("browser back returns to an error-free workshop", async ({ page }) => {
  await page.goto("/?return-check=1");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.goBack();
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    return scene.scene.isActive() && scene.textures.exists("pw-hero-alchemist");
  })).toBe(true);
});

async function canvasSize(page: import("@playwright/test").Page): Promise<{ width: number; height: number }> {
  return page.locator("canvas").evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
}

async function clickBrew(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const logical = await canvasSize(page);
  const portrait = logical.height > logical.width;
  const brew = portrait ? { x: 225, y: 440 } : { x: 335, y: 246 };
  await page.mouse.click(
    box.x + brew.x * (box.width / logical.width),
    box.y + brew.y * (box.height / logical.height),
  );
}

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("大釜をクリックするとポーションが増える（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await clickBrew(page);
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("縦持ちと横持ちでゲーム面が切り替わる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  await expect.poll(async () => (await canvasSize(page)).width).toBe(450);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await canvasSize(page)).width).toBe(800);
  await expect.poll(async () => (await canvasSize(page)).height).toBe(450);
});

test("進行状況が localStorage に自動セーブされる", async ({ page }) => {
  await clickBrew(page);

  // 起動直後の1フレーム目は読み込み待ち分のdeltaが大きく計上され、クリック前でも
  // ほぼ即座に1回目の自動保存が走ることがある（totalBrewed: 0のまま）。
  // localStorageが非nullになったことだけを見ると、そのクリック前のスナップショットを
  // 拾って誤判定するため、クリックの効果（totalBrewed >= 1）が反映されるまで直接ポーリングする。
  await expect
    .poll(
      async () => {
        const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
        if (!raw) return 0;
        return JSON.parse(raw).state.totalBrewed;
      },
      { timeout: 15_000, intervals: [500, 1_000, 1_500] },
    )
    .toBeGreaterThanOrEqual(1);
});

test("portrait and landscape workshop are captured for visual QA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  const portraitComposition = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const findNamed = (
      nodes: Phaser.GameObjects.GameObject[],
      name: string,
    ): Phaser.GameObjects.Image | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node as Phaser.GameObjects.Image;
        if (node.type === "Container") {
          const found = findNamed((node as Phaser.GameObjects.Container).list, name);
          if (found) return found;
        }
      }
      return undefined;
    };
    const hero = findNamed(scene.children.list, "workshop-hero")!;
    const cauldron = findNamed(scene.children.list, "workshop-cauldron")!;
    const cat = findNamed(scene.children.list, "approved-workshop-cat")!;
    const findObject = (
      nodes: Phaser.GameObjects.GameObject[],
      name: string,
    ): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const found = findObject((node as Phaser.GameObjects.Container).list, name);
          if (found) return found;
        }
      }
      return undefined;
    };
    const brewTarget = findObject(scene.children.list, "brew-hit-target") as Phaser.GameObjects.Zone;
    const navTargets = [0, 1, 2, 3].map(index =>
      findObject(scene.children.list, `workshop-nav-${index}`) as Phaser.GameObjects.Zone,
    );
    const blackboard = findObject(scene.children.list, "workshop-blackboard-text") as Phaser.GameObjects.Text;
    return {
      hero: { texture: hero.texture.key, x: hero.x, y: hero.y, width: hero.displayWidth, height: hero.displayHeight },
      cauldron: { x: cauldron.x, y: cauldron.y, width: cauldron.displayWidth, height: cauldron.displayHeight },
      cat: { x: cat.x, y: cat.y, width: cat.displayWidth, height: cat.displayHeight },
      blackboard: { visible: blackboard.visible, text: blackboard.text },
      brewTarget: { width: brewTarget.width, height: brewTarget.height, interactive: !!brewTarget.input?.enabled },
      navTargets: navTargets.map(zone => ({ width: zone.width, height: zone.height, interactive: !!zone.input?.enabled })),
    };
  });
  expect(portraitComposition).toEqual({
    hero: { texture: "pw-hero-stirring-v2", x: 230, y: 292, width: 350, height: 350 },
    cauldron: { x: 225, y: 440, width: 260, height: 260 },
    cat: { x: 102, y: 408, width: 150, height: 164 },
    blackboard: { visible: true, text: expect.stringMatching(/次の依頼|NEXT ORDER/) },
    brewTarget: { width: 230, height: 220, interactive: true },
    navTargets: Array.from({ length: 4 }, () => ({ width: 100, height: 68, interactive: true })),
  });
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/portrait-workshop.png", animations: "disabled" });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await canvasSize(page)).width).toBe(800);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/landscape-workshop.png", animations: "disabled" });
});

test("visual QA: brewing shows a magical burst", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page)).height).toBe(800);
  await clickBrew(page);
  await page.waitForTimeout(90);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-brew-burst.png",
    animations: "disabled",
  });
});

test("portrait management nav keeps orders, upgrades, equipment, and ascension functional", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });
  const result = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const findNamed = (
      nodes: Phaser.GameObjects.GameObject[],
      name: string,
    ): Phaser.GameObjects.GameObject | undefined => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.type === "Container") {
          const found = findNamed((node as Phaser.GameObjects.Container).list, name);
          if (found) return found;
        }
      }
      return undefined;
    };
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      potions: 2_000_000,
      totalBrewed: 1_000_000,
      lifetimeBrewed: Math.max(Number(state.lifetimeBrewed ?? 0), 1_000_000),
    });
    const zones = [0, 1, 2, 3].map(index =>
      findNamed(scene.children.list, `workshop-nav-${index}`) as Phaser.GameObjects.Zone,
    );

    zones[0]!.emit("pointerdown");
    const ordersOpened = !!Reflect.get(scene, "contractModal");
    (Reflect.get(scene, "contractModal") as Phaser.GameObjects.Container | null)?.destroy(true);
    Reflect.set(scene, "contractModal", null);

    const beforeUpgrade = Reflect.get(scene, "state") as { clickPower: number };
    zones[1]!.emit("pointerdown");
    const afterUpgrade = Reflect.get(scene, "state") as { clickPower: number; counts: Record<string, number> };
    const equipmentBefore = Object.values(afterUpgrade.counts).reduce((sum, value) => sum + value, 0);
    zones[2]!.emit("pointerdown");
    const afterEquipment = Reflect.get(scene, "state") as { counts: Record<string, number> };
    const equipmentAfter = Object.values(afterEquipment.counts).reduce((sum, value) => sum + value, 0);

    zones[3]!.emit("pointerdown");
    return {
      ordersOpened,
      clickPowerDelta: afterUpgrade.clickPower - beforeUpgrade.clickPower,
      equipmentDelta: equipmentAfter - equipmentBefore,
      ascensionOpened: !!Reflect.get(scene, "townChoiceModal"),
    };
  });
  expect(result).toEqual({
    ordersOpened: true,
    clickPowerDelta: 1,
    equipmentDelta: 1,
    ascensionOpened: true,
  });
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(persisted.state.clickPower).toBeGreaterThan(1);
  expect(Object.values(persisted.state.counts as Record<string, number>).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
});



test("prestige opens two town choices and moves to the selected town", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });
  const initial = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      potions: 2_000_000,
      totalBrewed: 1_000_000,
      lifetimeBrewed: Math.max(Number(state.lifetimeBrewed ?? 0), 1_000_000),
      prestigeCount: 0,
      townIndex: 0,
    });
    Reflect.get(scene, "showTownChoice").call(scene);
    const modal = Reflect.get(scene, "townChoiceModal") as Phaser.GameObjects.Container;
    const names = modal.list
      .filter(node => node.type === "Zone" && node.name.startsWith("town-choice-"))
      .map(node => node.name);
    return { names, state: Reflect.get(scene, "state") };
  });
  expect(initial.names).toEqual(["town-choice-1", "town-choice-2"]);

  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-town-choice.png",
    animations: "disabled",
  });

  const next = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const modal = Reflect.get(scene, "townChoiceModal") as Phaser.GameObjects.Container;
    const choose = modal.getData("chooseTown") as (townIndex: number) => void;
    choose(2);
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    return {
      townIndex: state.townIndex,
      prestigeCount: state.prestigeCount,
      essence: state.essence,
    };
  });
  expect(next.townIndex).toBe(2);
  expect(next.prestigeCount).toBe(1);
  expect(Number(next.essence)).toBeGreaterThanOrEqual(1);

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(saved.state.townIndex).toBe(2);
  expect(saved.state.prestigeCount).toBe(1);
});

test("visual QA: all workshop generators have distinct shelf silhouettes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvasSize(page))).toEqual({ width: 450, height: 800 });
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", {
      ...state,
      counts: {
        apprentice: 1,
        cauldron: 1,
        garden: 1,
        golem: 1,
        portal: 1,
        observatory: 1,
        dragon: 1,
        worldTree: 1,
      },
    });
    Reflect.get(scene, "refreshWorkshopDecor").call(scene);
  });
  await page.waitForTimeout(80);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/portrait-workshop-all-equipment.png",
    animations: "disabled",
  });
});



test("corrupt persisted save does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("ai_project002_save_v1", "{broken");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});


test("next objective guides the workshop loop", async ({ page }) => {
  const objective = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    return (scene.children.getByName("next-objective") as Phaser.GameObjects.Text | null)?.text ?? "";
  });
  expect(objective).toMatch(/次の目標|NEXT/);
  expect(objective).toMatch(/注文|order/i);

  const ascension = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("idle");
    const state = Reflect.get(scene, "state") as Record<string, unknown>;
    Reflect.set(scene, "state", { ...state, totalBrewed: 1_000_000 });
    Reflect.get(scene, "refreshUI").call(scene);
    return (scene.children.getByName("next-objective") as Phaser.GameObjects.Text | null)?.text ?? "";
  });
  expect(ascension).toMatch(/転生|Ascend/i);
});
