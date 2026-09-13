import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import {
  FACTIONS,
  FACTION_LABEL,
  deriveStats,
  dominantFaction,
  type Faction,
  type KarmaRequest,
  type KarmaState,
} from "./logic/karma";
import { loadBestStage, loadTotalEvaluation } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Phase = "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
type Runtime = Phaser.Scene & {
  phase?: Phase;
  stage?: number;
  runEvaluation?: number;
  karma?: KarmaState;
  mandate?: { label?: string; bonus?: number; threat?: number };
  currentRequest?: KarmaRequest | null;
};

type LandscapeUi = {
  root: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Container;
  karma: Phaser.GameObjects.Container;
  yearText: Phaser.GameObjects.Text;
  evaluationText: Phaser.GameObjects.Text;
  mandateText: Phaser.GameObjects.Text;
  requestFaction: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
  statsText: Phaser.GameObjects.Text;
  dominantText: Phaser.GameObjects.Text;
  factionTexts: Phaser.GameObjects.Text[];
  bars: Phaser.GameObjects.Graphics;
  acceptHint: Phaser.GameObjects.Text;
  declineHint: Phaser.GameObjects.Text;
  hero?: Phaser.GameObjects.Image;
};

const uiByScene = new WeakMap<object, LandscapeUi>();
const FACTION_COLORS: Record<Faction, number> = {
  warrior: 0x3c8ed2,
  merchant: 0xd2a232,
  outlaw: 0x54a965,
  mage: 0x9b55c8,
};
const FACTION_SHORT: Record<Faction, string> = {
  warrior: "戦士",
  merchant: "商人",
  outlaw: "荒くれ",
  mage: "魔術師",
};

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...values: unknown[]) => unknown).apply(scene, args) : undefined;
}

function text(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = "#f8f0dd", weight = "800"): Phaser.GameObjects.Text {
  const node = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
    lineSpacing: 4,
  }).setOrigin(0.5);
  root.add(node);
  return node;
}

function panel(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, fill: number, border = 0xc8a45a, alpha = 0.95, radius = 14): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x06100c, 0.28).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.07).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.14), radius * 0.7);
  g.lineStyle(1.5, border, 0.76).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function button(scene: Runtime, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, value: string, action: () => void, accent: number): void {
  const g = scene.add.graphics();
  const paint = (pressed = false) => {
    g.clear();
    const color = pressed ? Phaser.Display.Color.ValueToColor(accent).darken(12).color : accent;
    g.fillStyle(0x07110d, 0.28).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 13);
    g.fillStyle(color, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 13);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.26, 10);
    g.lineStyle(1.6, 0xf0d394, 0.68).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 13);
  };
  paint();
  root.add(g);
  text(scene, root, x, y, value, 15, "#fff7e9", "900");
  const hit = scene.add.zone(x, y, w, Math.max(52, h)).setInteractive({ useHandCursor: true });
  root.add(hit);
  hit.on("pointerdown", () => { paint(true); action(); });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
}

function world(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x3e91ca, 0x66b8dc, 0xc7e4b7, 0x88b77a, 1, 1, 1, 1).fillRect(0, 0, 800, 450);
  g.fillStyle(0x7fa9aa, 0.68).fillTriangle(0, 300, 165, 75, 330, 300);
  g.fillStyle(0x6c99a2, 0.58).fillTriangle(180, 300, 390, 85, 600, 300);
  g.fillStyle(0xf2eee0, 0.92).fillRect(470, 125, 250, 145);
  for (const x of [490, 545, 602, 660]) {
    g.fillRect(x, 78, 22, 68);
    g.fillTriangle(x - 7, 78, x + 11, 43, x + 29, 78);
  }
  g.fillStyle(0x7aa05f, 0.94).fillRect(0, 300, 800, 150);
  g.fillStyle(0x5d6555, 0.85).fillRect(0, 375, 800, 75);
  g.fillStyle(0x0b1712, 0.18).fillRect(0, 0, 800, 450);
  root.add(g);
}

