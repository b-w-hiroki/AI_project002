import Phaser from "phaser";
import { FACTION_LABEL, type KarmaRequest, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  stage?: number;
  karma?: KarmaState;
  currentRequest?: KarmaRequest | null;
  reactionUntil?: number;
  lastAccepted?: boolean;
};
type MockUi = {
  titleRoot: Phaser.GameObjects.Container;
  choiceRoot: Phaser.GameObjects.Container;
  reactionRoot: Phaser.GameObjects.Container;
  finalRoot: Phaser.GameObjects.Container;
  yearText: Phaser.GameObjects.Text;
  requestTitle: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
};

const BG_KEY = "kq-bg-kingdom-portrait-v2";
const HERO_BACK_KEY = "kq-hero-warrior-back";
const ELDER_KEY = "kq-npc-elder";
const REACTION_BG_KEY = "kq-bg-village-reaction";
const uiByScene = new WeakMap<object, MockUi>();

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...v: unknown[]) => unknown).apply(scene, args) : undefined;
}

function text(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = "#fff8e8", weight = "700", width?: number): Phaser.GameObjects.Text {
  const darkText = color === "#35281e" || color === "#352f29" || color === "#3c2a1e" || color === "#43382e";
  const object = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif', fontSize: `${size}px`, fontStyle: weight,
    color, align: "center", lineSpacing: 5, wordWrap: width ? { width, useAdvancedWrap: true } : undefined,
    stroke: "#14201c", strokeThickness: darkText ? 0 : size >= 20 ? 4 : 2,
  }).setOrigin(0.5);
  root.add(object);
  return object;
}

function cover(scene: Phaser.Scene, root: Phaser.GameObjects.Container, key: string, tint?: number): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const image = scene.add.image(225, 400, key);
  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  image.setScale(Math.max(450 / source.width, 800 / source.height));
  if (tint !== undefined) image.setTint(tint);
  root.add(image);
  return image;
}

function fitted(scene: Phaser.Scene, root: Phaser.GameObjects.Container, key: string, x: number, y: number, maxWidth: number, maxHeight: number): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const image = scene.add.image(x, y, key);
  image.setScale(Math.min(maxWidth / image.width, maxHeight / image.height));
  root.add(image);
  return image;
}

function panel(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, fill: number, alpha = 0.94): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050909, 0.42).fillRoundedRect(x - width / 2 + 3, y - height / 2 + 5, width, height, 10);
  g.fillStyle(fill, alpha).fillRoundedRect(x - width / 2, y - height / 2, width, height, 10);
  g.fillStyle(0xffffff, 0.08).fillRoundedRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, Math.max(7, height * 0.16), 8);
  g.lineStyle(2, 0xe0bb69, 0.9).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 10);
  root.add(g);
}

function screenFrame(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.lineStyle(5, 0x09131c, 0.96).strokeRoundedRect(5, 5, 440, 790, 12);
  g.lineStyle(2, 0xe3bd69, 0.96).strokeRoundedRect(8, 8, 434, 784, 10);
  g.lineStyle(1, 0xffedb4, 0.45).strokeRoundedRect(12, 12, 426, 776, 8);
  root.add(g);
}

function effectRow(scene: Phaser.Scene, root: Phaser.GameObjects.Container, y: number, color: number, label: string, arrow: string, result: string): void {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.28).fillRoundedRect(62, y - 14, 326, 28, 7);
  g.fillStyle(color, 1).fillCircle(82, y, 10);
  root.add(g);
  text(scene, root, 82, y, "◆", 11, "#ffffff", "900");
  text(scene, root, 138, y, label, 17, "#352f29", "900");
  text(scene, root, 223, y, arrow, 20, arrow === "↓" ? "#b1262c" : arrow === "→" ? "#6d685f" : "#16864f", "900");
  text(scene, root, 303, y, result, 16, "#352f29", "800");
}

