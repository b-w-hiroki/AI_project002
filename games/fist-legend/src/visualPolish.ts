import Phaser from "phaser";
import { OUGI_GAUGE_MAX } from "./logic/battle";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  battle?: {
    playerGauge: number;
  };
};

type PolishUi = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  punch: Phaser.GameObjects.Text;
  kick: Phaser.GameObjects.Text;
  ki: Phaser.GameObjects.Text;
  ougi: Phaser.GameObjects.Text;
  leftCalligraphy: Phaser.GameObjects.Text;
  rightCalligraphy: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, PolishUi>();

function build(scene: Runtime): PolishUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics();
  const make = (x: number, y: number, value: string, size: number, color = "#ffffff") =>
    scene.add
      .text(x, y, value, {
        fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
        fontSize: `${size}px`,
        fontStyle: "900",
        color,
        stroke: "#24120c",
        strokeThickness: 5,
        align: "center",
      })
      .setOrigin(0.5);

  const punch = make(240, 480, "打", 30, "#fff0e7");
  const kick = make(400, 480, "蹴", 30, "#efffeb");
  const ki = make(560, 480, "気", 30, "#eaf5ff");
  const ougi = make(400, 545, "奥義", 23, "#fff2a0");
  const leftCalligraphy = make(36, 272, "拳に宿るのは、\n仲間との絆だ。", 16, "#fff1d2")
    .setOrigin(0.5)
    .setAngle(-2)
    .setLineSpacing(8);
  const rightCalligraphy = make(764, 272, "闘う意志が、\n俺を強くする。", 16, "#e8f3ff")
    .setOrigin(0.5)
    .setAngle(2)
    .setLineSpacing(8);

  const root = scene.add
    .container(0, 0, [graphics, punch, kick, ki, ougi, leftCalligraphy, rightCalligraphy])
    .setDepth(1821)
    .setVisible(false);
  const ui = { root, graphics, punch, kick, ki, ougi, leftCalligraphy, rightCalligraphy };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "battle" && !!scene.battle;
  ui.root.setVisible(active);
  if (!active || !scene.battle) return;

  const ready = scene.battle.playerGauge >= OUGI_GAUGE_MAX;
  ui.graphics.clear();

  // Left-side virtual stick treatment from the standalone concept.
  ui.graphics.fillStyle(0x101010, 0.48).fillCircle(88, 502, 62);
  ui.graphics.lineStyle(4, 0xd5d5d5, 0.68).strokeCircle(88, 502, 62);
  ui.graphics.fillStyle(0x5d5d5d, 0.65).fillCircle(88, 502, 28);
  ui.graphics.lineStyle(2, 0xffffff, 0.35).strokeCircle(88, 502, 28);
  ui.graphics.fillStyle(0xffffff, 0.42).fillTriangle(88, 452, 80, 465, 96, 465);
  ui.graphics.fillTriangle(88, 552, 80, 539, 96, 539);
  ui.graphics.fillTriangle(38, 502, 51, 494, 51, 510);
  ui.graphics.fillTriangle(138, 502, 125, 494, 125, 510);

  // Attack buttons get a stronger embossed inner ring so they read as tappable game controls.
  [
    { x: 240, y: 480, c: 0xd7492d },
    { x: 400, y: 480, c: 0x3a8b4b },
    { x: 560, y: 480, c: 0x3376b9 },
  ].forEach(({ x, y, c }) => {
    ui.graphics.fillStyle(c, 0.12).fillCircle(x, y, 50);
    ui.graphics.lineStyle(3, 0xffffff, 0.22).strokeCircle(x, y, 40);
  });

  if (ready) {
    ui.graphics.lineStyle(10, 0xffd83d, 0.13).strokeCircle(400, 545, 84);
    ui.graphics.lineStyle(3, 0xffed83, 0.76).strokeCircle(400, 545, 76);
  }
  ui.ougi.setText(ready ? "奥義\nREADY" : "奥義").setFontSize(ready ? 17 : 23);
}

export function installFistVisualPolish(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtVisualQaUpdate) return;
  proto.__conceptArtVisualQaUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
