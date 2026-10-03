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

test("approved home hero is visible and legacy home remains available", async ({ page }) => {
  const state = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const loadedKeys = [
      "st-generated-hero",
      "st-generated-capital-bg",
      "st-approved-home-hero",
      "st-approved-lord-avatar",
    ];
    const collectVisibleImages = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
      out: string[] = [],
    ): string[] => {
      for (const node of nodes) {
        const visible = parentVisible && ("visible" in node
          ? Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible)
          : true);
        if (!visible) continue;
        if (node.type === "Image") {
          out.push((node as Phaser.GameObjects.Image).texture.key);
        }
        if (node.type === "Container") {
          collectVisibleImages((node as Phaser.GameObjects.Container).list, visible, out);
        }
      }
      return out;
    };
    const visible = collectVisibleImages(scene.children.list);
    const home = scene.children.list.find(child => child.name === "mock-home-view") as Phaser.GameObjects.Container;
    const statusText = home.getData("homeStatusText") as Phaser.GameObjects.Text;
    return {
      loaded: loadedKeys.every(key => scene.textures.exists(key)),
      approvedVisible: visible.includes("st-approved-home-hero"),
      avatarVisible: visible.includes("st-approved-lord-avatar"),
      legacyVisible: visible.includes("st-generated-hero"),
      ownerCount: scene.children.list.filter(child => child.name === "mock-home-view").length,
      statusText: statusText.text,
    };
  });
  expect(state).toEqual({
    loaded: true,
    approvedVisible: true,
    avatarVisible: true,
    legacyVisible: false,
    ownerCount: 1,
    statusText: "武将 0   遠征記録 0",
  });
  await checkFrame(page, "portrait-title-generated-assets");
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/mock-current-home-450x800.png",
    animations: "disabled",
  });

  await page.evaluate(() => Reflect.deleteProperty(window, "__qaGame"));
  await page.goto("/?legacyHome=1");
  await page.waitForFunction(() => !!window.__qaGame);
  const legacyState = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      search: window.location.search,
      mockOwner: scene.children.list.some(child => child.name === "mock-home-view"),
    };
  });
  expect(legacyState).toEqual({ search: "?legacyHome=1", mockOwner: false });
});

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test("English fallback localizes home and campaign", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.waitForFunction(() => !!window.__qaGame);
  await expect.poll(async () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
      }
      return out;
    };
    return collect(scene.children.list);
  })).toEqual(expect.arrayContaining(["1  BASE", "General Gacha", "Equipment Fusion"]));

  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  const lang = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("ExpeditionScene"), "lang"));
  expect(lang).toBe("en");
});

async function tapPoint(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const size = await canvas.evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  await page.touchscreen.tap(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
}

const expeditionView = (page: Page) => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("ExpeditionScene"), "view"));

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

test("touch opens campaign and starts an expedition after rotation", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await checkFrame(page, "portrait-campaign");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  const before = await page.locator("canvas").screenshot();
  await tapPoint(page, 700, 389);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await expect.poll(() => expeditionView(page)).toBe("road");
  await checkFrame(page, "landscape-expedition");
});

test("management screens keep readable visual hierarchy", async ({ page }) => {
  const sceneVisible = async (method: string) => page.evaluate(method => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, method).call(scene);
    return Reflect.get(scene, "phase");
  }, method);

  await expect(sceneVisible("showGacha")).resolves.toBe("gacha");
  await checkFrame(page, "portrait-gacha");

  await expect(sceneVisible("showBreeding")).resolves.toBe("breeding");
  await checkFrame(page, "portrait-breeding");

  await expect(sceneVisible("showRoster")).resolves.toBe("roster");
  await checkFrame(page, "portrait-roster");
});

test("expedition result is visually reviewable after a clear", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 700, 389);
  await expect.poll(() => expeditionView(page)).toBe("road");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const run = Reflect.get(scene, "run") as Record<string, unknown>;
    Reflect.set(scene, "settled", false);
    Reflect.set(scene, "run", { ...run, status: "clear", step: 10 });
    Reflect.get(scene, "settle").call(scene);
  });
  await expect.poll(() => expeditionView(page)).toBe("result");
  await checkFrame(page, "landscape-result");
});

test("regional gatekeepers keep distinct chapter identity", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 700, 389);
  await expect.poll(() => expeditionView(page)).toBe("road");

  for (const region of ["plains", "pass", "citadel"] as const) {
    const boss = await page.evaluate(region => {
      const scene = window.__qaGame.scene.getScene("ExpeditionScene");
      const run = Reflect.get(scene, "run") as Record<string, unknown>;
      Reflect.set(scene, "run", { ...run, regionId: region, step: 9 });
      Reflect.set(scene, "introRunId", Reflect.get(scene, "run").id);
      Reflect.get(scene, "render").call(scene);
      const root = Reflect.get(scene, "root") as Phaser.GameObjects.Container;
      const findNamed = (
        nodes: Phaser.GameObjects.GameObject[],
        name: string,
      ): Phaser.GameObjects.GameObject | null => {
        for (const node of nodes) {
          if (node.name === name) return node;
          if (node.type === "Container") {
            const found = findNamed((node as Phaser.GameObjects.Container).list, name);
            if (found) return found;
          }
        }
        return null;
      };
      return {
        label: (root.getByName("boss-region-label") as Phaser.GameObjects.Text | null)?.text ?? "",
        texture: (root.getByName("gatekeeper-boss") as Phaser.GameObjects.Image | null)?.texture.key ?? "",
        mobileTexture: (findNamed(scene.children.list, "mobile-region-boss") as Phaser.GameObjects.Image | null)?.texture.key ?? "",
      };
    }, region);
    expect(boss.label).toMatch(region === "plains" ? /黎明/ : region === "pass" ? /翠嶺/ : /紅蓮/);
    expect(boss.texture).toBe(`st-boss-${region}`);
    expect(boss.mobileTexture).toBe(`st-boss-${region}`);
    await checkFrame(page, `landscape-boss-${region}`);
  }
});

