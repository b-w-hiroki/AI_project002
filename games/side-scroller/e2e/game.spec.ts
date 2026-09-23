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
  await page.touchscreen.tap(point.x, point.y);
}

async function enterBattleForVisualQa(page: Page): Promise<void> {
  // visualqa=battle では GameScene の型選択を「連撃の型」に固定して自動通過する。
  // ここでは LoadoutScene のステージ開始だけを実端末同様の touch 入力で押す。
  await tapGamePoint(page, 400, 545);
  await page.waitForTimeout(900);
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
      };
    });
    expect(attackFx).toEqual({ texture: true, sprite: true });
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
      };
    });
    expect(hitFx).toEqual({ texture: true, sprite: true });
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
      return controls?.visible ?? false;
    })).toBe(false);
    await page.locator("canvas").screenshot({
      path: "e2e/screenshots/side-game-over-844x390.png",
      animations: "disabled",
    });
  });
});
