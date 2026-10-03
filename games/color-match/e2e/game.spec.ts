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
  page.on("console", message => {
    if (message.type() === "error") messages.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", request => messages.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test("six individual answer parts are visible and operable in landscape play", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSession").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("playing");

  const readAnswerState = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const answers: Array<{
      name: string;
      visible: boolean;
      interactive: boolean;
      center: { x: number; y: number } | null;
    }> = [];
    const visit = (nodes: Phaser.GameObjects.GameObject[], parentVisible = true): void => {
      for (const node of nodes) {
        const ownVisible = "visible" in node
          ? Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible)
          : true;
        const visible = parentVisible && ownVisible;
        if (node.name?.startsWith("answer-card-")) {
          answers.push({ name: node.name, visible, interactive: false, center: null });
        }
        if (node.name?.startsWith("answer-hit-")) {
          const zone = node as Phaser.GameObjects.Zone;
          const bounds = zone.getBounds();
          answers.push({
            name: node.name,
            visible,
            interactive: Boolean(zone.input?.enabled),
            center: { x: bounds.centerX, y: bounds.centerY },
          });
        }
        if (node.type === "Container") {
          visit((node as Phaser.GameObjects.Container).list, visible);
        }
      }
    };
    visit(scene.children.list);
    return answers;
  });

  await expect.poll(async () => {
    const answers = await readAnswerState();
    const cards = answers.filter(answer => answer.name.startsWith("answer-card-"));
    const hits = answers.filter(answer => answer.name.startsWith("answer-hit-"));
    return cards.length === 6 && hits.length === 6
      && cards.every(answer => answer.visible)
      && hits.every(answer => answer.visible && answer.interactive);
  }).toBe(true);

  const answerState = await readAnswerState();

  const cards = answerState.filter(answer => answer.name.startsWith("answer-card-"));
  const hits = answerState.filter(answer => answer.name.startsWith("answer-hit-"));
  expect(cards).toHaveLength(6);
  expect(hits).toHaveLength(6);
  expect(cards.every(answer => answer.visible)).toBe(true);
  expect(hits.every(answer => answer.visible && answer.interactive)).toBe(true);

  const firstHit = hits[0]!;
  expect(firstHit.center).not.toBeNull();
  await tapPoint(page, firstHit.center!.x, firstHit.center!.y);
  await expect.poll(() => page.evaluate(() =>
    Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting")
  )).toBe(false);
});

test("portrait keeps six large ordered controls and guards rapid taps", async ({ page }) => {
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSession").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("playing");

  const readControls = () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const found: Array<{ name: string; x: number; y: number; width: number; height: number; active: boolean }> = [];
    const visit = (nodes: Phaser.GameObjects.GameObject[], parentVisible = true): void => {
      for (const node of nodes) {
        const visible = parentVisible && (!("visible" in node) || Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible));
        if (visible && node.name?.startsWith("portrait-answer-hit-")) {
          const zone = node as Phaser.GameObjects.Zone;
          const bounds = zone.getBounds();
          found.push({ name: node.name, x: bounds.centerX, y: bounds.centerY, width: bounds.width, height: bounds.height, active: Boolean(zone.input?.enabled) });
        }
        if (node.type === "Container") visit((node as Phaser.GameObjects.Container).list, visible);
      }
    };
    visit(scene.children.list);
    return found.sort((a, b) => a.name.localeCompare(b.name));
  });
  await expect.poll(async () => (await readControls()).length).toBe(6);
  const controls = await readControls();

  expect(controls.map(control => control.name.split("-").at(-1))).toEqual(["red", "blue", "yellow", "green", "purple", "orange"]);
  expect(controls).toHaveLength(6);
  expect(controls.every(control => control.active && control.width >= 44 && control.height >= 44)).toBe(true);
  expect(controls.map(control => [control.x, control.y])).toEqual([[108, 438], [342, 438], [108, 548], [342, 548], [108, 658], [342, 658]]);

  const waitForTapReady = () => expect.poll(() => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return Boolean(Reflect.get(scene, "accepting"))
      && performance.now() >= Number(Reflect.get(scene, "nextTapAllowedAt"));
  })).toBe(true);

  for (const [index, control] of controls.entries()) {
    await waitForTapReady();
    await tapPoint(page, control.x, control.y);
    await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length)).toBe(index + 1);
  }

  await waitForTapReady();
  const before = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length);
  await tapPointTwiceRapidly(page, controls[0]!.x, controls[0]!.y);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length)).toBe(before + 1);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length)).toBe(before + 1);
});