test("gatekeeper clear uses the dedicated strike cinematic", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 700, 389);
  await expect.poll(() => expeditionView(page)).toBe("road");

  const status = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const run = Reflect.get(scene, "run") as Record<string, unknown>;
    const seeded = { ...run, step: 9, fork: false, status: "active", hp: 100 };
    Reflect.set(scene, "run", seeded);
    Reflect.set(scene, "introRunId", seeded.id);
    Reflect.set(scene, "random", () => 0);
    Reflect.get(scene, "render").call(scene);
    Reflect.get(scene, "advance").call(scene);
    return (Reflect.get(scene, "run") as Record<string, unknown>).status;
  });
  expect(status).toBe("clear");
  await page.waitForTimeout(330);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/landscape-boss-clear-impact.png",
    animations: "disabled",
  });
});

test("small skirmish win shows attack and hit impact", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 700, 389);
  await expect.poll(() => expeditionView(page)).toBe("road");

  const message = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const run = Reflect.get(scene, "run") as Record<string, unknown>;
    Reflect.set(scene, "run", { ...run, step: 0, fork: false, status: "active", hp: 100 });
    Reflect.set(scene, "random", () => 0);
    Reflect.get(scene, "render").call(scene);
    Reflect.get(scene, "advance").call(scene);
    return (Reflect.get(scene, "run") as Record<string, unknown>).message;
  });
  expect(String(message)).toContain("小競り合い：勝利");
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const root = Reflect.get(scene, "root") as Phaser.GameObjects.Container;
    return !!root.getByName("skirmish-impact");
  })).toBe(true);
  await page.waitForTimeout(70);
  await page.locator("canvas").screenshot({
    path: "e2e/screenshots/landscape-skirmish-impact.png",
    animations: "disabled",
  });
});

test("campaign shows asynchronous army rating against ghost rivals", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  const readRating = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const root = Reflect.get(scene, "root") as Phaser.GameObjects.Container | undefined;
    if (!root?.list) return "";
    const labels: string[] = [];
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (node.type === "Text") labels.push((node as Phaser.GameObjects.Text).text);
      if (node.type === "Container") (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    root.list.forEach(visit);
    return labels.find(value => value.includes("軍勢評点")) ?? "";
  });
  await expect.poll(readRating).toContain("軍勢評点");
  await expect.poll(readRating).toMatch(/位|首位/);
  await checkFrame(page, "portrait-army-ranking");
});



test("corrupt persisted progress does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("sangoku_tap_currency_v1", "-999");
    localStorage.setItem("sangoku_tap_owned_generals_v1", "{broken");
    localStorage.setItem("sangoku_expedition_v1", "{broken");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});


test("route fork shows risk, expected loot, and squad fit", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const run = {
      id: crypto.randomUUID(),
      regionId: "pass",
      troop: {
        ids: ["gen_soujin", "gen_kohei", "gen_ashigaru"],
        power: 145,
        guard: 0.25,
        scout: 0,
        merchant: 1.2,
      },
      step: 3,
      hp: 100,
      loot: 40,
      route: "road",
      fork: true,
      status: "active",
      message: "fork qa",
    };
    Reflect.set(scene, "run", run);
    Reflect.set(scene, "view", "road");
    Reflect.get(scene, "render").call(scene);
  });
  const preview = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const root = Reflect.get(scene, "root") as Phaser.GameObjects.Container;
    const road = root.getByName("route-preview-road") as Phaser.GameObjects.Text | null;
    const mountain = root.getByName("route-preview-mountain") as Phaser.GameObjects.Text | null;
    return { road: road?.text ?? "", mountain: mountain?.text ?? "" };
  });
  expect(preview.road).toMatch(/街道|Road/);
  expect(preview.mountain).toMatch(/山道|Mountain/);
  expect(preview.mountain).toMatch(/高リスク|High Risk|編成相性|Squad Fit|安定|Stable/);
  await checkFrame(page, "portrait-route-preview");
});

test("defeat result shows secured coins instead of projected loot", async ({ page }) => {
  await tapPoint(page, 225, 635);
  await expect.poll(() => expeditionView(page)).toBe("camp");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await tapPoint(page, 700, 389);
  await expect.poll(() => expeditionView(page)).toBe("road");
  const labels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("ExpeditionScene");
    const run = Reflect.get(scene, "run") as Record<string, unknown>;
    Reflect.set(scene, "run", { ...run, status: "defeat", loot: 99, step: 4 });
    Reflect.set(scene, "view", "result");
    Reflect.get(scene, "render").call(scene);
    const values: string[] = [];
    const root = Reflect.get(scene, "root") as Phaser.GameObjects.Container;
    const visit = (node: Phaser.GameObjects.GameObject) => {
      if (node.type === "Text") values.push((node as Phaser.GameObjects.Text).text);
      if (node.type === "Container") (node as Phaser.GameObjects.Container).list.forEach(visit);
    };
    root.list.forEach(visit);
    return values;
  });
  expect(labels.some(label => label.includes("49") && /持ち帰り|Secured/.test(label))).toBe(true);
  expect(labels.some(label => label.includes("99") && /銭|Coins/.test(label))).toBe(false);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/landscape-defeat-result.png", animations: "disabled" });
});
