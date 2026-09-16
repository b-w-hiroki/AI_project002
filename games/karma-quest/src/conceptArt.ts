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
  text(scene, root, x, y, label, 17, "#fffaf0", "900", width - 24);
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
  text(scene, root, 46, 34, "Lv.12\nカイト", 12, "#ffffff", "900");
  text(scene, root, 220, 28, "● 2,420     ◆ 180", 13, "#fff2c4", "900");
  text(scene, root, 374, 29, "1年目　春", 12, "#fff6dd", "900");
  const rail = scene.add.graphics();
  rail.fillStyle(0x08131d, 0.92).fillRoundedRect(12, 104, 54, 354, 8);
  rail.lineStyle(2, 0xe0bb69, 0.86).strokeRoundedRect(12, 104, 54, 354, 8);
  root.add(rail);
  text(scene, root, 39, 140, "☰\nメニュー", 11, "#fff3ce", "900");
  text(scene, root, 39, 218, "◆\nクエスト", 10, "#fff3ce", "900");
  text(scene, root, 39, 296, "♟\n仲間", 10, "#fff3ce", "900");
  text(scene, root, 39, 374, "▣\n持ち物", 10, "#fff3ce", "900");
  text(scene, root, 39, 434, "▤\n図鑑", 10, "#fff3ce", "900");
  text(scene, root, 260, 137, "この世界の\n物語は、\nあなたの選択から。", 31, "#ffffff", "900", 330);
  fitted(scene, root, HERO_BACK_KEY, 246, 430, 300, 410);
  panel(scene, root, 225, 660, 414, 100, 0xf5ecd3, 0.98);
  fitted(scene, root, ELDER_KEY, 58, 660, 72, 84);
  text(scene, root, 238, 640, "飢える民たち", 17, "#3c2a1e", "900");
  text(scene, root, 240, 676, "王都の周辺で食料が不足しています。\n助けを求める声が届いています。", 12, "#43382e", "700", 310);
  const nav = scene.add.graphics();
  nav.fillStyle(0x07131e, 0.96).fillRect(8, 724, 434, 68);
  nav.lineStyle(2, 0xe2bd6b, 0.82).lineBetween(10, 724, 440, 724);
  root.add(nav);
  text(scene, root, 225, 758, "♜ 王都　 ◇ ワールド　 ♞ キャラ　 ✦ ガチャ　 ▣ ショップ", 12, "#fff0c8", "900");
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
  const yearText = text(scene, root, 62, 39, "", 14, "#fff4d0", "900");
  text(scene, root, 282, 39, "選択が、世界をつくる", 17, "#ffffff", "900");
  fitted(scene, root, HERO_BACK_KEY, 105, 406, 250, 440);
  fitted(scene, root, ELDER_KEY, 338, 408, 250, 440);
  panel(scene, root, 308, 184, 268, 212, 0xf7efd9, 0.985);
  const requestTitle = text(scene, root, 308, 112, "", 17, "#35281e", "900", 228);
  const requestText = text(scene, root, 308, 190, "", 15, "#352f29", "700", 225);
  button(scene, root, 225, 602, 374, 72, "⚖　食料を支援する", 0x0758a4, () => invoke(scene, "onKarmaChoice", true));
  button(scene, root, 225, 693, 374, 72, "♛　支援を断る", 0x981d25, () => invoke(scene, "onKarmaChoice", false));
  text(scene, root, 225, 763, "「どんな選択にも、意味がある」", 15, "#fff3d0", "700");
  screenFrame(scene, root);
  return { choiceRoot: root, yearText, requestTitle, requestText };
}

function buildReaction(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, REACTION_BG_KEY);
  panel(scene, root, 225, 49, 414, 72, 0xf4e5c5, 0.97);
  text(scene, root, 225, 31, "1年目  春", 13, "#35281e", "800");
  text(scene, root, 225, 60, "選択の結果", 27, "#35281e", "900");
  panel(scene, root, 225, 590, 408, 272, 0xf7efd9, 0.98);
  text(scene, root, 225, 492, "食料を支援しました", 26, "#35281e", "900");
  text(scene, root, 225, 544, "王都からの食料が村に届き、\n人々の表情に笑顔が戻りました。", 16, "#43382e", "700", 350);
  text(scene, root, 225, 632, "民の声　　↑　大きく上昇\n王国　　　↑　やや上昇\n教会　　　→　変化なし\n貴族　　　↓　やや低下", 17, "#352f29", "800", 340);
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
  text(scene, root, 225, 57, "▤　年代記", 32, "#35281e", "900");
  text(scene, root, 225, 92, "あなたが紡いだ、この世界の物語", 14, "#43382e", "700");
  panel(scene, root, 225, 215, 388, 198, 0xfff8e8, 0.99);
  fitted(scene, root, REACTION_BG_KEY, 112, 210, 160, 158);
  text(scene, root, 296, 171, "飢える民たち", 19, "#35281e", "900");
  text(scene, root, 296, 229, "王都の食料を村へ届けた。\n村の人々は救われ、\n王国への信頼が高まった。", 14, "#43382e", "700", 198);
  panel(scene, root, 225, 376, 388, 110, 0xe4ddcb, 0.99);
  text(scene, root, 225, 354, "???", 20, "#35281e", "900");
  text(scene, root, 225, 395, "この選択が、新たな物語への扉を開いた。", 13, "#43382e", "700", 330);
  fitted(scene, root, "kq-hero-warrior", 115, 575, 164, 220);
  text(scene, root, 298, 520, "カイト　Lv.12", 20, "#35281e", "900");
  text(scene, root, 298, 578, "正義 +2　共感 +1\n洞察 +0　カリスマ +1", 15, "#43382e", "800");
  button(scene, root, 225, 708, 350, 64, "もう一度旅に出る", 0x0758a4, () => invoke(scene, "startRun"));
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
      runtime.reactionUntil = this.time.now + 1500;
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