function metricChip(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, label: string, value: string, color: number): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 0.12).fillRoundedRect(x - 47, y - 16, 94, 32, 6);
  g.lineStyle(1, color, 0.72).strokeRoundedRect(x - 47, y - 16, 94, 32, 6);
  root.add(g);
  text(scene, root, x - 11, y, label, 14, "#43382e", "800");
  text(scene, root, x + 30, y, value, 16, "#17663f", "900");
}

function button(scene: Runtime, root: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, fill: number, onClick: () => void): void {
  const g = scene.add.graphics();
  const paint = (pressed = false) => {
    g.clear();
    g.fillStyle(0x04070a, 0.5).fillRoundedRect(x - width / 2 + 3, y - height / 2 + 5, width, height, 8);
    g.fillStyle(pressed ? Phaser.Display.Color.ValueToColor(fill).darken(12).color : fill, 0.98).fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    g.fillStyle(0xffffff, 0.14).fillRoundedRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height * 0.25, 6);
    g.lineStyle(2, 0xf0d18a, 0.95).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);
  };
  paint();
  root.add(g);
  text(scene, root, x, y, label, 21, "#fffaf0", "900", width - 24);
  const zone = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
  root.add(zone);
  zone.on("pointerdown", () => { paint(true); onClick(); });
  zone.on("pointerup", () => paint(false));
  zone.on("pointerout", () => paint(false));
}

function buildTitle(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  cover(scene, root, BG_KEY);
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x07141b, 0x07141b, 0x07141b, 0x07141b, 0.32, 0.32, 0.04, 0.04).fillRect(0, 0, 450, 800);
  root.add(shade);
  panel(scene, root, 225, 43, 420, 64, 0x0a1b2b, 0.9);
  text(scene, root, 48, 34, "Lv.12\nカイト", 14, "#ffffff", "900");
  text(scene, root, 220, 28, "● 2,420     ◆ 180", 15, "#fff2c4", "900");
  text(scene, root, 374, 29, "1年目　春", 14, "#fff6dd", "900");
  const rail = scene.add.graphics();
  rail.fillStyle(0x08131d, 0.92).fillRoundedRect(12, 104, 54, 354, 8);
  rail.lineStyle(2, 0xe0bb69, 0.86).strokeRoundedRect(12, 104, 54, 354, 8);
  root.add(rail);
  text(scene, root, 39, 140, "☰\nメニュー", 13, "#fff3ce", "900");
  text(scene, root, 39, 218, "◆\nクエスト", 12, "#fff3ce", "900");
  text(scene, root, 39, 296, "♟\n仲間", 12, "#fff3ce", "900");
  text(scene, root, 39, 374, "▣\n持ち物", 12, "#fff3ce", "900");
  text(scene, root, 39, 434, "▤\n図鑑", 12, "#fff3ce", "900");
  text(scene, root, 260, 140, "この世界の\n物語は、\nあなたの選択から。", 34, "#ffffff", "900", 350);
  fitted(scene, root, HERO_BACK_KEY, 246, 430, 300, 410);
  panel(scene, root, 166, 590, 274, 38, 0x0758a4, 0.96);
  text(scene, root, 166, 590, "●　新しい依頼が届いています", 14, "#ffffff", "900");
  panel(scene, root, 225, 656, 414, 112, 0xf5ecd3, 0.98);
  fitted(scene, root, ELDER_KEY, 58, 660, 72, 84);
  text(scene, root, 238, 633, "飢える民たち", 20, "#3c2a1e", "900");
  text(scene, root, 240, 674, "王都の周辺で食料が不足しています。\n助けを求める声が届いています。", 15, "#43382e", "700", 320);
  text(scene, root, 418, 657, "›", 34, "#8a6726", "900");
  const nav = scene.add.graphics();
  nav.fillStyle(0x07131e, 0.96).fillRect(8, 724, 434, 68);
  nav.lineStyle(2, 0xe2bd6b, 0.82).lineBetween(10, 724, 440, 724);
  nav.fillStyle(0x0758a4, 0.92).fillRoundedRect(18, 734, 68, 48, 8);
  root.add(nav);
  text(scene, root, 52, 758, "◆\n王都", 13, "#ffffff", "900");
  text(scene, root, 135, 758, "◇\nワールド", 12, "#fff0c8", "900");
  text(scene, root, 225, 758, "♟\nキャラ", 12, "#fff0c8", "900");
  text(scene, root, 315, 758, "✦\nガチャ", 12, "#fff0c8", "900");
  text(scene, root, 400, 758, "▣\nショップ", 12, "#fff0c8", "900");
  screenFrame(scene, root);
  const start = scene.add.zone(225, 660, 420, 112).setInteractive({ useHandCursor: true });
  start.on("pointerdown", () => invoke(scene, "startRun"));
  root.add(start);
  return root;
}

