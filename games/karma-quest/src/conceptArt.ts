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
};
type KarmaUi = {
  root: Phaser.GameObjects.Container;
  yearText: Phaser.GameObjects.Text;
  requestTitle: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
  requestIcon?: Phaser.GameObjects.Image;
  acceptIcon?: Phaser.GameObjects.Image;
};

const uiByScene = new WeakMap<object, KarmaUi>();
const FACTION_TEXTURES = {
  warrior: "kq-faction-icon-warrior",
  merchant: "kq-faction-icon-merchant",
  outlaw: "kq-faction-icon-outlaw",
  mage: "kq-faction-icon-mage",
} as const;

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...v: unknown[]) => unknown).apply(scene, args) : undefined;
}

function label(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = "#ead49a", weight = "700"): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif', fontSize: `${size}px`, fontStyle: weight,
    color, align: "center", lineSpacing: 5,
  }).setOrigin(0.5);
  root.add(text);
  return text;
}

function button(scene: Runtime, root: Phaser.GameObjects.Container, y: number, textValue: string, onClick: () => void): void {
  const x = 225;
  const width = 320;
  const height = 50;
  const background = scene.add.graphics();
  const paint = (pressed = false) => {
    background.clear();
    background.fillStyle(pressed ? 0x35594a : 0x2c4a3c, 1).fillRoundedRect(x - width / 2, y - height / 2, width, height, 12);
    background.lineStyle(2, 0xd9b45a, 0.55).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 12);
  };
  paint();
  root.add(background);
  label(scene, root, x, y, textValue, 18, "#f2eee1", "900");
  const hit = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
  root.add(hit);
  hit.on("pointerdown", () => { paint(true); onClick(); });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
}

function build(scene: Runtime): KarmaUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const root = scene.add.container(0, 0).setDepth(6000).setVisible(false);
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x14201c, 1).fillRect(0, 0, 450, 800);
  graphics.lineStyle(2, 0xd9b45a, 0.6).strokeCircle(225, 70, 24);
  graphics.lineStyle(1, 0xd9b45a, 0.6).lineBetween(205, 70, 245, 70).lineBetween(225, 50, 225, 90);
  graphics.fillStyle(0x1e392f, 0.96).fillRoundedRect(24, 160, 402, 480, 14);
  graphics.lineStyle(2, 0xd9b45a, 0.7).strokeRoundedRect(24, 160, 402, 480, 14);
  root.add(graphics);

  label(scene, root, 225, 115, "剣と慈悲を携える勇者", 14);
  label(scene, root, 225, 139, "最初の旅：自由に勇者を育てよう", 14);
  const yearText = label(scene, root, 225, 210, "", 13, "#9aafa2", "800");
  const requestTitle = label(scene, root, 225, 322, "", 17, "#d9b64d", "900");
  const requestText = scene.add.text(225, 390, "", {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif', fontSize: "15px", fontStyle: "700",
    color: "#cbd2cb", align: "center", lineSpacing: 6, wordWrap: { width: 320, useAdvancedWrap: true },
  }).setOrigin(0.5);
  root.add(requestText);

  let requestIcon: Phaser.GameObjects.Image | undefined;
  let acceptIcon: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists(FACTION_TEXTURES.warrior)) {
    requestIcon = scene.add.image(225, 270, FACTION_TEXTURES.warrior).setDisplaySize(72, 72);
    acceptIcon = scene.add.image(103, 500, FACTION_TEXTURES.warrior).setDisplaySize(34, 34).setDepth(2);
    root.add([requestIcon, acceptIcon]);
  }
  button(scene, root, 500, "力を貸す", () => invoke(scene, "onKarmaChoice", true));
  button(scene, root, 570, "断る", () => invoke(scene, "onKarmaChoice", false));
  if (acceptIcon) root.bringToTop(acceptIcon);

  const ui = { root, yearText, requestTitle, requestText, requestIcon, acceptIcon };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const { width, height } = scene.scale.gameSize;
  const active = scene.phase === "karma" && !!scene.karma && height >= width;
  ui.root.setVisible(active);
  if (!active) return;
  const request = scene.currentRequest;
  const stage = Phaser.Math.Clamp(scene.stage ?? 1, 1, 12);
  ui.yearText.setText(`${stage} / 12 年目`);
  ui.requestTitle.setText(request ? `【${FACTION_LABEL[request.faction]}】` : "【旅人からの依頼】");
  ui.requestText.setText(request?.text ?? "次の依頼を待っています……");
  if (request) {
    const texture = FACTION_TEXTURES[request.faction];
    ui.requestIcon?.setTexture(texture);
    ui.acceptIcon?.setTexture(texture);
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
