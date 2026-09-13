import Phaser from "phaser";
import { FACTIONS, dominantFaction, type Faction, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  karma?: KarmaState;
  stage?: number;
};

type Layer = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  icons: Map<Faction, Phaser.GameObjects.Image>;
};

const layers = new WeakMap<object, Layer>();
const COLORS: Readonly<Record<Faction, number>> = {
  warrior: 0x4ca5ff,
  merchant: 0xf2b941,
  outlaw: 0x58c878,
  mage: 0xb16bea,
};
const TEXTURES: Readonly<Record<Faction, string>> = {
  warrior: "kq-faction-icon-warrior",
  merchant: "kq-faction-icon-merchant",
  outlaw: "kq-faction-icon-outlaw",
  mage: "kq-faction-icon-mage",
};

function build(scene: Runtime): Layer {
  const cached = layers.get(scene);
  if (cached) return cached;
  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setDepth(2790).setScrollFactor(0).setVisible(false);
  const icons = new Map<Faction, Phaser.GameObjects.Image>();
  for (const faction of FACTIONS) {
    const key = TEXTURES[faction];
    if (!scene.textures.exists(key)) continue;
    const image = scene.add.image(0, 0, key).setScrollFactor(0);
    icons.set(faction, image);
    root.add(image);
  }
  const layer = { root, graphics, icons };
  layers.set(scene, layer);
  return layer;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "karma" && !!scene.karma;
  ui.root.setVisible(active);
  if (!active || !scene.karma) return;

  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  const karma = scene.karma;
  const dominant = dominantFaction(karma);
  const dominantColor = COLORS[dominant];
  const max = Math.max(1, ...FACTIONS.map((faction) => karma[faction]));
  const g = ui.graphics;
  g.clear();

  // 主人公の背後に派閥色の光を置く。選択結果がキャラの見た目へ即座に返る。
  const hero = portrait ? { x: 145, y: 405, r: 122 } : { x: 162, y: 262, r: 118 };
  const pulse = 1 + Math.sin(scene.time.now / 560) * 0.035;
  g.fillStyle(dominantColor, 0.075).fillCircle(hero.x, hero.y, hero.r * pulse);
  g.lineStyle(2, dominantColor, 0.3).strokeCircle(hero.x, hero.y, (hero.r - 8) * pulse);

  // 王都の旗を画面左右へ置き、背景とUIの間に世界の所属感を足す。
  const bannerY = portrait ? 150 : 84;
  const bannerXs = portrait ? [72, 396] : [82, 718];
  bannerXs.forEach((x, index) => {
    g.fillStyle(0x163f76, 0.8).fillRoundedRect(x - 15, bannerY, 30, portrait ? 92 : 68, 3);
    g.fillStyle(0xd7b75d, 0.86).fillTriangle(x - 15, bannerY + (portrait ? 92 : 68), x + 15, bannerY + (portrait ? 92 : 68), x, bannerY + (portrait ? 108 : 82));
    g.lineStyle(2, 0xe4c86e, 0.72).lineBetween(x, bannerY - 18, x, bannerY + (portrait ? 102 : 76));
    // 紋章の簡易十字。左右を反転させず同じ王国旗として扱う。
    g.lineStyle(3, 0xf3d477, 0.82).lineBetween(x - 8, bannerY + 31, x + 8, bannerY + 31).lineBetween(x, bannerY + 20, x, bannerY + 43);
    if (index === 1) g.fillStyle(0xffffff, 0.08).fillCircle(x, bannerY + 34, 21);
  });

  // 選択肢に向かう運命の光。青/赤の2本が主人公から分岐する。
  if (portrait) {
    g.lineStyle(3, 0x5eb7ff, 0.2).beginPath().moveTo(175, 565).lineTo(225, 655).strokePath();
    g.lineStyle(3, 0xd85c54, 0.18).beginPath().moveTo(175, 565).lineTo(225, 725).strokePath();
  } else {
    g.lineStyle(3, 0x5eb7ff, 0.2).beginPath().moveTo(250, 292).lineTo(510, 340).strokePath();
    g.lineStyle(3, 0xd85c54, 0.18).beginPath().moveTo(250, 292).lineTo(670, 340).strokePath();
  }

  // 季節と時間を感じる葉/光粒子。固定位置に時間変化だけを与え、UIを邪魔しない。
  const particles = portrait
    ? [[45, 118], [102, 178], [197, 128], [239, 184], [382, 126], [405, 336], [69, 518], [188, 578]]
    : [[52, 92], [154, 117], [275, 82], [382, 126], [518, 96], [742, 135], [322, 370], [585, 385]];
  particles.forEach(([x, y], index) => {
    const drift = Math.sin(scene.time.now / 700 + index * 0.8) * 5;
    const color = index % 3 === 0 ? 0xf6d57a : 0xd8efba;
    g.fillStyle(color, 0.26).fillEllipse(x + drift, y + drift * 0.35, index % 2 ? 4 : 6, index % 2 ? 2 : 3);
  });

  // 派閥アイコンは実データの強さに応じてサイズ/明度を変える。
  FACTIONS.forEach((faction, index) => {
    const icon = ui.icons.get(faction);
    if (!icon) return;
    const ratio = Math.max(0.18, karma[faction] / max);
    if (portrait) {
      icon.setPosition(265, 405 + index * 30).setDisplaySize(22 + ratio * 5, 22 + ratio * 5);
    } else {
      icon.setPosition(668, 172 + index * 52).setDisplaySize(32 + ratio * 8, 32 + ratio * 8);
    }
    icon.setAlpha(faction === dominant ? 1 : 0.55 + ratio * 0.25);
    if (faction === dominant) {
      const x = icon.x;
      const y = icon.y;
      g.lineStyle(2, COLORS[faction], 0.72).strokeCircle(x, y, portrait ? 17 : 24);
    }
  });

  // 12年の物語進行を下端の小さな刻みとして常時見せる。
  const stage = Phaser.Math.Clamp(scene.stage ?? 1, 1, 12);
  const baseY = portrait ? 790 : 438;
  const startX = portrait ? 104 : 300;
  const gap = portrait ? 21 : 24;
  for (let i = 0; i < 12; i++) {
    g.fillStyle(i < stage ? 0xe7c568 : 0x5a594f, i < stage ? 0.9 : 0.45).fillCircle(startX + i * gap, baseY, i === stage - 1 ? 4 : 2.4);
  }
}

export function installKarmaArtFidelity(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const original = proto.update;
  if (proto.__artFidelityUpdate) return;
  proto.__artFidelityUpdate = original ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