function buildChoice(scene: Runtime): Pick<MockUi, "choiceRoot" | "yearText" | "requestTitle" | "requestText"> {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  cover(scene, root, BG_KEY, 0xc8b997);
  const shade = scene.add.graphics();
  shade.fillStyle(0x071017, 0.24).fillRect(0, 0, 450, 800);
  root.add(shade);
  panel(scene, root, 225, 39, 420, 60, 0x0b1a29, 0.92);
  const yearText = text(scene, root, 62, 39, "", 16, "#fff4d0", "900");
  text(scene, root, 282, 39, "選択が、世界をつくる", 20, "#ffffff", "900");
  fitted(scene, root, HERO_BACK_KEY, 100, 385, 290, 460);
  fitted(scene, root, ELDER_KEY, 325, 448, 224, 336);
  panel(scene, root, 300, 175, 272, 188, 0xf7efd9, 0.985);
  const requestBand = scene.add.graphics();
  requestBand.fillStyle(0x392d22, 0.92).fillRoundedRect(172, 88, 256, 46, 8);
  requestBand.lineStyle(1, 0xe0bb69, 0.9).strokeRoundedRect(172, 88, 256, 46, 8);
  root.add(requestBand);
  const requestTitle = text(scene, root, 300, 111, "", 20, "#35281e", "900", 234);
  const requestText = text(scene, root, 300, 197, "", 20, "#352f29", "700", 232);
  requestTitle.setColor("#fff4d5");
  button(scene, root, 225, 598, 382, 80, "食料を支援する", 0x0758a4, () => invoke(scene, "onKarmaChoice", true));
  button(scene, root, 225, 694, 382, 80, "支援を断る", 0x981d25, () => invoke(scene, "onKarmaChoice", false));
  text(scene, root, 225, 766, "「どんな選択にも、意味がある」", 17, "#fff3d0", "700");
  screenFrame(scene, root);
  return { choiceRoot: root, yearText, requestTitle, requestText };
}

function buildReaction(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, REACTION_BG_KEY);
  panel(scene, root, 225, 49, 414, 72, 0xf4e5c5, 0.97);
  text(scene, root, 225, 29, "1年目  春", 15, "#35281e", "800");
  text(scene, root, 225, 61, "選択の結果", 30, "#35281e", "900");
  panel(scene, root, 225, 600, 408, 316, 0xf7efd9, 0.98);
  text(scene, root, 225, 470, "食料を支援しました", 29, "#35281e", "900");
  text(scene, root, 225, 524, "王都からの食料が村に届き、\n人々の表情に笑顔が戻りました。", 18, "#43382e", "700", 360);
  effectRow(scene, root, 589, 0x2f8c4b, "民の声", "↑", "大きく上昇");
  effectRow(scene, root, 619, 0x245e9b, "王国", "↑", "やや上昇");
  effectRow(scene, root, 649, 0x7a5899, "教会", "→", "変化なし");
  effectRow(scene, root, 679, 0xa32d34, "貴族", "↓", "やや低下");
  button(scene, root, 225, 718, 328, 58, "次へ", 0x0758a4, () => { scene.reactionUntil = 0; });
  screenFrame(scene, root);
  return root;
}

