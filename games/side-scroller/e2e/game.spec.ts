import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { expectResponsiveCanvas } from "../../shared/mobile/e2eViewport";

declare global { interface Window { __qaGame: Phaser.Game } }

async function canvasPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  const size = await canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });
  if (!box || !size.width || !size.height) throw new Error("canvas bounds unavailable");
  return {
    x: box.x + (x / size.width) * box.width,
    y: box.y + (y / size.height) * box.height,
  };
}

async function tapGamePoint(page: Page, x: number, y: number): Promise<void> {
  const point = await canvasPoint(page, x, y);
  await page.mouse.click(point.x, point.y);
}

async function enterBattleForVisualQa(page: Page): Promise<void> {
  // visualqa=battle では GameScene の型選択を「連撃の型」に固定して自動通過する。
  // LoadoutScene の開始ボタンを押したあと、GameScene と player の生成完了まで待つ。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ready = await page.evaluate(() => {
      const game = window.__qaGame;
      return game.scene.isActive("GameScene") && !!Reflect.get(game.scene.getScene("GameScene"), "player");
    });
    if (ready) return;
    await tapGamePoint(page, 640, 420);
    try {
      await page.waitForFunction(() => {
        const game = window.__qaGame;
        return game.scene.isActive("GameScene") && !!Reflect.get(game.scene.getScene("GameScene"), "player");
      }, undefined, { timeout: 5_000 });
      return;
    } catch {
      // A click can land before the loadout button finishes its first layout on slower engines.
    }
  }
  throw new Error("GameScene did not start after three loadout attempts");
}

test.beforeEach(async ({ page }) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto("/");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => !!window.__qaGame);
  await page.waitForTimeout(500); // 初回描画待ち
});

test("representative phone and tablet sizes preserve the canvas", async ({ page }) => {
  await expectResponsiveCanvas(page);
});

test.describe("landscape loadout readability", () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test("uses the battle aspect ratio and keeps supplementary text readable", async ({ page }) => {
    await expect.poll(() => page.locator("canvas").evaluate(node => (node as HTMLCanvasElement).height)).toBe(450);
    const result = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("LoadoutScene");
      const sizes = scene.children.list
        .filter(node => node.type === "Text" && (node as Phaser.GameObjects.Text).visible)
        .map(node => Number.parseFloat(String((node as Phaser.GameObjects.Text).style.fontSize)));
      const canvas = window.__qaGame.canvas;
      const scale = canvas.getBoundingClientRect().height / canvas.height;
      return { minLogical: Math.min(...sizes), minPhysical: Math.min(...sizes) * scale };
    });
    expect(result.minLogical).toBeGreaterThanOrEqual(17);
    expect(result.minPhysical).toBeGreaterThanOrEqual(14);
    await page.locator("canvas").screenshot({ path: "e2e/screenshots/side-loadout-844x390.png", animations: "disabled" });
  });
});

test.describe("English localization", () => {
  test.use({ hasTouch: true });

  test("English fallback localizes loadout and battle HUD", async ({ page }) => {
    await page.goto("/?lang=en");
    await page.waitForFunction(() => !!window.__qaGame);
    await expect.poll(async () => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("LoadoutScene");
      const collect = (nodes: Phaser.GameObjects.GameObject[], out: string[] = []): string[] => {
        for (const node of nodes) {
          if (node.type === "Text") out.push((node as Phaser.GameObjects.Text).text);
          if (node.type === "Container") collect((node as Phaser.GameObjects.Container).list, out);
        }
        return out;
      };
      const labels = collect(scene.children.list);
      return labels.some(label => label.includes("Blade Woods"))
        && labels.some(label => label.includes("Loadout"))
        && labels.includes("▶ Start Run");
    })).toBe(true);

    await page.goto("/?visualqa=battle&lang=en");
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    await expect.poll(() => page.evaluate(() => window.__qaGame.scene.isActive("GameScene"))).toBe(true);
    const lang = await page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "lang"));
    expect(lang).toBe("en");
  });
});

test("ゲームが起動して canvas が表示される", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/game.png" });
});