test("browser back recreates a playable scene", async ({ page }) => {
  await page.goto("/?visit=second");
  await page.waitForFunction(() => !!window.__qaGame);
  await page.goBack();
  await page.waitForFunction(() => !!window.__qaGame);
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.get(scene, "startSession").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("playing");
  await tapPoint(page, 108, 438);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length)).toBe(1);
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

async function tapPointTwiceRapidly(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const size = await canvas.evaluate(node => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
  const clientX = box.x + x * box.width / size.width;
  const clientY = box.y + y * box.height / size.height;
  await Promise.all([
    page.touchscreen.tap(clientX, clientY),
    page.touchscreen.tap(clientX, clientY),
  ]);
}

const phase = (page: Page) => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "phase"));

async function namedBounds(page: Page, name: string) {
  return page.evaluate((targetName) => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
    ): Phaser.GameObjects.GameObject | null => {
      for (const node of nodes) {
        const visible = parentVisible && (!("visible" in node) || Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible));
        if (visible && node.name === targetName) return node;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, visible);
          if (nested) return nested;
        }
      }
      return null;
    };
    const node = find(scene.children.list);
    if (!node || !("getBounds" in node)) return null;
    const bounds = (node as Phaser.GameObjects.Zone).getBounds();
    return { x: bounds.centerX, y: bounds.centerY, width: bounds.width, height: bounds.height };
  }, name);
}

async function tapNamed(page: Page, name: string): Promise<void> {
  const bounds = await namedBounds(page, name);
  expect(bounds, `${name} should be visible`).not.toBeNull();
  await tapPoint(page, bounds!.x, bounds!.y);
}

async function namedText(page: Page, name: string): Promise<string | null> {
  return page.evaluate((targetName) => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (
      nodes: Phaser.GameObjects.GameObject[],
      parentVisible = true,
    ): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        const visible = parentVisible && (!("visible" in node) || Boolean((node as Phaser.GameObjects.GameObject & { visible?: boolean }).visible));
        if (visible && node.name === targetName && node.type === "Text") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list, visible);
          if (nested) return nested;
        }
      }
      return null;
    };
    return find(scene.children.list)?.text ?? null;
  }, name);
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

test("visible practice and replay actions keep their promised session mode", async ({ page }) => {
  await expect.poll(() => namedBounds(page, "portrait-practice-action")).not.toBeNull();
  const titlePractice = await namedBounds(page, "portrait-practice-action");
  expect(titlePractice!.height).toBeGreaterThanOrEqual(52);
  await tapNamed(page, "portrait-practice-action");
  await expect.poll(() => phase(page)).toBe("playing");

  const practiceState = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      mode: Reflect.get(scene, "sessionMode"),
      duration: Reflect.get(scene, "sessionDurationMs"),
      remaining: Reflect.get(scene, "sessionRemaining"),
    };
  });
  expect(practiceState.mode).toBe("practice");
  expect(practiceState.duration).toBe(20_000);
  expect(practiceState.remaining).toBeLessThanOrEqual(20_000);
  expect(practiceState.remaining).toBeGreaterThan(18_000);
  await expect.poll(() => namedText(page, "portrait-session-context")).toBe("PRACTICE");
  await expect.poll(() => namedText(page, "portrait-session-guidance")).not.toContain("次のルールまで");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "sessionMode"))).toBe("practice");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "sessionRemaining", 1));
  await expect.poll(() => phase(page)).toBe("result");
  await page.waitForTimeout(750);
  expect(await phase(page)).toBe("result");
  await expect.poll(() => namedBounds(page, "landscape-result-primary-action")).not.toBeNull();
  await expect.poll(() => namedBounds(page, "landscape-result-secondary-action")).not.toBeNull();

  await tapNamed(page, "landscape-result-primary-action");
  await expect.poll(() => phase(page)).toBe("playing");
  expect(await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "sessionDurationMs"))).toBe(20_000);
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "sessionRemaining", 1));
  await expect.poll(() => phase(page)).toBe("result");

  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(450);
  await expect.poll(() => namedBounds(page, "portrait-result-primary-action")).not.toBeNull();
  await expect.poll(() => namedBounds(page, "portrait-result-secondary-action")).not.toBeNull();
  await tapNamed(page, "portrait-result-secondary-action");
  await expect.poll(() => phase(page)).toBe("playing");
  const challengeState = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    return {
      mode: Reflect.get(scene, "sessionMode"),
      duration: Reflect.get(scene, "sessionDurationMs"),
    };
  });
  expect(challengeState).toEqual({ mode: "challenge", duration: 60_000 });
});

