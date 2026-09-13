import Phaser from "phaser";
import { FACTION_LABEL, dominantFaction, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  karma?: KarmaState;
};

type PolishUi = {
  root: Phaser.GameObjects.Container;
  compass: Phaser.GameObjects.Graphics;
  karmaText: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, PolishUi>();

function build(scene: Runtime): PolishUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(1801).setVisible(false);
  const deco = scene.add.graphics();

  // Sunlight, foliage and parchment corners give the code-native world more of the illustrated concept's depth.
  deco.fillStyle(0xffefb0, 0.09).fillCircle(286, 150, 118);
  deco.fillStyle(0x143c29, 0.28);
  for (const [x, y, r] of [
    [12, 112, 28],
    [36, 94, 22],
    [426, 594, 34],
    [405, 620, 24],
  ] as const) deco.fillCircle(x, y, r);
  deco.lineStyle(2, 0xd0a95b, 0.55).lineBetween(244, 111, 264, 111).lineBetween(244, 111, 244, 131);
  deco.lineBetween(410, 111, 390, 111).lineBetween(410, 111, 410, 131);
  deco.lineBetween(244, 339, 264, 339).lineBetween(244, 339, 244, 319);
  deco.lineBetween(410, 339, 390, 339).lineBetween(410, 339, 410, 319);
  root.add(deco);

  const compass = scene.add.graphics();
  root.add(compass);
  const karmaText = scene.add
    .text(337, 362, "", {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: "9px",
      fontStyle: "900",
      color: "#f4dfa8",
      align: "center",
    })
    .setOrigin(0.5);
  root.add(karmaText);

  const ui = { root, compass, karmaText };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "karma" && !!scene.karma;
  ui.root.setVisible(active);
  if (!active || !scene.karma) return;

  const dominant = dominantFaction(scene.karma);
  ui.compass.clear();
  ui.compass.fillStyle(0x0d1a17, 0.82).fillCircle(337, 362, 25);
  ui.compass.lineStyle(1.6, 0xd8b460, 0.82).strokeCircle(337, 362, 25);
  ui.compass.lineStyle(1, 0xf0d99a, 0.36).strokeCircle(337, 362, 19);
  ui.compass.fillStyle(0xe2bd66, 0.95).fillTriangle(337, 338, 331, 363, 343, 363);
  ui.compass.fillStyle(0x6ea4c9, 0.88).fillTriangle(337, 386, 331, 361, 343, 361);
  ui.compass.lineStyle(1, 0xf5e2ad, 0.62).lineBetween(312, 362, 362, 362);
  ui.karmaText.setText(`KARMA\n${FACTION_LABEL[dominant]}`).setPosition(337, 402);
}

export function installKarmaVisualPolish(): void {
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
