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
    await tapGamePoint(page, 400, 545);
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

    let runStarted = false;
    for (let attempt = 0; attempt < 3 && !runStarted; attempt += 1) {
      await page.locator("canvas").focus();
      await page.keyboard.down("ArrowRight");
      try {
        await page.waitForFunction(() => {
          const scene = window.__qaGame.scene.getScene("GameScene");
          const player = Reflect.get(scene, "player") as Phaser.Physics.Arcade.Sprite;
          return player.texture.key === "hero-run-art";
        }, undefined, { timeout: 1_500 });
        runStarted = true;
      } catch {
        await page.keyboard.up("ArrowRight");
        await page.waitForTimeout(80);
      }
    }
    expect(runStarted).toBe(true);
    const running = await readPose();
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-approved-hero-run-v3-800x600.png",
      animations: "disabled",
    });

    await page.keyboard.press("x", { delay: 30 });
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
    await page.keyboard.up("ArrowRight");
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
      return { health: boss.state.health, distance: boss.sprite.x - player.x };
    });

    await page.keyboard.down("x");
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
    await page.keyboard.up("x");
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

    const guardPoint = await canvasPoint(page, 268, 756);
    await page.mouse.move(guardPoint.x, guardPoint.y);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene("GameScene");
      return {
        keyDown: (Reflect.get(scene, "guardKey") as Phaser.Input.Keyboard.Key).isDown,
        guarding: Reflect.get(scene, "guarding") as boolean,
      };
    })).toEqual({ keyDown: true, guarding: true });

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
      return { legacyControls: controls?.visible ?? false, mockVisible: mock?.visible ?? false };
    })).toEqual({ legacyControls: false, mockVisible: false });
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-game-over-844x390.png",
      animations: "disabled",
    });
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