test("右キーでプレイヤーが移動する（画面が変化する）", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("攻撃キー(X)で剣の演出が表示される", async ({ page }) => {
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.keyboard.press("x");
  await page.waitForTimeout(80); // 攻撃判定の有効時間内
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});

test.describe("phone visual QA", () => {
  test.use({ hasTouch: true });

  test("visual QA: phone portrait battle 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForTimeout(500);
    await enterBattleForVisualQa(page);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-portrait-battle-390x844.png",
      animations: "disabled",
    });
  });

  test("visual QA: phone landscape battle 844x390", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForTimeout(500);
    await enterBattleForVisualQa(page);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-landscape-battle-844x390.png",
      animations: "disabled",
    });
  });

  test("mock battle view has one owner and legacy rollback remains available", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    const modern = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return scene.children.list.filter(child => child.name === "side-mock-battle-view").length;
    });
    expect(modern).toBe(1);

    await page.goto("/?visualqa=battle&legacyView=1");
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    const legacy = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return scene.children.list.some(child => child.name === "side-mock-battle-view");
    });
    expect(legacy).toBe(false);
  });

  test("direct drag moves the hero without a fixed directional pad", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?visualqa=battle");
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    const controls = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
      const names: string[] = [];
      const labels: string[] = [];
      const visit = (nodes: Phaser.GameObjects.GameObject[]) => nodes.forEach(node => {
        if (node.name) names.push(node.name);
        if (node.type === "Text" && "text" in node) labels.push((node as Phaser.GameObjects.Text).text);
        if (node.type === "Container") visit((node as Phaser.GameObjects.Container).list);
      });
      visit(mock.list);
      return { names, labels };
    });
    expect(controls.names).toContain("direct-move-zone");
    expect(controls.labels).toContain("左側をドラッグして移動");
    expect(controls.labels).not.toEqual(expect.arrayContaining(["←", "→", "↑", "↓"]));

    const beforeX = await page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "player") as Phaser.Physics.Arcade.Sprite).x);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
      const findNamed = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | undefined => {
        for (const node of nodes) {
          if (node.name === "direct-move-zone") return node;
          if (node.type === "Container") {
            const nested = findNamed((node as Phaser.GameObjects.Container).list);
            if (nested) return nested;
          }
        }
        return undefined;
      };
      const directZone = findNamed(mock.list) as Phaser.GameObjects.Zone;
      const pointer = { id: 31, x: 70, y: 680 } as Phaser.Input.Pointer;
      directZone.emit("pointerdown", pointer);
      scene.input.emit("pointermove", { ...pointer, x: 155 });
    });
    await expect.poll(() => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "player") as Phaser.Physics.Arcade.Sprite).x)).toBeGreaterThan(beforeX + 4);
    await page.evaluate(() => {
      window.__qaGame.scene.getScene("GameScene").input.emit("pointerup", { id: 31 });
    });
    await expect.poll(() => page.evaluate(() => {
      const player = Reflect.get(window.__qaGame.scene.getScene("GameScene"), "player") as Phaser.Physics.Arcade.Sprite;
      return Math.abs((player.body as Phaser.Physics.Arcade.Body).velocity.x);
    })).toBeLessThan(1);

    // A second finger must not steal the active drag. Releasing the owner
    // clears movement even if another pointer is still present.
    const multiTouchState = await page.evaluate(async () => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
      const findNamed = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | undefined => {
        for (const node of nodes) {
          if (node.name === "direct-move-zone") return node;
          if (node.type === "Container") {
            const nested = findNamed((node as Phaser.GameObjects.Container).list);
            if (nested) return nested;
          }
        }
        return undefined;
      };
      const directZone = findNamed(mock.list) as Phaser.GameObjects.Zone;
      const first = { id: 41, x: 50, y: 680 } as Phaser.Input.Pointer;
      const second = { id: 42, x: 155, y: 680 } as Phaser.Input.Pointer;
      directZone.emit("pointerdown", first);
      directZone.emit("pointerdown", second);
      scene.input.emit("pointermove", { ...second, x: 190 });
      const right = (Reflect.get(scene, "cursors") as Phaser.Types.Input.Keyboard.CursorKeys).right;
      const afterSecond = right.isDown;
      scene.input.emit("pointermove", { ...first, x: 140 });
      const afterOwner = right.isDown;
      scene.input.emit("pointerup", first);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const afterRelease = right.isDown;
      return { afterSecond, afterOwner, afterRelease };
    });
    expect(multiTouchState).toEqual({ afterSecond: false, afterOwner: true, afterRelease: false });

    // Browser cancellation and orientation rebuilds must never leave movement held.
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
      const findNamed = (nodes: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | undefined => {
        for (const node of nodes) {
          if (node.name === "direct-move-zone") return node;
          if (node.type === "Container") {
            const nested = findNamed((node as Phaser.GameObjects.Container).list);
            if (nested) return nested;
          }
        }
        return undefined;
      };
      const directZone = findNamed(mock.list) as Phaser.GameObjects.Zone;
      const pointer = { id: 51, x: 70, y: 680 } as Phaser.Input.Pointer;
      directZone.emit("pointerdown", pointer);
      scene.input.emit("pointermove", { ...pointer, x: 155 });
    });
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return (Reflect.get(scene, "cursors") as Phaser.Types.Input.Keyboard.CursorKeys).right.isDown;
    })).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel")));
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return (Reflect.get(scene, "cursors") as Phaser.Types.Input.Keyboard.CursorKeys).right.isDown;
    })).toBe(false);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
      const countNamed = (nodes: Phaser.GameObjects.GameObject[]): number => nodes.reduce((count, node) =>
        count + (node.name === "direct-move-zone" ? 1 : 0)
          + (node.type === "Container" ? countNamed((node as Phaser.GameObjects.Container).list) : 0), 0);
      return countNamed(mock.list);
    })).toBe(1);

    const keyboardBefore = await page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "player") as Phaser.Physics.Arcade.Sprite).x);
    await page.keyboard.down("ArrowRight");
    await expect.poll(() => page.evaluate(() => (Reflect.get(window.__qaGame.scene.getScene("GameScene"), "player") as Phaser.Physics.Arcade.Sprite).x)).toBeGreaterThan(keyboardBefore + 4);
    await page.keyboard.up("ArrowRight");
  });
  test("visual QA: normal agile and tank use distinct art", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    const keys = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const current = Reflect.get(scene, "enemies") as Array<{ sprite: Phaser.Physics.Arcade.Sprite }>;
      current.forEach(enemy => {
        enemy.sprite.setVisible(false);
        const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
        body.enable = false;
      });
      Reflect.set(scene, "enemies", []);
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      player.setVisible(false);
      const scrollY = scene.cameras.main.scrollY;
      scene.cameras.main.stopFollow();
      scene.cameras.main.setScroll(0, scrollY);
      const spawn = Reflect.get(scene, "spawnEnemy");
      const specs = [
        { type: "normal", health: 3, defense: 0, speedMul: 1 },
        { type: "agile", health: 2, defense: 0, speedMul: 1.8 },
        { type: "tank", health: 7, defense: 2, speedMul: 0.6 },
      ];
      [250, 390, 530].forEach((x, i) => spawn.call(scene, 2, specs[i], x, i));
      scene.physics.pause();
      return (Reflect.get(scene, "enemies") as Array<{ sprite: Phaser.Physics.Arcade.Sprite }>)
        .map(enemy => enemy.sprite.texture.key);
    });
    expect(keys).toEqual(["goblin-art", "goblin-agile-art", "goblin-tank-art"]);
    await page.waitForTimeout(250);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-enemy-variants-844x390.png",
      animations: "disabled",
    });
  });

  test("approved forest, hero, and boss remain separate live game objects", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    const sceneState = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const current = Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
      }>;
      current.forEach(enemy => enemy.sprite.destroy());
      Reflect.set(scene, "enemies", []);
      Reflect.set(scene, "wave", 5);
      Reflect.get(scene, "spawnWave").call(scene, 5);

      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      const enemies = Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
        boss: boolean;
      }>;
      const boss = enemies.find(enemy => enemy.boss);
      if (!boss) throw new Error("wave 5 boss was not spawned");

      scene.cameras.main.stopFollow();
      scene.cameras.main.setScroll(0, 0);
      player.setPosition(300, 430).setVisible(true);
      boss.sprite.setPosition(610, 400).setVisible(true);
      scene.physics.pause();

      const background = scene.children.list.find(child =>
        child.type === "Image"
        && (child as Phaser.GameObjects.Image).texture.key === "sf-approved-forest-battle-v2");
      const body = boss.sprite.body as Phaser.Physics.Arcade.Body;
      return {
        textures: {
          background: scene.textures.exists("sf-approved-forest-battle-v2"),
          heroIdle: scene.textures.exists("sf-approved-hero-idle-v3"),
          heroRun: scene.textures.exists("sf-approved-hero-run-v3"),
          heroAttack: scene.textures.exists("sf-approved-hero-attack-v3"),
          boss: scene.textures.exists("sf-approved-boss-ogre-v2"),
        },
        backgroundIsSeparate: !!background,
        playerTexture: player.texture.key,
        bossTexture: boss.sprite.texture.key,
        bossBody: { width: body.width, height: body.height, enabled: body.enable },
      };
    });

    expect(sceneState).toEqual({
      textures: { background: true, heroIdle: true, heroRun: true, heroAttack: true, boss: true },
      backgroundIsSeparate: true,
      playerTexture: "hero-art",
      bossTexture: "forest-guardian-art",
      bossBody: { width: 27, height: 45, enabled: true },
    });
    await page.waitForTimeout(100);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-boss-battle-v2-844x390.png",
      animations: "disabled",
    });
  });

  test("hero switches idle, run, attack, guard, and hurt poses without moving the live hitbox", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const enemies = Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
      }>;
      // This test owns hero presentation, not combat timing. Keep the live
      // wave registered while removing enemy contact that can lock the hurt
      // pose during a slower WebKit keypress sequence.
      enemies.forEach(({ sprite }) => {
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.enable = false;
        sprite.setVisible(false);
      });
      Reflect.set(scene, "playerPoseLockedUntil", 0);
    });

    const readPose = () => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      const body = player.body as Phaser.Physics.Arcade.Body;
      return {
        texture: player.texture.key,
        body: { width: body.width, height: body.height, bottom: Math.round(body.bottom) },
        guarding: Reflect.get(scene, "guarding") as boolean,
      };
    });

    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      return (player.body as Phaser.Physics.Arcade.Body).blocked.down;
    })).toBe(true);
    await page.locator("canvas").focus();
    await expect.poll(readPose).toMatchObject({ texture: "hero-art", body: { width: 27, height: 48 } });
    const idle = await readPose();

    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const cursors = Reflect.get(scene, "cursors") as Phaser.Types.Input.Keyboard.CursorKeys;
      cursors.right.onDown(new KeyboardEvent("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
      }));
    });
    await expect.poll(readPose).toMatchObject({ texture: "hero-run-art" });
    const running = await readPose();
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-hero-run-v3-800x600.png",
      animations: "disabled",
    });

    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const cursors = Reflect.get(scene, "cursors") as Phaser.Types.Input.Keyboard.CursorKeys;
      cursors.right.onUp(new KeyboardEvent("keyup", {
        key: "ArrowRight",
        code: "ArrowRight",
      }));
      // Key#onUp intentionally returns early while the keyboard plugin is
      // disabled (which can briefly happen around focus changes in WebKit).
      // Reset the synthetic key unconditionally so this pose test cannot
      // leave movement latched after its own injected input.
      cursors.right.reset();
    });
    await expect.poll(readPose, { timeout: 2_000 }).toMatchObject({ texture: "hero-art" });

    await page.locator("canvas").focus();
    await page.keyboard.down("x");
    await expect.poll(readPose).toMatchObject({ texture: "hero-attack-art" });
    const attackFx = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return scene.children.list.filter(child => child.name === "side-slash-afterimage").length;
    });
    expect(attackFx).toBeGreaterThan(0);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-hero-attack-v3-800x600.png",
      animations: "disabled",
    });
    await page.keyboard.up("x");
    await page.evaluate(() => {
      window.__qaGame.scene.getScene("GameScene").input.keyboard?.resetKeys();
    });
    await expect.poll(readPose, { timeout: 2_000 }).toMatchObject({ texture: "hero-art" });

    await page.keyboard.down("Shift");
    await expect.poll(readPose).toMatchObject({ texture: "hero-art", guarding: true });
    await page.keyboard.up("Shift");
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      Reflect.get(scene, "playPlayerDamageFx").call(scene, player.x + 100);
    });
    await expect.poll(readPose).toMatchObject({ texture: "hero-hurt-art" });
    await expect.poll(readPose, { timeout: 2_000 }).toMatchObject({ texture: "hero-art" });

    for (const pose of [idle, running]) {
      expect(pose.body.width).toBe(27);
      expect(pose.body.height).toBe(48);
      expect(Math.abs(pose.body.bottom - idle.body.bottom)).toBeLessThanOrEqual(3);
    }
  });

  test("melee range endpoint visually reaches the live boss and deals damage", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    const before = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const current = Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
      }>;
      current.forEach(enemy => enemy.sprite.destroy());
      Reflect.set(scene, "enemies", []);
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      const state = Reflect.get(scene, "playerState") as Record<string, unknown>;
      Reflect.set(scene, "playerState", {
        ...state,
        facing: 1,
        equippedWeapon: "melee",
        customWeapons: {},
        attackingUntil: 0,
        lastAttackAt: -100_000,
        ougiActiveUntil: 0,
        hiougiActiveUntil: 0,
        skillActiveUntil: 0,
      });
      Reflect.get(scene, "spawnWave").call(scene, 5);
      const boss = (Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
        state: { health: number };
        boss: boolean;
      }>).find(enemy => enemy.boss);
      if (!boss) throw new Error("wave 5 boss was not spawned");
      scene.cameras.main.stopFollow();
      scene.cameras.main.setScroll(0, 0);
      player.setPosition(300, 430).setVisible(true);
      boss.sprite.setPosition(390, 430).setVisible(true);
      const playerBody = player.body as Phaser.Physics.Arcade.Body;
      const bossBody = boss.sprite.body as Phaser.Physics.Arcade.Body;
      playerBody.setAllowGravity(false).setVelocity(0, 0);
      bossBody.setAllowGravity(false).setVelocity(0, 0);
      playerBody.moves = false;
      bossBody.moves = false;
      playerBody.updateFromGameObject();
      bossBody.updateFromGameObject();
      return { health: boss.state.health, distance: boss.sprite.x - player.x };
    });

    // Drive the same Phaser key object and attack handler in one browser task.
    // WebKit/Linux can otherwise consume JustDown during the frame between the
    // synthetic setup and the keyboard event, making this geometry test race.
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const attackKey = Reflect.get(scene, "attackKey") as Phaser.Input.Keyboard.Key;
      attackKey.onDown(new KeyboardEvent("keydown", { key: "x", code: "KeyX" }));
      Reflect.get(scene, "handleAttack").call(scene, scene.time.now);
    });
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const boss = (Reflect.get(scene, "enemies") as Array<{
        state: { health: number };
        boss: boolean;
      }>).find(enemy => enemy.boss);
      return boss?.state.health ?? Number.POSITIVE_INFINITY;
    })).toBeLessThan(before.health);
    const after = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      const boss = (Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
        state: { health: number };
        boss: boolean;
      }>).find(enemy => enemy.boss);
      if (!boss) throw new Error("wave 5 boss disappeared");
      return {
        health: boss.state.health,
        heroPose: player.texture.key,
        slashVisible: scene.children.list.some(child =>
          child.type === "Image"
          && (child as Phaser.GameObjects.Image).texture.key === "combat-slash-fx"),
      };
    });
    expect(before.distance).toBe(90);
    expect(after.health).toBeLessThan(before.health);
    expect(after).toMatchObject({ heroPose: "hero-attack-art", slashVisible: true });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const attackKey = Reflect.get(scene, "attackKey") as Phaser.Input.Keyboard.Key;
      attackKey.onUp(new KeyboardEvent("keyup", { key: "x", code: "KeyX" }));
    });
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-boss-melee-contact-v2-800x600.png",
      animations: "disabled",
    });
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      const boss = (Reflect.get(scene, "enemies") as Array<{
        sprite: Phaser.Physics.Arcade.Sprite;
        boss: boolean;
      }>).find(enemy => enemy.boss);
      if (!boss) throw new Error("wave 5 boss disappeared");
      const debug = scene.add.graphics().setDepth(100);
      for (const sprite of [player, boss.sprite]) {
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        debug.lineStyle(3, 0xff3158, 1).strokeRect(body.x, body.y, body.width, body.height);
        debug.fillStyle(0x31f0ff, 1).fillCircle(sprite.x, sprite.y, 4);
      }
    });
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-boss-melee-contact-debug-v2-800x600.png",
      animations: "disabled",
    });
  });

  test("visual QA: attack pose and slash read clearly", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    const attackFx = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const camera = scene.cameras.main;
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      camera.stopFollow();
      player.setPosition(camera.scrollX + 400, camera.scrollY + 300).setVisible(true);
      Reflect.get(scene, "spawnAttackFx").call(scene, {
        kind: "melee",
        range: 110,
        attackWindowMs: 220,
      });
      scene.physics.pause();
      return {
        texture: scene.textures.exists("combat-slash-fx"),
        sprite: scene.children.list.some(child =>
          child.type === "Image" &&
          (child as Phaser.GameObjects.Image).texture.key === "combat-slash-fx"),
        heroPose: player.texture.key,
      };
    });
    expect(attackFx).toEqual({ texture: true, sprite: true, heroPose: "hero-attack-art" });
    await page.waitForTimeout(35);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-attack-pose-844x390.png",
      animations: "disabled",
    });
  });

  test("dedicated hit sprite appears for player damage", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    const hitFx = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
      Reflect.get(scene, "playPlayerDamageFx").call(scene, player.x + 100);
      return {
        texture: scene.textures.exists("combat-hit-fx"),
        sprite: scene.children.list.some(child =>
          child.type === "Image" &&
          (child as Phaser.GameObjects.Image).texture.key === "combat-hit-fx"),
        heroPose: player.texture.key,
      };
    });
    expect(hitFx).toEqual({ texture: true, sprite: true, heroPose: "hero-hurt-art" });
    await page.waitForTimeout(45);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-player-hit-sprite-844x390.png",
      animations: "disabled",
    });
  });

  test("mobile guard button holds and releases guard state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);

    await page.evaluate(() => {
      window.__qaGame.scene.getScene("GameScene").input.keyboard?.resetKeys();
    });
    await expect.poll(() => page.evaluate(() =>
      Reflect.get(window.__qaGame.scene.getScene("GameScene"), "crouching") as boolean
    )).toBe(false);

    const guardPoint = await canvasPoint(page, 268, 756);
    await page.mouse.move(guardPoint.x, guardPoint.y);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return {
        keyDown: (Reflect.get(scene, "guardKey") as Phaser.Input.Keyboard.Key).isDown,
        guarding: Reflect.get(scene, "guarding") as boolean,
        crouching: Reflect.get(scene, "crouching") as boolean,
      };
    })).toEqual({ keyDown: true, guarding: true, crouching: false });

    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return {
        keyDown: (Reflect.get(scene, "guardKey") as Phaser.Input.Keyboard.Key).isDown,
        guarding: Reflect.get(scene, "guarding") as boolean,
      };
    })).toEqual({ keyDown: false, guarding: false });
  });

  test("visual QA: game over hides touch controls", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const state = Reflect.get(scene, "playerState") as Record<string, unknown>;
      Reflect.set(scene, "playerState", { ...state, health: 0 });
      Reflect.get(scene, "checkStatus").call(scene);
    });
    await expect.poll(() => page.evaluate(() => Reflect.get(window.__qaGame.scene.getScene("GameScene"), "status"))).toBe("gameover");
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const controls = Reflect.get(scene, "virtualControls") as Phaser.GameObjects.Container | undefined;
      const mock = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container | null;
      const retry = scene.children.getByName("side-retry-action") as Phaser.GameObjects.Container | null;
      return {
        legacyControls: controls?.visible ?? false,
        mockVisible: mock?.visible ?? false,
        retryVisible: retry?.visible ?? false,
        retryHeight: retry?.height ?? 0,
      };
    })).toEqual({ legacyControls: false, mockVisible: false, retryVisible: true, retryHeight: 58 });
    const box = (await page.locator("canvas").boundingBox())!;
    expect(58 * box.height / 450).toBeGreaterThanOrEqual(44);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-game-over-844x390.png",
      animations: "disabled",
    });
    await tapGamePoint(page, 400, 348);
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return Reflect.get(scene, "status");
    })).toBe("playing");
    // Let the restarted scene finish its first wave setup before Playwright
    // tears down the page; WebKit otherwise races Phaser's text texture draw.
    await page.waitForTimeout(1_000);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps foreground depth but disables foliage sway and slash afterimages", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?visualqa=battle");
    await page.locator("canvas").waitFor();
    await page.waitForFunction(() => !!window.__qaGame);
    await enterBattleForVisualQa(page);
    const state = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      const foliage = scene.children.list.filter(child => child.name === "side-foreground-foliage");
      Reflect.get(scene, "spawnAttackFx").call(scene, {
        kind: "melee",
        range: 90,
        damage: 1,
        cooldownMs: 350,
        attackWindowMs: 150,
        projectile: false,
      });
      return {
        reducedMotion: Reflect.get(scene, "reducedMotion") as boolean,
        foliage: foliage.length,
        foliageTweens: foliage.filter(child => scene.tweens.getTweensOf(child).length > 0).length,
        afterimages: scene.children.list.filter(child => child.name === "side-slash-afterimage").length,
      };
    });
    expect(state).toEqual({ reducedMotion: true, foliage: 6, foliageTweens: 0, afterimages: 0 });
  });
});


