import Phaser from "phaser";
import { bossPhase } from "./logic/style";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  bornAt: number;
  bossDir: 1 | -1;
};

type GameRuntime = Phaser.Scene & {
  enemies: BossEnemy[];
};

const lastPhase = new WeakMap<object, string>();

function announce(
  scene: Phaser.Scene,
  text: string,
  color: string,
  duration = 520,
): void {
  const label = scene.add
    .text(400, 154, text, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      fontStyle: "800",
      color,
      stroke: "#201812",
      strokeThickness: 5,
      backgroundColor: "rgba(20, 15, 14, 0.72)",
      padding: { x: 16, y: 7 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(130)
    .setAlpha(0)
    .setScale(1.12);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    duration: 110,
    ease: "Back.easeOut",
  });
  scene.time.delayedCall(duration, () => {
    scene.tweens.add({
      targets: label,
      alpha: 0,
      y: 146,
      duration: 150,
      onComplete: () => label.destroy(),
    });
  });
}

function pulseBorder(scene: Phaser.Scene, color: number): void {
  const frame = scene.add.graphics().setScrollFactor(0).setDepth(125);
  frame.lineStyle(5, color, 0.8).strokeRoundedRect(10, 10, 780, 580, 18);
  scene.tweens.add({
    targets: frame,
    alpha: 0,
    duration: 420,
    ease: "Sine.easeOut",
    onComplete: () => frame.destroy(),
  });
}

function chargeStreak(scene: Phaser.Scene, dir: 1 | -1): void {
  const streak = scene.add.graphics().setScrollFactor(0).setDepth(124);
  const fromX = dir === 1 ? 140 : 660;
  const toX = dir === 1 ? 660 : 140;
  streak.lineStyle(7, 0xff8b63, 0.88).lineBetween(fromX, 340, toX, 340);
  streak.lineStyle(2, 0xffe0b0, 0.95).lineBetween(fromX, 333, toX, 333);
  streak.setScale(0.15, 1);
  scene.tweens.add({
    targets: streak,
    scaleX: 1,
    alpha: 0,
    duration: 230,
    ease: "Cubic.easeOut",
    onComplete: () => streak.destroy(),
  });
}

function onBossPhase(scene: GameRuntime, enemy: BossEnemy): void {
  const phase = bossPhase(scene.time.now - enemy.bornAt);
  if (lastPhase.get(scene) === phase) return;
  lastPhase.set(scene, phase);

  if (phase === "tell") {
    announce(scene, "予兆　突進方向を読む", "#ffd0a3", 560);
    pulseBorder(scene, 0xd85d47);
  } else if (phase === "charge") {
    scene.cameras.main.shake(120, 0.0035);
    chargeStreak(scene, enemy.bossDir);
  } else {
    announce(scene, "隙！　反撃", "#ffe17d", 650);
    pulseBorder(scene, 0xf0bd4f);
  }
}

/**
 * ボスAIはそのままに、予兆→突進→隙の読み合いを視覚的に強調する。
 * フェーズ切替時だけ生成するため、通常フレームの負荷は最小限に抑える。
 */
export function installSideScrollerPresentation(): void {
  const proto = GameScene.prototype as unknown as object;
  const originalUpdateEnemies = Reflect.get(proto, "updateEnemies") as
    | ((this: GameScene) => void)
    | undefined;
  if (!originalUpdateEnemies) return;

  Reflect.set(proto, "updateEnemies", function (this: GameScene) {
    originalUpdateEnemies.call(this);
    const runtime = this as unknown as GameRuntime;
    const boss = runtime.enemies.find((enemy) => enemy.boss);
    if (!boss) {
      lastPhase.delete(runtime);
      return;
    }
    onBossPhase(runtime, boss);
  });
}