function build(scene: Runtime): LandscapeUi {
  const existing = uiByScene.get(scene);
  if (existing) return existing;

  const root = scene.add.container(0, 0).setDepth(5200).setVisible(false);
  world(scene, root);
  const title = scene.add.container(0, 0);
  const karma = scene.add.container(0, 0);
  root.add([title, karma]);

  text(scene, root, 24, 25, "カルマクエスト", 27, "#ffffff", "900").setOrigin(0, 0.5).setStroke("#244b63", 5);
  text(scene, root, 26, 51, "CHOICE RPG — 選択が世界と勇者を変える", 9, "#eef8ff", "800").setOrigin(0, 0.5);

  panel(scene, title, 260, 238, 440, 300, 0x14251e, 0xc8a45a, 0.9, 20);
  if (scene.textures.exists("kq-hero-warrior")) {
    const hero = scene.add.image(145, 238, "kq-hero-warrior").setDisplaySize(190, 255);
    title.add(hero);
  }
  text(scene, title, 340, 140, "12年の選択で\n自分だけの勇者伝説をつくる", 22, "#fff5dc", "900");
  text(scene, title, 340, 225, "派閥の要望、道中の出来事、討伐の結果。\n何を選び、何を神へ報告したかで\n次の年の世界と勇者が変わる。", 13, "#dce9df", "700");
  panel(scene, title, 650, 178, 250, 155, 0xf1e7ca, 0xb68c49, 0.98, 12);
  text(scene, title, 650, 135, "LEGEND RECORD", 11, "#6b5431", "900");
  text(scene, title, 650, 178, `最高到達 ${loadBestStage()}年`, 21, "#4c493f", "900");
  text(scene, title, 650, 213, `累計評価 ${loadTotalEvaluation()}`, 13, "#76684f", "800");
  button(scene, title, 650, 310, 250, 66, "旅を始める", () => invoke(scene, "startRun"), 0x356f68);

  panel(scene, karma, 238, 246, 420, 330, 0x12231c, 0xc8a45a, 0.9, 18);
  let hero: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("kq-hero-warrior")) {
    hero = scene.add.image(150, 244, "kq-hero-warrior").setDisplaySize(205, 274);
    karma.add(hero);
  }
  const dominantText = text(scene, karma, 275, 124, "", 11, "#f2d99c", "900");
  const statsText = text(scene, karma, 292, 205, "", 13, "#eef5ee", "900");
  text(scene, karma, 292, 286, "主人公と王都", 10, "#c9d7ce", "700");

  panel(scene, karma, 590, 145, 360, 155, 0xf2e8cc, 0xb58d48, 0.985, 10);
  const requestFaction = text(scene, karma, 590, 93, "", 12, "#6c512b", "900");
  const requestText = scene.add.text(590, 156, "", {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: "13px",
    fontStyle: "700",
    color: "#433d33",
    align: "center",
    lineSpacing: 5,
    wordWrap: { width: 320, useAdvancedWrap: true },
  }).setOrigin(0.5);
  karma.add(requestText);

  panel(scene, karma, 590, 280, 360, 96, 0x11211e, 0xc2a058, 0.96, 11);
  const bars = scene.add.graphics();
  karma.add(bars);
  const factionTexts = FACTIONS.map((_, i) => text(scene, karma, 485, 250 + i * 19, "", 9, "#e8ddc7", "800").setOrigin(0, 0.5));

  button(scene, karma, 510, 385, 190, 56, "力を貸す", () => invoke(scene, "onKarmaChoice", true), 0x3377ae);
  button(scene, karma, 705, 385, 165, 56, "断る", () => invoke(scene, "onKarmaChoice", false), 0x56504a);
  const acceptHint = text(scene, karma, 510, 425, "", 9, "#d8efff", "800");
  const declineHint = text(scene, karma, 705, 425, "別の道へ", 9, "#ddd0c2", "800");

  panel(scene, karma, 650, 34, 286, 48, 0x10201a, 0xd1ad61, 0.92, 11);
  const yearText = text(scene, karma, 530, 34, "", 10, "#f5dfaa", "900").setOrigin(0, 0.5);
  const evaluationText = text(scene, karma, 770, 34, "", 10, "#f5dfaa", "900").setOrigin(1, 0.5);
  const mandateText = text(scene, karma, 400, 73, "", 9, "#fff5d8", "800");

  const ui = {
    root,
    title,
    karma,
    yearText,
    evaluationText,
    mandateText,
    requestFaction,
    requestText,
    statsText,
    dominantText,
    factionTexts,
    bars,
    acceptHint,
    declineHint,
    hero,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function targetSize(scene: Runtime, landscape: boolean, specialLandscape: boolean): void {
  const target = landscape && specialLandscape ? { width: 800, height: 450 } : { width: 450, height: 800 };
  if (scene.scale.gameSize.width !== target.width || scene.scale.gameSize.height !== target.height) scene.scale.resize(target.width, target.height);
}

function refresh(scene: Runtime): void {
  const layout = getResponsiveLayout(scene as never);
  const physicalLandscape = !!layout && !layout.isPortrait;
  const mobilePhase = scene.phase === "title" || scene.phase === "karma";
  targetSize(scene, physicalLandscape, mobilePhase);

  const ui = build(scene);
  const active = physicalLandscape && mobilePhase;
  ui.root.setVisible(active);
  if (!active) return;
  ui.title.setVisible(scene.phase === "title");
  ui.karma.setVisible(scene.phase === "karma");
  if (scene.phase !== "karma" || !scene.karma) return;

  const karma = scene.karma;
  const request = scene.currentRequest;
  const stats = deriveStats(karma);
  const dominant = dominantFaction(karma);
  const max = Math.max(10, ...FACTIONS.map((faction) => karma[faction]));
  ui.yearText.setText(`YEAR ${Math.max(1, scene.stage ?? 1)}/12`);
  ui.evaluationText.setText(`評価 ${(scene.runEvaluation ?? 0) >= 0 ? "+" : ""}${scene.runEvaluation ?? 0}`);
  ui.mandateText.setText(`神託  ${(scene.mandate?.label ?? "自由に勇者を育てよう").slice(0, 48)}`);
  ui.requestFaction.setText(request ? `【${FACTION_LABEL[request.faction]}からの依頼】` : "旅人からの依頼");
  ui.requestText.setText(request?.text ?? "次の依頼を待っています。あなたの判断が世界を動かす。");
  ui.dominantText.setText(`カルマ  ${FACTION_LABEL[dominant]}`);
  ui.statsText.setText(`ATK ${stats.atk}   DEF ${stats.def}\nHP ${stats.hp}   MAGIC ${stats.magic}`);
  ui.acceptHint.setText(request ? `${FACTION_SHORT[request.faction]} +${request.karmaDelta} / 勇者が成長` : "");

  ui.bars.clear();
  FACTIONS.forEach((faction, i) => {
    const y = 250 + i * 19;
    const ratio = Phaser.Math.Clamp(karma[faction] / max, 0, 1);
    ui.bars.fillStyle(0x59645d, 0.72).fillRoundedRect(585, y - 3, 118, 7, 4);
    ui.bars.fillStyle(FACTION_COLORS[faction], 0.98).fillRoundedRect(585, y - 3, 118 * ratio, 7, 4);
    ui.factionTexts[i]?.setText(`${FACTION_SHORT[faction]} ${karma[faction]}`);
  });

  if (ui.hero) {
    const tint = FACTION_COLORS[dominant];
    ui.hero.setTint(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(0xffffff),
      Phaser.Display.Color.IntegerToColor(tint),
      100,
      7,
    ).color);
  }
}

export function installKarmaMobileLayout(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__mobileLayoutUpdate) return;
  proto.__mobileLayoutUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
