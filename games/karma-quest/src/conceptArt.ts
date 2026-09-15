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
  panel(scene, root, 225, 42, 420, 60, 0x0a1b2b, 0.86);
  text(scene, root, 42, 34, "Lv.12\nカイト", 11, "#ffffff", "900");
  text(scene, root, 210, 27, "◆ 2,420     ◆ 180", 12, "#fff2c4", "900");
  text(scene, root, 370, 29, "1年目　春", 11, "#fff6dd", "900");
  text(scene, root, 225, 134, "この世界の\n物語は、\nあなたの選択から。", 29, "#ffffff", "900", 330);
  fitted(scene, root, HERO_BACK_KEY, 225, 420, 310, 420);
  panel(scene, root, 225, 650, 408, 92, 0xf5ecd3, 0.98);
  fitted(scene, root, ELDER_KEY, 55, 650, 66, 76);
  text(scene, root, 230, 635, "飢える民たち", 15, "#3c2a1e", "900");
  text(scene, root, 235, 665, "王都の周辺で食料が不足しています。", 11, "#43382e", "700", 300);
  const nav = scene.add.graphics();
  nav.fillStyle(0x07131e, 0.94).fillRect(0, 735, 450, 65);
  nav.lineStyle(1, 0xe2bd6b, 0.65).lineBetween(0, 735, 450, 735);
  root.add(nav);
  text(scene, root, 225, 770, "王都  ·  ワールド  ·  キャラクター  ·  ガチャ  ·  ショップ", 10, "#fff0c8", "800");
  const start = scene.add.zone(225, 650, 420, 110).setInteractive({ useHandCursor: true });
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
  panel(scene, root, 225, 35, 420, 52, 0x0b1a29, 0.9);
  const yearText = text(scene, root, 55, 35, "", 12, "#fff4d0", "900");
  text(scene, root, 280, 35, "選択が、世界をつくる", 14, "#ffffff", "900");
  fitted(scene, root, HERO_BACK_KEY, 103, 405, 235, 420);
  fitted(scene, root, ELDER_KEY, 334, 410, 235, 420);
  panel(scene, root, 312, 188, 248, 190, 0xf7efd9, 0.98);
  const requestTitle = text(scene, root, 312, 125, "", 14, "#35281e", "900", 210);
  const requestText = text(scene, root, 312, 192, "", 13, "#352f29", "700", 205);
  button(scene, root, 225, 610, 360, 64, "食料を支援する", 0x0758a4, () => invoke(scene, "onKarmaChoice", true));
  button(scene, root, 225, 692, 360, 64, "支援を断る", 0x981d25, () => invoke(scene, "onKarmaChoice", false));
  text(scene, root, 225, 760, "「どんな選択にも、意味がある」", 13, "#fff3d0", "700");
  return { choiceRoot: root, yearText, requestTitle, requestText };
}

function buildReaction(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, REACTION_BG_KEY);
  panel(scene, root, 225, 43, 410, 58, 0xf4e5c5, 0.96);
  text(scene, root, 225, 32, "1年目  春", 12, "#35281e", "800");
  text(scene, root, 225, 56, "選択の結果", 24, "#35281e", "900");
  panel(scene, root, 225, 585, 400, 250, 0xf7efd9, 0.97);
  text(scene, root, 225, 500, "食料を支援しました", 23, "#35281e", "900");
  text(scene, root, 225, 548, "王都からの食料が村に届き、\n人々の表情に笑顔が戻りました。", 14, "#43382e", "700", 330);
  text(scene, root, 225, 622, "民の声　↑　大きく上昇\n王国　　　↑　やや上昇\n教会　　　→　変化なし\n貴族　　　↓　やや低下", 15, "#352f29", "800", 320);
  return root;
}

function buildFinal(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, BG_KEY, 0x8da0a0);
  const dim = scene.add.graphics();
  dim.fillStyle(0x06101a, 0.42).fillRect(0, 0, 450, 800);
  root.add(dim);
  panel(scene, root, 225, 400, 414, 742, 0xf7efd9, 0.985);
  text(scene, root, 225, 62, "年代記", 29, "#35281e", "900");
  text(scene, root, 225, 92, "あなたが紡いだ、この世界の物語", 12, "#43382e", "700");
  panel(scene, root, 225, 215, 374, 190, 0xfff8e8, 0.98);
  fitted(scene, root, REACTION_BG_KEY, 118, 210, 155, 150);
  text(scene, root, 295, 175, "飢える民たち", 17, "#35281e", "900");
  text(scene, root, 295, 225, "王都の食料を村へ届けた。\n村の人々は救われ、\n王国への信頼が高まった。", 12, "#43382e", "700", 190);
  panel(scene, root, 225, 370, 374, 100, 0xe4ddcb, 0.98);
  text(scene, root, 225, 350, "???", 18, "#35281e", "900");
  text(scene, root, 225, 386, "この選択が、新たな物語への扉を開いた。", 11, "#43382e", "700", 310);
  fitted(scene, root, "kq-hero-warrior", 120, 585, 150, 200);
  text(scene, root, 292, 530, "カイト  Lv.12", 18, "#35281e", "900");
  text(scene, root, 292, 580, "正義 +2　共感 +1\n洞察 +0　カリスマ +1", 13, "#43382e", "800");
  button(scene, root, 225, 700, 330, 56, "もう一度旅に出る", 0x0758a4, () => invoke(scene, "startRun"));
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
