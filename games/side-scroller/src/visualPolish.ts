import Phaser from "phaser";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  status?: string;
  wave?: number;
  waveEnemiesAlive?: number;
  playerState?: PlayerState;
};

type PolishUi = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  attackText: Phaser.GameObjects.Text;
  skillText: Phaser.GameObjects.Text;
  jumpText: Phaser.GameObjects.Text;
  ougiText: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, PolishUi>();

function build(scene: Runtime): PolishUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics().setScrollFactor(0);
  const make = (x: number, y: number, value: string, size: number) =>
    scene.add
      .text(x, y, value, {
        fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
        fontSize: `${size}px`,
        fontStyle: "900",
        color: "#ffffff",
        stroke: "#20334a",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  const attackText = make(570, 530, "斬", 18);
  const skillText = make(663, 525, "技", 18);
  const jumpText = make(744, 445, "跳", 15);
  const ougiText = make(744, 535, "奥", 15);
  const root = scene.add
    .container(0, 0, [graphics, attackText, skillText, jumpText, ougiText])
    .setDepth(1781)
    .setScrollFactor(0)
    .setVisible(false);
  const ui = { root, graphics, attackText, skillText, jumpText, ougiText };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.status === "playing";
  ui.root.setVisible(active);
  if (!active) return;

  const wave = scene.wave ?? 1;
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? 0);
  const combo = scene.playerState?.comboStreak ?? 0;
  const ougi = scene.playerState?.ougiGauge ?? 0;
  const ready = ougi >= OUGI_GAUGE_MAX;

  ui.graphics.clear();
  // Thin cinematic edge treatment and mission stars keep the center readable.
  ui.graphics.fillStyle(0x0c2030, 0.2).fillRect(0, 0, 800, 26);
  ui.graphics.fillStyle(0x0b1c29, 0.12).fillRect(0, 575, 800, 25);
  [0, 1, 2].forEach((i) => {
    const met = i === 0 ? remaining === 0 : i === 1 ? combo >= 10 : ready;
    ui.graphics.fillStyle(met ? 0xffd35f : 0xffffff, met ? 0.95 : 0.38).fillCircle(633 + i * 30, 80, 5);
  });

  if (combo >= 10) {
    ui.graphics.lineStyle(3, 0xffef8b, 0.24).lineBetween(20, 180, 186, 122);
    ui.graphics.lineStyle(2, 0x7bdcff, 0.22).lineBetween(24, 194, 210, 134);
  }

  if (ready) {
    ui.graphics.lineStyle(7, 0xffdf61, 0.18).strokeCircle(744, 535, 47);
    ui.graphics.lineStyle(2, 0xffef9e, 0.75).strokeCircle(744, 535, 42);
  }

  ui.attackText.setText("斬");
  ui.skillText.setText("技");
  ui.jumpText.setText("跳");
  ui.ougiText.setText(ready ? "奥義" : "奥").setFontSize(ready ? 13 : 15);
  ui.root.setData("wave", wave);
}

export function installSideVisualPolish(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const original = proto.updateEnemies;
  if (!original || proto.__conceptArtVisualQaEnemies) return;
  proto.__conceptArtVisualQaEnemies = original;
  proto.updateEnemies = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