test("touch starts a challenge and rotation preserves play", async ({ page }) => {
  await checkFrame(page, "portrait-title");
  await tapNamed(page, "portrait-challenge-action");
  await expect.poll(() => phase(page)).toBe("playing");
  await checkFrame(page, "portrait-play");
  const portraitBefore = await page.locator("canvas").screenshot();
  await tapPoint(page, 108, 438);
  await expect.poll(async () => !(await page.locator("canvas").screenshot()).equals(portraitBefore)).toBe(true);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "accepting"))).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).width)).toBe(800);
  const before = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length);
  await tapPoint(page, 470, 170);
  await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "results").length)).toBe(before + 1);
  await checkFrame(page, "landscape-play");
});

test("portrait result keeps the mock hierarchy", async ({ page }) => {
  await tapNamed(page, "portrait-challenge-action");
  await expect.poll(() => phase(page)).toBe("playing");
  await page.evaluate(() => Reflect.set(window.__qaGame.scene.getScene("GameScene"), "sessionRemaining", 1));
  await expect.poll(() => phase(page)).toBe("result");
  await checkFrame(page, "portrait-result");
});

test("result names one improvement and retries in one tap", async ({ page }) => {
  await tapNamed(page, "portrait-challenge-action");
  await expect.poll(() => phase(page)).toBe("playing");
  await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "results", [
      { correct: true, timedOut: false, reactionMs: 650, mode: "content", switched: false },
      { correct: false, timedOut: false, reactionMs: 760, mode: "color", switched: true },
      { correct: false, timedOut: false, reactionMs: 720, mode: "content", switched: true },
      { correct: true, timedOut: false, reactionMs: 680, mode: "color", switched: false },
    ]);
    Reflect.get(scene, "endSession").call(scene);
  });
  await expect.poll(() => phase(page)).toBe("result");
  const visibleText = await page.evaluate(() => {
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
        if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, visible, out);
      }
      return out;
    };
    return collect(scene.children.list).join("\n");
  });
  expect(visibleText).toContain("次の目標: ルール切替直後の1問を丁寧に");
  const portraitNext = async () => page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const find = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text | null => {
      for (const node of nodes) {
        if (node.name === "result-next-focus" && node.type === "Text") return node as Phaser.GameObjects.Text;
        if (node.type === "Container") {
          const nested = find((node as Phaser.GameObjects.Container).list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const node = find(scene.children.list);
    return node ? { text: node.text, visible: node.visible, depth: node.depth } : null;
  });
  await expect.poll(async () => (await portraitNext())?.text).toBe("次の目標: ルール切替直後の1問を丁寧に");
  expect((await portraitNext())?.visible).toBe(true);
  await checkFrame(page, "portrait-result-next-focus");

  await tapNamed(page, "portrait-result-primary-action");
  await expect.poll(() => phase(page)).toBe("playing");
});

test("high-accuracy result shows an S grade in portrait and landscape", async ({ page }) => {
  await tapNamed(page, "portrait-challenge-action");
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



test("corrupt persisted progress does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("color_match_60s_best_score_v1", "-999");
    localStorage.setItem("color_match_performance_v1", "{broken");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});