test("corrupt persisted progress does not block startup", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("ai_project002_sideScroller_bestWave_v1", "-999");
  });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__qaGame);
});


test("wave tactics explain how the selected stance should fight", async ({ page }) => {
  await page.goto("/?visualqa=battle");
  await page.waitForFunction(() => !!window.__qaGame);
  await enterBattleForVisualQa(page);

  const chainAdvice = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "combatStyle", "chain");
    Reflect.get(scene, "refreshTacticalAdvice").call(scene);
    return (scene.children.getByName("wave-tactic") as Phaser.GameObjects.Text | null)?.text ?? "";
  });
  const drawAdvice = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    Reflect.set(scene, "combatStyle", "draw");
    Reflect.get(scene, "refreshTacticalAdvice").call(scene);
    return (scene.children.getByName("wave-tactic") as Phaser.GameObjects.Text | null)?.text ?? "";
  });

  expect(chainAdvice.length).toBeGreaterThan(10);
  expect(drawAdvice.length).toBeGreaterThan(10);
  expect(chainAdvice).not.toBe(drawAdvice);
  await page.screenshot({ path: "e2e/screenshots/phone-wave-tactic.png", animations: "disabled" });
});

test("battle HUD reports the live wave without a false level or wave cap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?visualqa=battle");
  await page.waitForFunction(() => !!window.__qaGame);
  await enterBattleForVisualQa(page);
  const labels = await page.evaluate(() => {
    const scene = window.__qaGame.scene.getScene("GameScene");
    const root = scene.children.getByName("side-mock-battle-view") as Phaser.GameObjects.Container;
    return root.list.filter(node => node.type === "Text").map(node => (node as Phaser.GameObjects.Text).text);
  });
  expect(labels.some(label => /^HP \d+\/\d+$/.test(label))).toBe(true);
  expect(labels.some(label => /^第\d+波$/.test(label))).toBe(true);
  expect(labels.join(" ")).not.toMatch(/LV\.28|WAVE \d+\/3/);
  await page.locator("canvas").screenshot({ path: "e2e/screenshots/side-live-hud-390x844.png", animations: "disabled" });
});
