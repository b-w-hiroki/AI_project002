import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

function showReadWin(scene: Phaser.Scene): void {
  const flash = scene.add.graphics().setDepth(2000).setAlpha(0.9);
  flash.fillStyle(0xffd36a, 0.16);
  flash.fillRect(0, 0, 800, 600);

  const slash = scene.add.graphics().setDepth(2001);
  slash.lineStyle(9, 0xfff2c2, 0.95);
  slash.lineBetween(185, 420, 620, 120);
  slash.lineStyle(3, 0xd99c2b, 0.95);
  slash.lineBetween(205, 438, 640, 138);

  const label = scene.add
    .text(400, 154, "読み勝ち！", {
      fontSize: "44px",
      fontStyle: "900",
      color: "#fff4ce",
      stroke: "#5e3515",
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(2002)
    .setScale(0.78);
  const sub = scene.add
    .text(400, 202, "相手の癖を捉えた", {
      fontSize: "17px",
      fontStyle: "700",
      color: "#ffd36a",
      stroke: "#26150a",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(2002);

  scene.cameras.main.shake(85, 0.004);
  scene.tweens.add({
    targets: label,
    scale: 1.08,
    duration: 120,
    ease: "Back.Out",
    yoyo: true,
  });
  scene.tweens.add({
    targets: [flash, slash, label, sub],
    alpha: 0,
    duration: 360,
    delay: 230,
    ease: "Sine.easeIn",
    onComplete: () => {
      flash.destroy();
      slash.destroy();
      label.destroy();
      sub.destroy();
    },
  });
}

function showReadLoss(scene: Phaser.Scene): void {
  const warning = scene.add.graphics().setDepth(1999).setAlpha(0.85);
  warning.lineStyle(8, 0xb63a32, 0.72);
  warning.strokeRect(6, 6, 788, 588);
  const label = scene.add
    .text(400, 150, "読まれた…", {
      fontSize: "28px",
      fontStyle: "800",
      color: "#ffb8aa",
      stroke: "#32110e",
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(2000);
  scene.cameras.main.shake(110, 0.006);
  scene.tweens.add({
    targets: [warning, label],
    alpha: 0,
    duration: 300,
    delay: 140,
    onComplete: () => {
      warning.destroy();
      label.destroy();
    },
  });
}

/**
 * 勝敗計算には触れず、既存の showClash() の結果だけを使って
 * 「読み勝った / 読まれた」の瞬間を強調するプレゼンテーション層。
 */
export function installFistLegendPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const original = proto.showClash;
  if (!original || proto.__momentPassShowClash) return;

  proto.__momentPassShowClash = original;
  proto.showClash = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original.apply(this, args);
    const clash = args[0];
    if (clash === "advantage") showReadWin(this);
    if (clash === "disadvantage") showReadLoss(this);
    return result;
  };
}
