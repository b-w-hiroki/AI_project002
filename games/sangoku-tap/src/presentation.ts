import Phaser from "phaser";
import { ExpeditionScene } from "./scenes/ExpeditionScene";

type ExpeditionRuntime = Phaser.Scene & {
  run: { step: number; status: string } | null;
};

function destroyAll(targets: Phaser.GameObjects.GameObject[]): void {
  for (const target of targets) target.destroy();
}

function playBossIntro(scene: ExpeditionRuntime): void {
  const topBar = scene.add
    .rectangle(225, 88, 450, 24, 0x090a0d, 0)
    .setScrollFactor(0)
    .setDepth(180);
  const bottomBar = scene.add
    .rectangle(225, 532, 450, 24, 0x090a0d, 0)
    .setScrollFactor(0)
    .setDepth(180);
  const label = scene.add
    .text(225, 88, "決　戦", {
      fontFamily: "serif",
      fontSize: "14px",
      fontStyle: "700",
      color: "#f5d6a0",
      letterSpacing: 5,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(181)
    .setAlpha(0);
  const flare = scene.add
    .rectangle(225, 316, 520, 3, 0xf3c27d, 0.9)
    .setRotation(-0.18)
    .setScrollFactor(0)
    .setDepth(182)
    .setScale(0.15, 1);

  scene.tweens.add({ targets: [topBar, bottomBar], alpha: 0.88, duration: 120 });
  scene.tweens.add({
    targets: flare,
    scaleX: 1,
    alpha: 0,
    duration: 430,
    ease: "Cubic.easeOut",
    onComplete: () => flare.destroy(),
  });
  scene.tweens.add({
    targets: label,
    alpha: 1,
    duration: 160,
    yoyo: true,
    hold: 500,
  });
  scene.time.delayedCall(880, () => {
    scene.tweens.add({
      targets: [topBar, bottomBar],
      alpha: 0,
      duration: 220,
      onComplete: () => destroyAll([topBar, bottomBar, label]),
    });
  });
}

function playBossResolution(scene: ExpeditionRuntime, cleared: boolean): void {
  const color = cleared ? 0xffd98a : 0xd8685b;
  const slash = scene.add
    .rectangle(225, 316, 560, cleared ? 7 : 4, color, 0.95)
    .setRotation(cleared ? -0.35 : 0.24)
    .setScrollFactor(0)
    .setDepth(220)
    .setScale(0.08, 1);
  const label = scene.add
    .text(225, 270, cleared ? "関 門 突 破" : "敗　走", {
      fontFamily: "serif",
      fontSize: cleared ? "28px" : "24px",
      fontStyle: "700",
      color: cleared ? "#fff0c5" : "#ffd0c8",
      stroke: "#24140f",
      strokeThickness: 6,
      letterSpacing: 3,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(221)
    .setAlpha(0);

  scene.cameras.main.shake(cleared ? 190 : 120, cleared ? 0.005 : 0.003);
  scene.tweens.add({
    targets: slash,
    scaleX: 1,
    duration: 110,
    ease: "Cubic.easeOut",
  });
  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: { from: 1.18, to: 1 },
    duration: 180,
    ease: "Back.easeOut",
  });
  scene.time.delayedCall(620, () => {
    scene.tweens.add({
      targets: [slash, label],
      alpha: 0,
      duration: 220,
      onComplete: () => destroyAll([slash, label]),
    });
  });
}

/**
 * 既存の遠征ロジックを変えず、関門戦の「登場」と「決着」だけを映画的に強調する。
 * private メソッドへのラップは演出レイヤーに閉じ込め、ゲーム本体の差分を小さく保つ。
 */
export function installSangokuPresentation(): void {
  const proto = ExpeditionScene.prototype as unknown as object;
  const originalEntrance = Reflect.get(proto, "bossEntrance") as
    | ((this: ExpeditionScene) => void)
    | undefined;
  const originalAdvance = Reflect.get(proto, "advance") as
    | ((this: ExpeditionScene) => void)
    | undefined;

  if (originalEntrance) {
    Reflect.set(proto, "bossEntrance", function (this: ExpeditionScene) {
      originalEntrance.call(this);
      playBossIntro(this as unknown as ExpeditionRuntime);
    });
  }

  if (originalAdvance) {
    Reflect.set(proto, "advance", function (this: ExpeditionScene) {
      const runtime = this as unknown as ExpeditionRuntime;
      const wasBoss = runtime.run?.step === 9;
      originalAdvance.call(this);
      if (wasBoss && runtime.run) {
        sceneResolution(runtime);
      }
    });
  }
}

function sceneResolution(scene: ExpeditionRuntime): void {
  const cleared = scene.run?.status === "clear";
  scene.time.delayedCall(120, () => playBossResolution(scene, cleared));
}
