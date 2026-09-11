import Phaser from "phaser";
import { IdleScene } from "./scenes/IdleScene";

type IdleRuntime = Phaser.Scene & {
  potionText?: Phaser.GameObjects.Text;
};

type TapState = {
  lastAt: number;
  streak: number;
};

const tapState = new WeakMap<object, TapState>();
const BURST_OFFSETS = [
  { x: -34, y: -12, r: 5 },
  { x: -19, y: -31, r: 4 },
  { x: 2, y: -38, r: 6 },
  { x: 25, y: -26, r: 4 },
  { x: 36, y: -5, r: 5 },
] as const;

function brewBurst(scene: IdleRuntime): void {
  const ring = scene.add
    .circle(160, 210, 70, 0x77e8b7, 0)
    .setStrokeStyle(3, 0x7cf3c1, 0.78)
    .setDepth(80)
    .setScale(0.82);
  scene.tweens.add({
    targets: ring,
    scale: 1.18,
    alpha: 0,
    duration: 280,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });

  for (const offset of BURST_OFFSETS) {
    const spark = scene.add
      .circle(160 + offset.x, 208 + offset.y, offset.r, 0xcaffdf, 0.92)
      .setDepth(81);
    scene.tweens.add({
      targets: spark,
      x: spark.x + offset.x * 0.45,
      y: spark.y - 28,
      scale: 0.45,
      alpha: 0,
      duration: 260,
      ease: "Cubic.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  if (scene.potionText) {
    scene.tweens.killTweensOf(scene.potionText);
    scene.potionText.setScale(1);
    scene.tweens.add({
      targets: scene.potionText,
      scale: 1.08,
      duration: 70,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }
}

function showStreak(scene: Phaser.Scene, streak: number): void {
  if (streak < 3) return;
  const label = scene.add
    .text(160, 292, `BREW ×${streak}`, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      fontStyle: "800",
      color: "#fff8dc",
      backgroundColor: "rgba(31, 138, 99, 0.82)",
      padding: { x: 11, y: 5 },
    })
    .setOrigin(0.5)
    .setDepth(90)
    .setAlpha(0)
    .setScale(0.9);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    y: 286,
    duration: 100,
    ease: "Back.easeOut",
    yoyo: true,
    hold: 170,
    onComplete: () => label.destroy(),
  });
}

function recordTap(scene: IdleRuntime): number {
  const now = scene.time.now;
  const previous = tapState.get(scene);
  const streak = previous && now - previous.lastAt <= 620 ? previous.streak + 1 : 1;
  tapState.set(scene, { lastAt: now, streak });
  return streak;
}

/**
 * 醸造量や経済ロジックには触れず、キャラタップ時の視覚フィードバックだけを強化する。
 * 連打が続くと短いBREW表示を出し、「押す→増える」の手応えを明確にする。
 */
export function installPotionPresentation(): void {
  const proto = IdleScene.prototype as unknown as object;
  const originalBrewTap = Reflect.get(proto, "onBrewTap") as
    | ((
        this: IdleScene,
        bounceTargets: Phaser.GameObjects.GameObject[],
        glow?: Phaser.GameObjects.Arc,
      ) => void)
    | undefined;
  if (!originalBrewTap) return;

  Reflect.set(proto, "onBrewTap", function (
    this: IdleScene,
    bounceTargets: Phaser.GameObjects.GameObject[],
    glow?: Phaser.GameObjects.Arc,
  ) {
    originalBrewTap.call(this, bounceTargets, glow);
    const runtime = this as unknown as IdleRuntime;
    brewBurst(runtime);
    showStreak(runtime, recordTap(runtime));
  });
}
