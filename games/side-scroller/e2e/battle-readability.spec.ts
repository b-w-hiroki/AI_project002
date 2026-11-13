import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
declare global { interface Window { __qaGame: Phaser.Game } }
test.use({ hasTouch: true });
for (const width of [800, 844, 932]) {
  test(`battle readability ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 800 ? 360 : width === 844 ? 390 : 430 });
    await page.route('**/src/main.ts', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
    });
    await page.goto('/?visualqa=battle');
    await page.waitForFunction(() => !!window.__qaGame);
    await page.evaluate(() => window.__qaGame.scene.start('GameScene'));
    await page.waitForFunction(() => !!Reflect.get(window.__qaGame.scene.getScene('GameScene'), 'player'));
    await page.waitForTimeout(400); // let the existing camera fade finish before freezing
    await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene('GameScene');
      scene.physics.world.pause();
      const player = Reflect.get(scene, 'player') as Phaser.Physics.Arcade.Sprite;
      player.setPosition(200, 470).setVelocity(0, 0).anims.stop();
      const enemies = Reflect.get(scene, 'enemies') as Array<{ sprite: Phaser.Physics.Arcade.Sprite }>;
      enemies.forEach((enemy, i) => enemy.sprite.setPosition(410 + i * 130, 480).setVelocity(0, 0).anims.stop());
      scene.time.paused = true;
      scene.tweens.pauseAll();
      scene.scene.pause();
    });
    const layers = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene('GameScene');
      const veil = scene.children.getByName('side-battle-background-veil') as Phaser.GameObjects.Rectangle;
      const foliage = scene.children.list.filter(node => node.name === 'side-foreground-foliage') as Phaser.GameObjects.Graphics[];
      return { veilDepth: veil.depth, veilOpacity: veil.fillAlpha,
        foliage: foliage.map(node => ({ depth: node.depth, alpha: node.alpha })) };
    });
    expect(layers.veilDepth).toBe(-1);
    expect(layers.veilOpacity).toBe(0.32);
    expect(layers.foliage).toHaveLength(6);
    for (const leaf of layers.foliage) {
      expect(leaf.depth).toBeLessThan(2); // enemies depth=2; player depth=3
      expect(leaf.alpha).toBeLessThanOrEqual(0.4);
    }
    await expect(page.locator('canvas')).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/readability-${width}.png` });
  });
}
