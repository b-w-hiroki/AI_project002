import Phaser from "phaser";
import { formatNumber, productionPerSec, type GameState } from "./logic/economy";
import { IdleScene } from "./scenes/IdleScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  state?: GameState;
  titleText?: Phaser.GameObjects.Text;
  potionText?: Phaser.GameObjects.Text;
  rateText?: Phaser.GameObjects.Text;
  essenceText?: Phaser.GameObjects.Text;
  townText?: Phaser.GameObjects.Text;
};

type WorkshopChrome = {
  root: Phaser.GameObjects.Container;
  potionsText: Phaser.GameObjects.Text;
  essenceText: Phaser.GameObjects.Text;
  repText: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, WorkshopChrome>();

function label(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#fff4dc",
  weight = "800",
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "Yu Gothic", serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
  }).setOrigin(0.5);
  root.add(t);
  return t;
}

function chip(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  textValue: string,
): Phaser.GameObjects.Text {
  const g = scene.add.graphics();
  g.fillStyle(0x251d19, 0.9).fillRoundedRect(x - w / 2, y - 18, w, 36, 12);
  g.fillStyle(0xffffff, 0.07).fillRoundedRect(x - w / 2 + 2, y - 16, w - 4, 10, 9);
  g.lineStyle(1.4, 0xd8b86d, 0.72).strokeRoundedRect(x - w / 2, y - 18, w, 36, 12);
  root.add(g);
  return label(scene, root, x, y, textValue, 12, "#fff2d0", "900");
}

function build(scene: Runtime): WorkshopChrome {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(112);
  const vignette = scene.add.graphics();
  vignette.fillStyle(0x4b2b18, 0.12).fillRect(0, 0, 800, 760);
  vignette.fillStyle(0x2a1710, 0.46).fillRect(0, 0, 800, 86);
  vignette.fillStyle(0x2a1710, 0.16).fillRect(0, 720, 800, 40);
  root.add(vignette);

  label(scene, root, 26, 31, "ポーション工房", 31, "#fff7e5", "900").setOrigin(0, 0.5).setStroke("#5f321d", 5);
  label(scene, root, 29, 61, "Potion Workshop — 放置系錬金クリッカー", 10, "#f1d9ad", "700").setOrigin(0, 0.5);

  const potionsText = chip(scene, root, 542, 30, 142, "0 potions");
  const essenceText = chip(scene, root, 672, 30, 104, "Essence 0");
  const repText = chip(scene, root, 758, 30, 70, "REP 0");

  // Ornamental separators: they make the layout read as a game screen instead of pale web cards.
  const deco = scene.add.graphics();
  deco.lineStyle(2, 0xb98a45, 0.45).lineBetween(36, 88, 764, 88);
  deco.lineStyle(1, 0xe8c982, 0.35).lineBetween(414, 144, 414, 610);
  deco.fillStyle(0xffd77e, 0.22).fillCircle(205, 454, 112);
  deco.lineStyle(2, 0xe4bd62, 0.36).strokeCircle(205, 454, 114);
  root.add(deco);

  const ui = { root, potionsText, essenceText, repText };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  if (!scene.state) return;

  // Replace the generic English header with the art-direction title bar.
  scene.titleText?.setVisible(false);
  scene.potionText?.setVisible(false);
  scene.rateText?.setVisible(false);
  scene.essenceText?.setVisible(false);

  ui.potionsText.setText(`${formatNumber(scene.state.potions)} potions`);
  ui.essenceText.setText(`Essence ${formatNumber(scene.state.essence)}`);
  ui.repText.setText(`REP ${scene.state.reputation}`);

  // Enlarge the existing hero and cauldron from the presentation layer; keep their input behavior intact.
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Image)) continue;
    if (child.texture.key === "pw-hero-alchemist") {
      child.setPosition(190, 265).setDisplaySize(330, 330);
    }
    if (child.texture.key === "pw-cauldron-icon") {
      child.setPosition(205, 450).setDisplaySize(220, 220);
    }
  }

  // A tiny live-rate cue beside the cauldron reinforces the idle-game fantasy without changing economy values.
  const rate = productionPerSec(scene.state);
  ui.root.setData("rate", rate);
}

export function installPotionConceptArtPass(): void {
  const proto = IdleScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtFidelityUpdate) return;
  proto.__conceptArtFidelityUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
