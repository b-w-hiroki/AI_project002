import Phaser from "phaser";
import { productionPerSec, type GameState } from "./logic/economy";
import { IdleScene } from "./scenes/IdleScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & { state?: GameState };

type ArtLayer = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  familiar?: Phaser.GameObjects.Image;
  rateText: Phaser.GameObjects.Text;
};

const layers = new WeakMap<object, ArtLayer>();

function make(scene: Runtime): ArtLayer {
  const old = layers.get(scene);
  if (old) return old;

  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setDepth(5590).setScrollFactor(0);
  let familiar: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("pw-dragon-icon")) {
    familiar = scene.add.image(0, 0, "pw-dragon-icon").setScrollFactor(0).setAlpha(0.96);
    root.add(familiar);
  }
  const rateText = scene.add.text(0, 0, "", {
    fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
    fontSize: "11px",
    fontStyle: "800",
    color: "#d8ffe9",
    stroke: "#254735",
    strokeThickness: 3,
  }).setOrigin(0.5).setScrollFactor(0);
  root.add(rateText);

  const layer = { root, graphics, familiar, rateText };
  layers.set(scene, layer);
  return layer;
}

function refresh(scene: Runtime): void {
  const state = scene.state;
  if (!state) return;
  const ui = make(scene);
  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  ui.root.setVisible(width <= 820 && height <= 820);
  if (!ui.root.visible) return;

  const g = ui.graphics;
  g.clear();

  // 木枠と光源を足し、カード群を「Webパネル」ではなく工房の棚・掲示板に見せる。
  g.fillStyle(0x25140d, 0.18).fillRect(0, 0, width, height);
  g.lineStyle(3, 0x6f4227, 0.7);
  if (portrait) {
    g.lineBetween(12, 76, 438, 76);
    g.lineBetween(12, 505, 438, 505);
    g.lineBetween(12, 690, 438, 690);
  } else {
    g.lineBetween(12, 72, 788, 72);
    g.lineBetween(392, 84, 392, 390);
    g.lineBetween(14, 410, 786, 410);
  }

  const brewX = portrait ? 225 : 335;
  const brewY = portrait ? 365 : 246;
  const pulse = 1 + Math.sin(scene.time.now / 430) * 0.06;
  g.fillStyle(0x67ffb0, 0.07).fillCircle(brewX, brewY, (portrait ? 118 : 124) * pulse);
  g.lineStyle(2, 0xb8ffd7, 0.24).strokeCircle(brewX, brewY, (portrait ? 106 : 112) * pulse);
  g.lineStyle(1, 0x78e9ff, 0.22).strokeCircle(brewX, brewY, (portrait ? 91 : 98) / pulse);

  // 調合の泡と火花。固定UIの上に乗せず、釜周りだけへ限定。
  const bubbles = portrait
    ? [[184, 316, 5], [254, 304, 4], [279, 342, 3], [168, 357, 3], [244, 286, 2]]
    : [[296, 205, 5], [360, 188, 4], [382, 225, 3], [282, 240, 3], [349, 174, 2]];
  bubbles.forEach(([x, y, r], index) => {
    const bob = Math.sin(scene.time.now / 360 + index) * 5;
    g.fillStyle(index % 2 ? 0x7ce8ff : 0x9affc5, 0.48).fillCircle(x, y + bob, r);
    g.lineStyle(1, 0xffffff, 0.5).strokeCircle(x, y + bob, r);
  });

  // 左右の小瓶シルエットで工房感を足す。
  const shelfY = portrait ? 492 : 387;
  const shelfXs = portrait ? [34, 57, 80, 370, 393, 416] : [36, 62, 88, 320, 346, 372];
  shelfXs.forEach((x, index) => {
    const colors = [0xe85b6d, 0x5ba8ff, 0x65df8b, 0xc074f2, 0xffc95b, 0x58d8d4];
    const c = colors[index % colors.length]!;
    g.fillStyle(0x2e1d18, 0.72).fillRoundedRect(x - 8, shelfY - 17, 16, 24, 5);
    g.fillStyle(c, 0.76).fillRoundedRect(x - 6, shelfY - 11, 12, 16, 4);
    g.fillStyle(0xf8e9ca, 0.8).fillRect(x - 3, shelfY - 21, 6, 6);
  });

  // 使い魔を画面内へ常駐させ、キャラクター性を増やす。
  if (ui.familiar) {
    if (portrait) ui.familiar.setPosition(370, 318).setDisplaySize(74, 74);
    else ui.familiar.setPosition(314, 142).setDisplaySize(66, 66);
  }

  const rate = productionPerSec(state);
  ui.rateText
    .setPosition(brewX, portrait ? 484 : 374)
    .setText(`MAGIC FLOW  +${Math.floor(rate * 10) / 10}/sec`);

  // 評判が上がるほど工房に金色のきらめきを増やす。
  const sparkleCount = Math.min(8, 2 + Math.floor(state.reputation / 2));
  for (let i = 0; i < sparkleCount; i++) {
    const x = portrait ? 38 + ((i * 71) % 374) : 26 + ((i * 101) % 740);
    const y = portrait ? 104 + ((i * 53) % 350) : 88 + ((i * 47) % 275);
    const a = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(scene.time.now / 520 + i));
    g.fillStyle(0xffdf8a, a).fillCircle(x, y, i % 3 === 0 ? 2.4 : 1.5);
  }
}

export function installPotionArtFidelity(): void {
  const proto = IdleScene.prototype as unknown as MethodTable;
  const original = proto.update;
  if (proto.__artFidelityUpdate) return;
  proto.__artFidelityUpdate = original ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
