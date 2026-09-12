import Phaser from "phaser";
import {
  FACTIONS,
  FACTION_LABEL,
  deriveStats,
  dominantFaction,
  type Faction,
  type KarmaRequest,
  type KarmaState,
} from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  stage?: number;
  runEvaluation?: number;
  karma?: KarmaState;
  mandate?: { label?: string; bonus?: number; threat?: number };
  currentRequest?: KarmaRequest | null;
};

type KarmaUi = {
  root: Phaser.GameObjects.Container;
  yearText: Phaser.GameObjects.Text;
  evalText: Phaser.GameObjects.Text;
  mandateText: Phaser.GameObjects.Text;
  requestTitle: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
  statsText: Phaser.GameObjects.Text;
  dominantText: Phaser.GameObjects.Text;
  factionTexts: Phaser.GameObjects.Text[];
  bars: Phaser.GameObjects.Graphics;
  acceptHint: Phaser.GameObjects.Text;
  declineHint: Phaser.GameObjects.Text;
  hero?: Phaser.GameObjects.Image;
};

const uiByScene = new WeakMap<object, KarmaUi>();
const FACTION_COLORS: Readonly<Record<Faction, number>> = {
  warrior: 0x3c8ed2,
  merchant: 0xd2a232,
  outlaw: 0x54a965,
  mage: 0x9b55c8,
};
const FACTION_SHORT: Readonly<Record<Faction, string>> = {
  warrior: "戦士",
  merchant: "商人",
  outlaw: "荒くれ",
  mage: "魔術師",
};

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...v: unknown[]) => unknown).apply(scene, args) : undefined;
}

function label(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#f8f0dd",
  weight = "700",
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
    lineSpacing: 4,
  }).setOrigin(0.5);
  root.add(t);
  return t;
}

function panel(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border: number,
  alpha = 0.96,
  radius = 14,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x07100d, 0.28).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.08).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(5, h * 0.13), radius * 0.72);
  g.lineStyle(1.4, border, 0.76).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function button(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  textValue: string,
  onClick: () => void,
  accent: number,
): Phaser.GameObjects.Text {
  const bg = scene.add.graphics();
  const paint = (down = false) => {
    bg.clear();
    const c = down ? Phaser.Display.Color.ValueToColor(accent).darken(14).color : accent;
    bg.fillStyle(0x09110f, 0.25).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 12);
    bg.fillStyle(c, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    bg.fillStyle(0xffffff, 0.12).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.28, 9);
    bg.lineStyle(1.5, 0xf1d493, 0.68).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  };
  paint();
  root.add(bg);
  const txt = label(scene, root, x, y, textValue, 13, "#fff7e9", "900");
  const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  root.add(hit);
  hit.on("pointerdown", () => { paint(true); onClick(); });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
  return txt;
}

function drawWorld(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x3d8ec8, 0x63b7dc, 0xc7e4b7, 0x88b77a, 1, 1, 1, 1).fillRect(0, 0, 450, 800);
  // Distant mountains.
  g.fillStyle(0x7fa9aa, 0.75).fillTriangle(0, 405, 115, 155, 232, 405);
  g.fillStyle(0x6d9aa2, 0.68).fillTriangle(140, 405, 285, 190, 430, 405);
  g.fillStyle(0xa8c8c2, 0.72).fillTriangle(310, 405, 395, 230, 470, 405);
  // Kingdom on the right skyline.
  g.fillStyle(0xf2eee0, 0.93).fillRect(250, 215, 160, 130);
  for (const x of [265, 305, 345, 385]) {
    g.fillRect(x, 165, 18, 72);
    g.fillTriangle(x - 6, 165, x + 9, 132, x + 24, 165);
  }
  g.fillStyle(0xc9d8df, 0.75).fillRect(224, 342, 190, 22);
  // River and foreground terrace.
  g.fillStyle(0x8bd3dd, 0.62).fillTriangle(245, 355, 345, 355, 240, 690);
  g.fillStyle(0x7aa05f, 0.92).fillRect(0, 560, 450, 240);
  g.fillStyle(0x5c7e4e, 0.82).fillCircle(40, 585, 100).fillCircle(170, 600, 115).fillCircle(405, 570, 100);
  g.fillStyle(0x5d6555, 1).fillRect(0, 620, 450, 180);
  g.fillStyle(0x83806e, 1).fillRect(0, 620, 450, 22);
  // Soft vignette.
  g.fillStyle(0x0b1712, 0.18).fillRect(0, 0, 450, 800);
  root.add(g);
}

