import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";
import { KARMA_REQUESTS } from "../src/logic/karma";

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
    maxDiffPixelRatio: 0.005,
  });
});

async function useNativePortrait(page: Page) {
  await page.setViewportSize({ width: 456, height: 806 });
}

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

test("portrait title keeps the approved visual mock", async ({ page }) => {
  await useNativePortrait(page);
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "homeRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りなくて剣が作れない…", karmaDelta: 5 }));
  await expect(page.locator("canvas")).toHaveScreenshot("karma-title-mock.png", {
    animations: "disabled", maxDiffPixelRatio: 0.035,
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
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "onKarmaChoice").call(scene, true);
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
    Reflect.get(scene, "startRun").call(scene);
    const choose = Reflect.get(scene, "onKarmaChoice");
    Reflect.set(scene, "currentRequest", { id: "warrior_iron", faction: "warrior", text: "鉄が足りない", karmaDelta: 5 });
    choose.call(scene, true);
    Reflect.set(scene, "stage", 2);
    Reflect.set(scene, "phase", "karma");
    Reflect.set(scene, "currentRequest", { id: "mage_book", faction: "mage", text: "禁書を読みたい", karmaDelta: 4 });
    choose.call(scene, false);
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
    Reflect.set(scene, "currentRequest", { id: "mage_stone", faction: "mage", text: "魔法の研究に魔石がほしいのです…", karmaDelta: 5 });
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
  })).toEqual(expect.arrayContaining(["支援を見送りました", "+1", "変化なし"]));
});

test("reaction waits for Next across rotation and advances only once", async ({ page }) => {
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  await page.evaluate(() => {
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
    Reflect.get(scene, "onKarmaChoice").call(scene, true);
    // A repeated choice must not apply karma or append another record.
    Reflect.get(scene, "onKarmaChoice").call(scene, true);
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
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.get(scene, "startRun").call(scene);
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
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await page.locator("canvas").boundingBox())?.width).toBe(314);
  await tapPoint(page, 225, 660);
  await expect.poll(() => phase(page)).toBe("karma");
  for (const request of KARMA_REQUESTS) for (const accepted of [true, false]) {
    await page.evaluate(({ request, accepted }) => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      Reflect.set(scene, "phase", "karma");
      Reflect.set(scene, "currentRequest", request);
      Reflect.get(scene, "onKarmaChoice").call(scene, accepted);
    }, { request, accepted });
    for (const mode of ["reaction", "wide", "final"]) {
      if (mode === "wide" || mode === "final") {
        await page.setViewportSize(mode === "wide" ? { width: 844, height: 390 } : { width: 320, height: 568 });
        await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(mode === "wide" ? 800 : 450);
      }
      if (mode === "final") await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "showFinal").call(window.__qaGame.scene.getScene("GameScene")));
      await expect.poll(() => page.evaluate(({ mode, faction }) => {
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
        const body = byName(mode === "final" ? "chronicleBody" : "reactionBody");
        const other = byName(mode === "final" ? "chronicleTitle" : "reactionQuote");
        if (!body || !other) return false;
        const a = body.getBounds(), b = other.getBounds();
        const canvas = document.querySelector("canvas")!;
        const scale = canvas.getBoundingClientRect().width / canvas.width;
        const readable = [body, ...labels.filter(label => label.name.startsWith("stat:"))]
          .every(label => Number.parseFloat(String(label.style.fontSize)) * scale >= 14);
        const separated = a.bottom + 3 <= b.top || b.bottom + 3 <= a.top;
        const inside = a.left >= 20 && a.right <= canvas.width - 20 && (mode !== "final" || a.bottom <= 303);
        const factionArt = { warrior: "kq-bg-warrior-forge-v1", merchant: "kq-bg-merchant-market-v1", outlaw: "kq-bg-outlaw-courtyard-v1", mage: "kq-bg-mage-study-v1" };
        const activeArt = artwork.filter(key => Object.values(factionArt).includes(key));
        return readable && separated && inside && activeArt.length === 1 && activeArt[0] === factionArt[faction];
      }, { mode, faction: request.faction }), { message: `${request.id}, accepted=${accepted}, ${mode}` }).toBe(true);
    }
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