function buildFinal(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, BG_KEY, 0x8da0a0);
  const dim = scene.add.graphics();
  dim.fillStyle(0x06101a, 0.42).fillRect(0, 0, 450, 800);
  root.add(dim);
  panel(scene, root, 225, 400, 422, 756, 0xf7efd9, 0.988);
  text(scene, root, 225, 55, "▤　年代記", 35, "#35281e", "900");
  text(scene, root, 225, 94, "あなたが紡いだ、この世界の物語", 16, "#43382e", "700");
  panel(scene, root, 225, 215, 388, 198, 0xfff8e8, 0.99);
  fitted(scene, root, REACTION_BG_KEY, 112, 210, 160, 158);
  text(scene, root, 296, 169, "飢える民たち", 21, "#35281e", "900");
  text(scene, root, 296, 232, "王都の食料を村へ届けた。\n村の人々は救われ、\n王国への信頼が高まった。", 16, "#43382e", "700", 206);
  panel(scene, root, 225, 376, 388, 110, 0xe4ddcb, 0.99);
  text(scene, root, 225, 352, "???", 22, "#35281e", "900");
  text(scene, root, 225, 397, "この選択が、新たな物語への扉を開いた。", 15, "#43382e", "700", 340);
  fitted(scene, root, "kq-hero-warrior", 122, 584, 188, 242);
  text(scene, root, 303, 510, "カイト　Lv.12", 23, "#35281e", "900");
  metricChip(scene, root, 264, 555, "正義", "+2", 0x2e6ba3);
  metricChip(scene, root, 362, 555, "共感", "+1", 0xb84a63);
  metricChip(scene, root, 264, 594, "洞察", "+0", 0x70529a);
  metricChip(scene, root, 362, 594, "魅力", "+1", 0xb48727);
  button(scene, root, 225, 708, 360, 72, "もう一度旅に出る", 0x0758a4, () => invoke(scene, "startRun"));
  screenFrame(scene, root);
  return root;
}

function build(scene: Runtime): MockUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const titleRoot = buildTitle(scene);
  const choice = buildChoice(scene);
  const reactionRoot = buildReaction(scene);
  const finalRoot = buildFinal(scene);
  const ui = { titleRoot, ...choice, reactionRoot, finalRoot };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  ui.titleRoot.setVisible(portrait && scene.phase === "title");
  ui.choiceRoot.setVisible(portrait && scene.phase === "karma");
  ui.reactionRoot.setVisible(portrait && (scene.reactionUntil ?? 0) > scene.time.now);
  ui.finalRoot.setVisible(portrait && scene.phase === "final");
  if (!portrait || scene.phase !== "karma") return;
  const request = scene.currentRequest;
  ui.yearText.setText(`${Phaser.Math.Clamp(scene.stage ?? 1, 1, 12)}年目  春`);
  ui.requestTitle.setText(request ? `依頼  ${FACTION_LABEL[request.faction]}` : "新しい依頼");
  ui.requestText.setText(request?.text ?? "王都の民が、あなたの決断を待っています。どうしますか？");
}

export function installKarmaConceptArtPass(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalPreload = proto.preload;
  if (!proto.__visualMockPreload) {
    proto.__visualMockPreload = originalPreload ?? (() => undefined);
    proto.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload?.apply(this, args);
      this.load.image(BG_KEY, `images/${BG_KEY}.png`);
      this.load.image(HERO_BACK_KEY, `images/${HERO_BACK_KEY}.png`);
      this.load.image(ELDER_KEY, `images/${ELDER_KEY}.png`);
      this.load.image(REACTION_BG_KEY, `images/${REACTION_BG_KEY}.png`);
      return result;
    };
  }
  const originalChoice = proto.onKarmaChoice;
  if (originalChoice && !proto.__visualMockChoice) {
    proto.__visualMockChoice = originalChoice;
    proto.onKarmaChoice = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalChoice.apply(this, args);
      const runtime = this as Runtime;
      runtime.lastAccepted = args[0] === true;
      runtime.reactionUntil = Number.POSITIVE_INFINITY;
      return result;
    };
  }
  const originalUpdate = proto.update;
  if (proto.__conceptArtFidelityUpdate) return;
  proto.__conceptArtFidelityUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