function build(scene: Runtime): KarmaUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(1800).setVisible(false);
  drawWorld(scene, root);

  label(scene, root, 18, 32, "カルマクエスト", 31, "#ffffff", "900").setOrigin(0, 0.5).setStroke("#244b63", 5);
  label(scene, root, 20, 64, "Karma Quest — 勇者育成 × 派閥シミュレーション", 9, "#ecf8ff", "800").setOrigin(0, 0.5);
  label(scene, root, 22, 96, "この選択が、君の運命をつくる。", 13, "#fff5d8", "800").setOrigin(0, 0.5);

  panel(scene, root, 35, 332, 56, 330, 0x17201d, 0xd5b36f, 0.95, 12);
  ["クエスト", "仲間", "持ち物", "図鑑", "情勢"].forEach((item, i) => {
    const y = 220 + i * 62;
    if (i === 0) {
      const hi = scene.add.graphics();
      hi.fillStyle(0xa17d34, 0.78).fillRoundedRect(10, y - 24, 50, 48, 8);
      hi.lineStyle(1, 0xf2d38a, 0.7).strokeRoundedRect(10, y - 24, 50, 48, 8);
      root.add(hi);
    }
    label(scene, root, 35, y, item, 10, i === 0 ? "#fff3d2" : "#d9cab0", i === 0 ? "900" : "700");
  });

  panel(scene, root, 276, 36, 322, 44, 0x10201a, 0xd1ad61, 0.92, 11);
  const yearText = label(scene, root, 138, 36, "", 10, "#f5dfaa", "900").setOrigin(0, 0.5);
  const evalText = label(scene, root, 414, 36, "", 10, "#f5dfaa", "900").setOrigin(1, 0.5);
  const mandateText = label(scene, root, 276, 55, "", 8, "#cfe1d5", "700");

  // Hero is the visual anchor on the left.
  let hero: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("kq-hero-warrior")) {
    hero = scene.add.image(145, 410, "kq-hero-warrior").setDisplaySize(245, 327);
    root.add(hero);
  }
  panel(scene, root, 139, 548, 192, 78, 0x14251e, 0xc7a758, 0.88, 12);
  const dominantText = label(scene, root, 139, 526, "", 10, "#f5dfaa", "900");
  const statsText = label(scene, root, 139, 557, "", 11, "#edf5ee", "900");

  // Story parchment.
  panel(scene, root, 337, 225, 200, 246, 0xf2e8cc, 0xb58d48, 0.985, 8);
  const requestTitle = label(scene, root, 337, 132, "", 12, "#5d4525", "900");
  const requestText = scene.add.text(337, 206, "", {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: "12px",
    fontStyle: "700",
    color: "#433d33",
    align: "center",
    lineSpacing: 6,
    wordWrap: { width: 166, useAdvancedWrap: true },
  }).setOrigin(0.5);
  root.add(requestText);
  label(scene, root, 337, 304, "人の想いが、世界を動かす。", 8, "#806e50", "700");

  // Karma / faction evaluation panel.
  panel(scene, root, 337, 438, 200, 168, 0x11211e, 0xc2a058, 0.96, 10);
  label(scene, root, 337, 374, "勢力の評価", 12, "#f7e7bd", "900");
  const bars = scene.add.graphics();
  root.add(bars);
  const factionTexts = FACTIONS.map((_, i) => label(scene, root, 273, 405 + i * 30, "", 9, "#e8ddc7", "800").setOrigin(0, 0.5));

  // Bottom dialogue and choices.
  panel(scene, root, 225, 679, 414, 216, 0x111b18, 0xd1ac62, 0.97, 15);
  label(scene, root, 35, 601, "旅の老人", 10, "#f2d99c", "900").setOrigin(0, 0.5);
  label(scene, root, 225, 625, "この選択が、次の一年を変える。", 11, "#eee4cd", "800");
  const acceptText = button(scene, root, 225, 674, 352, 48, "力を貸す", () => invoke(scene, "onKarmaChoice", true), 0x2f6fa8);
  const declineText = button(scene, root, 225, 735, 352, 48, "断る", () => invoke(scene, "onKarmaChoice", false), 0x4f4a45);
  const acceptHint = label(scene, root, 225, 703, "", 8, "#b9d9ef", "800");
  const declineHint = label(scene, root, 225, 764, "", 8, "#d9cec2", "800");
  acceptText.setDepth(2);
  declineText.setDepth(2);

  const ui = { root, yearText, evalText, mandateText, requestTitle, requestText, statsText, dominantText, factionTexts, bars, acceptHint, declineHint, hero };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "karma" && !!scene.karma;
  ui.root.setVisible(active);
  if (!active || !scene.karma) return;

  const karma = scene.karma;
  const request = scene.currentRequest;
  const stats = deriveStats(karma);
  const dominant = dominantFaction(karma);
  const max = Math.max(10, ...FACTIONS.map((f) => karma[f]));
  const stage = Phaser.Math.Clamp(scene.stage ?? 1, 1, 12);
  const evaluation = scene.runEvaluation ?? 0;
  const mandate = scene.mandate?.label ?? "神託を待つ";

  ui.yearText.setText(`YEAR ${stage}/12  ·  春`);
  ui.evalText.setText(`評価 ${evaluation >= 0 ? "+" : ""}${evaluation}`);
  ui.mandateText.setText(`神託  ${mandate.length > 30 ? `${mandate.slice(0, 30)}…` : mandate}`);
  ui.requestTitle.setText(request ? `【${FACTION_LABEL[request.faction]}】` : "旅人からの依頼");
  ui.requestText.setText(request?.text ?? "次の依頼を待っています。\nあなたの判断が世界を動かす。\nどうする？");
  ui.dominantText.setText(`カルマ  ${FACTION_LABEL[dominant]}`);
  ui.statsText.setText(`ATK ${stats.atk}   DEF ${stats.def}\nHP ${stats.hp}   MAGIC ${stats.magic}`);
  ui.acceptHint.setText(request ? `${FACTION_SHORT[request.faction]} +${request.karmaDelta}  /  勇者が成長` : "");
  ui.declineHint.setText(request ? "他派閥 +1  /  別の物語へ" : "");

  ui.bars.clear();
  FACTIONS.forEach((faction, i) => {
    const y = 405 + i * 30;
    const ratio = Phaser.Math.Clamp(karma[faction] / max, 0, 1);
    ui.bars.fillStyle(0x59645d, 0.7).fillRoundedRect(326, y - 4, 78, 8, 4);
    ui.bars.fillStyle(FACTION_COLORS[faction], 0.96).fillRoundedRect(326, y - 4, 78 * ratio, 8, 4);
    ui.factionTexts[i]?.setText(`${FACTION_SHORT[faction]}  ${karma[faction]}`);
  });

  if (ui.hero) {
    const tint = FACTION_COLORS[dominant];
    ui.hero.setTint(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(0xffffff),
      Phaser.Display.Color.IntegerToColor(tint),
      100,
      8,
    ).color);
  }
}

export function installKarmaConceptArtPass(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtFidelityUpdate) return;
  proto.__conceptArtFidelityUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
