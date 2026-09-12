import Phaser from "phaser";
import {
  GENERATORS,
  PRESTIGE_UNLOCK,
  formatNumber,
  generatorCost,
  productionPerSec,
  type GameState,
} from "./logic/economy";
import { IdleScene } from "./scenes/IdleScene";

type IdleRuntime = Phaser.Scene & {
  state?: GameState;
  potionText?: Phaser.GameObjects.Text;
};

type TapState = {
  lastAt: number;
  streak: number;
};

interface WorkshopHud {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  rateText: Phaser.GameObjects.Text;
  goalText: Phaser.GameObjects.Text;
  prestigeText: Phaser.GameObjects.Text;
}

const tapState = new WeakMap<object, TapState>();
const hudByScene = new WeakMap<object, WorkshopHud>();
const BURST_OFFSETS = [
  { x: -34, y: -12, r: 5 },
  { x: -19, y: -31, r: 4 },
  { x: 2, y: -38, r: 6 },
  { x: 25, y: -26, r: 4 },
  { x: 36, y: -5, r: 5 },
] as const;

function ensureWorkshopHud(scene: IdleRuntime): WorkshopHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics();
  const rateText = scene.add
    .text(28, 111, "", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      fontStyle: "800",
      color: "#315f55",
    })
    .setOrigin(0, 0.5);
  const goalText = scene.add
    .text(292, 111, "", {
      fontFamily: "sans-serif",
      fontSize: "11px",
      fontStyle: "800",
      color: "#557064",
    })
    .setOrigin(1, 0.5);
  const prestigeText = scene.add
    .text(160, 132, "", {
      fontFamily: "sans-serif",
      fontSize: "10px",
      fontStyle: "800",
      color: "#7958a5",
    })
    .setOrigin(0.5);

  const root = scene.add
    .container(0, 0, [frame, rateText, goalText, prestigeText])
    .setDepth(72);
  const hud = { root, frame, rateText, goalText, prestigeText };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshWorkshopHud(scene: IdleRuntime): void {
  const state = scene.state;
  if (!state) return;
  const hud = ensureWorkshopHud(scene);
  const perSec = productionPerSec(state);
  const next = GENERATORS.reduce((best, generator) => {
    const cost = generatorCost(generator, state.counts[generator.id] ?? 0);
    if (!best || cost < best.cost) return { generator, cost };
    return best;
  }, null as { generator: (typeof GENERATORS)[number]; cost: number } | null);
  const prestigeProgress = Phaser.Math.Clamp(state.totalBrewed / PRESTIGE_UNLOCK, 0, 1);

  hud.frame.clear();
  hud.frame.fillStyle(0xffffff, 0.88);
  hud.frame.fillRoundedRect(14, 99, 292, 45, 14);
  hud.frame.lineStyle(1.5, 0x87cbb7, 0.6);
  hud.frame.strokeRoundedRect(14, 99, 292, 45, 14);
  hud.frame.fillStyle(0xdcd3ef, 0.9);
  hud.frame.fillRoundedRect(28, 137, 264, 4, 2);
  hud.frame.fillStyle(prestigeProgress >= 1 ? 0xc58cff : 0x9d5cff, 1);
  hud.frame.fillRoundedRect(28, 137, 264 * prestigeProgress, 4, 2);

  hud.rateText.setText(`PRODUCTION  +${formatNumber(perSec)}/s  ·  REP ${state.reputation}`);
  hud.goalText.setText(next ? `NEXT  ${next.generator.name} ${formatNumber(next.cost)}` : "NEXT  ALL BUILT");
  hud.prestigeText.setText(
    prestigeProgress >= 1 ? "PRESTIGE READY" : `PRESTIGE ${Math.floor(prestigeProgress * 100)}%`,
  );
  hud.prestigeText.setColor(prestigeProgress >= 1 ? "#8a35c9" : "#7958a5");
}

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
  const proto = IdleScene.prototype as unknown as Record<string, unknown>;
  const originalBrewTap = Reflect.get(proto, "onBrewTap") as
    | ((
        this: IdleScene,
        bounceTargets: Phaser.GameObjects.GameObject[],
        glow?: Phaser.GameObjects.Arc,
      ) => void)
    | undefined;
  if (originalBrewTap && !Reflect.get(proto, "__hudPassBrewTap")) {
    Reflect.set(proto, "__hudPassBrewTap", originalBrewTap);
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

  const originalUpdate = Reflect.get(proto, "update") as
    | ((this: IdleScene, time: number, delta: number) => void)
    | undefined;
  if (!Reflect.get(proto, "__hudPassUpdate")) {
    Reflect.set(proto, "__hudPassUpdate", originalUpdate ?? (() => undefined));
    Reflect.set(proto, "update", function (this: IdleScene, time: number, delta: number) {
      originalUpdate?.call(this, time, delta);
      refreshWorkshopHud(this as unknown as IdleRuntime);
    });
  }
}
