import Phaser from "phaser";
import { FACTION_LABEL, type KarmaRequest, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";
import { PORTRAIT_BLUEPRINT } from "./portraitBlueprint";

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
  acceptLabel: Phaser.GameObjects.Text;
  reactionTitle: Phaser.GameObjects.Text;
  reactionBody: Phaser.GameObjects.Text;
  reactionQuote: Phaser.GameObjects.Text;
  reactionArrows: Phaser.GameObjects.Text[];
  reactionResults: Phaser.GameObjects.Text[];
  landscapeReaction?: Omit<MockUi, "titleRoot" | "choiceRoot" | "finalRoot" | "yearText" | "requestTitle" | "requestText" | "acceptLabel" | "landscapeReaction">;
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
  const darkText = color === "#35281e" || color === "#352f29" || color === "#3c2a1e" || color === "#43382e" || color === "#6a4a2a";
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

function artWindow(scene: Phaser.Scene, root: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number): void {
  if (!scene.textures.exists(key)) return;
  const image = scene.add.image(x, y, key).setOrigin(0);
  const scale = Math.max(width / image.width, height / image.height);
  const cropWidth = width / scale, cropHeight = height / scale;
  const cropX = (image.width - cropWidth) / 2, cropY = (image.height - cropHeight) / 2;
  image.setScale(scale).setPosition(x - cropX * scale, y - cropY * scale);
  image.setCrop(cropX, cropY, cropWidth, cropHeight);
  root.add(image);
}

function bustWindow(scene: Phaser.Scene, root: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number): void {
  if (!scene.textures.exists(key)) return;
  const image = scene.add.image(x, y, key).setOrigin(0);
  const cropHeight = image.height * 0.42;
  const cropWidth = Math.min(image.width, cropHeight * (width / height));
  const cropX = (image.width - cropWidth) / 2;
  const scale = Math.max(width / cropWidth, height / cropHeight);
  image.setCrop(cropX, 0, cropWidth, cropHeight).setScale(scale).setPosition(x - cropX * scale, y);
  root.add(image);
}

function screenFrame(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.lineStyle(5, 0x09131c, 0.96).strokeRoundedRect(5, 5, 440, 790, 12);
  g.lineStyle(2, 0xe3bd69, 0.96).strokeRoundedRect(8, 8, 434, 784, 10);
  g.lineStyle(1, 0xffedb4, 0.45).strokeRoundedRect(12, 12, 426, 776, 8);
  ornament(g, 8, 8, 434, 784);
  root.add(g);
}

// Mirrored, inset metalwork keeps the flourish inside the panel's reserved edge.
function ornament(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx < 0 ? x : x + width;
    const cy = sy < 0 ? y : y + height;
    const point = (a: number, b: number) => new Phaser.Math.Vector2(cx - sx * a, cy - sy * b);
    g.lineStyle(2, 0xd5ad60, 1).strokePoints([point(3, 27), point(3, 13), point(13, 13), point(13, 3), point(27, 3)], false);
    g.lineStyle(1, 0xffe4a0, 0.9).strokePoints([point(6, 30), point(6, 17), point(17, 17), point(17, 6), point(30, 6)], false);
    g.fillStyle(0xf2d28b, 1).fillPoints([point(8, 17), point(12, 21), point(16, 17), point(12, 13)], true);
  }
}

// Reading surfaces share the button's metalwork, but use quiet parchment
// instead of an action gradient or directional ornament.
function requestCard(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number): void {
  const g = scene.add.graphics();
  const shape = (inset: number) => {
    const l = x - width / 2 + inset, r = x + width / 2 - inset;
    const t = y - height / 2 + inset, b = y + height / 2 - inset;
    return [[l + 8, t], [r - 8, t], [r, t + 8], [r, b - 8],
      [r - 8, b], [l + 8, b], [l, b - 8], [l, t + 8]]
      .map(([px, py]) => new Phaser.Math.Vector2(px, py));
  };
  g.fillStyle(0x201d1a, 1).fillPoints(shape(0), true);
  g.fillStyle(0xf7efd9, 1).fillPoints(shape(3), true);
  g.lineStyle(2, 0xb79451, 1).strokePoints(shape(1), true);
  g.lineStyle(1, 0xb79451, 0.55).strokePoints(shape(7), true);
  ornament(g, x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);
  root.add(g);
}

function effectRow(scene: Phaser.Scene, root: Phaser.GameObjects.Container, y: number, color: number, label: string, arrow: string, result: string): [Phaser.GameObjects.Text, Phaser.GameObjects.Text] {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.28).fillRoundedRect(62, y - 14, 326, 28, 7);
  g.fillStyle(color, 1).fillCircle(82, y, 10);
  root.add(g);
  text(scene, root, 82, y, "◆", 11, "#ffffff", "900");
  text(scene, root, 138, y, label, 17, "#352f29", "900");
  const arrowText = text(scene, root, 223, y, arrow, 20, arrow === "↓" ? "#b1262c" : arrow === "→" ? "#6d685f" : "#16864f", "900");
  const resultText = text(scene, root, 303, y, result, 16, "#352f29", "800");
  return [arrowText, resultText];
}

function metricChip(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, label: string, value: string, color: number): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 0.12).fillRoundedRect(x - 47, y - 16, 94, 32, 6);
  g.lineStyle(1, color, 0.72).strokeRoundedRect(x - 47, y - 16, 94, 32, 6);
  root.add(g);
  text(scene, root, x - 11, y, label, 14, "#43382e", "800");
  text(scene, root, x + 30, y, value, 16, "#17663f", "900");
}

function button(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  fill: number,
  onClick: () => void,
  detail?: string,
): Phaser.GameObjects.Text {
  const g = scene.add.graphics();
  let armed = false;
  let processing = false;
  const outline = (inset: number) => {
    const l = x - width / 2 + inset, r = x + width / 2 - inset;
    const t = y - height / 2 + inset, b = y + height / 2 - inset;
    const cut = 9;
    return [{ x: l + cut, y: t }, { x: r - cut, y: t }, { x: r, y: t + cut },
      { x: r, y: b - cut }, { x: r - cut, y: b }, { x: l + cut, y: b },
      { x: l, y: b - cut }, { x: l, y: t + cut }].map(point => new Phaser.Math.Vector2(point.x, point.y));
  };
  const paint = (state: "idle" | "focus" | "pressed" | "processing" = "idle") => {
    g.clear();
    const blue = fill === 0x0758a4;
    const base = blue ? 0x102c52 : 0x501923;
    g.fillStyle(0x050b13, 0.95).fillPoints(outline(0), true);
    g.fillStyle(base, 1).fillPoints(outline(4), true);
    const top = state === "pressed" ? base : blue ? 0x235783 : 0x80343d;
    g.fillGradientStyle(top, base, base, 0x0b1425, 1).fillRect(x - width / 2 + 14, y - height / 2 + 5, width - 28, height - 10);
    g.lineStyle(2, 0xb79451, 1).strokePoints(outline(1), true);
    g.lineStyle(1, 0xf4dfaa, 0.85).strokePoints(outline(5), true);
    g.lineStyle(1, 0x6192b4, blue ? 0.7 : 0.15).strokePoints(outline(8), true);
    ornament(g, x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);
    if (state === "focus") g.lineStyle(2, 0xffffff, 0.72).strokePoints(outline(8), true);
    if (state === "processing") g.fillStyle(0x071017, 0.44).fillPoints(outline(5), true);
    // Small gold corner flourishes, matching the mock's inset metalwork.
    for (const side of [-1, 1]) {
      const edge = x + side * (width / 2 - 13);
      g.lineStyle(2, 0xe8cb83, 0.9);
      g.lineBetween(edge, y - height / 2 + 18, edge + side * 6, y - height / 2 + 10);
      g.lineBetween(edge, y + height / 2 - 18, edge + side * 6, y + height / 2 - 10);
    }
    g.fillStyle(0xf4e5bd, 0.95).fillTriangle(x + width / 2 - 26, y - 5, x + width / 2 - 26, y + 5, x + width / 2 - 20, y);
  };
  paint();
  root.add(g);
  const labelText = text(scene, root, x, detail ? y - 10 : y, label, detail ? 21 : 22, "#fffaf0", "900", width - 70).setStroke("#091420", 1);
  if (detail) text(scene, root, x, y + 18, detail, 13, "#eadfca", "700", width - 76).setStroke("#091420", 1);
  const zone = scene.add.zone(x, y, width, height).setName(`cta:${label}`).setInteractive({ useHandCursor: true });
  root.add(zone);
  zone.on("pointerover", () => { if (!processing) paint("focus"); });
  zone.on("pointerdown", () => { if (!processing) { armed = true; paint("pressed"); } });
  zone.on("pointerup", () => {
    if (!armed || processing) return;
    armed = false;
    processing = true;
    paint("processing");
    onClick();
    scene.time.delayedCall(280, () => { processing = false; paint("idle"); });
  });
  zone.on("pointerout", () => { armed = false; if (!processing) paint("idle"); });
  return labelText;
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
  // The home mock shows a close foreground hero, with the lower body behind HUD.
  fitted(scene, root, HERO_BACK_KEY, 232, 505, 390, 520);
  panel(scene, root, 166, 590, 274, 38, 0x0758a4, 0.96);
  text(scene, root, 166, 590, "●　新しい依頼が届いています", 14, "#ffffff", "900");
  requestCard(scene, root, 225, 656, 414, 112);
  artWindow(scene, root, ELDER_KEY, 31, 618, 68, 78);
  text(scene, root, 260, 633, "飢える民たち", 21, "#3c2a1e", "900");
  text(scene, root, 270, 674, "王都周辺で食料が不足。\n民が助けを求めています。", 18, "#43382e", "700", 280);
  text(scene, root, 418, 657, "›", 34, "#8a6726", "900");
  const nav = scene.add.graphics();
  nav.fillStyle(0x07131e, 0.96).fillRect(8, 724, 434, 68);
  nav.lineStyle(2, 0xe2bd6b, 0.82).lineBetween(10, 724, 440, 724);
  nav.fillStyle(0x102c52, 1).fillRect(18, 734, 68, 48);
  nav.lineStyle(1, 0xb79451, 0.9).strokeRect(18, 734, 68, 48);
  for (const divider of [94, 180, 270, 356]) {
    nav.lineStyle(1, 0xb79451, 0.35).lineBetween(divider, 734, divider, 783);
  }
  root.add(nav);
  text(scene, root, 52, 758, "◆\n王都", 15, "#ffffff", "900");
  text(scene, root, 135, 758, "◇\nワールド", 15, "#fff0c8", "900");
  text(scene, root, 225, 758, "♟\nキャラ", 15, "#fff0c8", "900");
  text(scene, root, 315, 758, "✦\nガチャ", 15, "#fff0c8", "900");
  text(scene, root, 400, 758, "▣\nショップ", 15, "#fff0c8", "900");
  screenFrame(scene, root);
  const start = scene.add.zone(225, 660, 420, 112).setInteractive({ useHandCursor: true });
  start.on("pointerdown", () => invoke(scene, "startRun"));
  root.add(start);
  return root;
}

function buildChoice(scene: Runtime): Pick<MockUi, "choiceRoot" | "yearText" | "requestTitle" | "requestText" | "acceptLabel"> {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  cover(scene, root, BG_KEY, 0xc8b997);
  const shade = scene.add.graphics();
  shade.fillStyle(0x071017, 0.24).fillRect(0, 0, 450, 800);
  root.add(shade);
  panel(scene, root, 225, 39, 420, 60, 0x0b1a29, 0.92);
  const yearText = text(scene, root, 62, 39, "", 16, "#fff4d0", "900");
  text(scene, root, 282, 39, "選択が、世界をつくる", 20, "#ffffff", "900");
  // Crop the existing front portrait at the chest; keep a uniform scale so
  // the conversation portrait does not imply a full-body depth relationship.
  if (scene.textures.exists("kq-hero-warrior")) {
    const portrait = scene.add.image(-55, 328, "kq-hero-warrior").setOrigin(0, 0);
    portrait.setScale(0.9).setCrop(60, 0, 285, 255);
    root.add(portrait);
  }
  const npc = PORTRAIT_BLUEPRINT.choice.npcPortrait;
  fitted(scene, root, ELDER_KEY, npc.x + npc.width / 2, npc.y + npc.height / 2, npc.width, npc.height);
  requestCard(scene, root, 290, 175, 304, 188);
  const requestBand = scene.add.graphics();
  requestBand.fillStyle(0x102c52, 1).fillRect(146, 93, 288, 41);
  requestBand.lineStyle(1, 0xb79451, 1).lineBetween(146, 134, 434, 134);
  root.add(requestBand);
  const requestTitle = text(scene, root, 290, 111, "", 20, "#35281e", "900", 270);
  const requestText = text(scene, root, 290, 197, "", 20, "#352f29", "700", 270);
  requestTitle.setColor("#fff4d5");
  const acceptLabel = button(scene, root, 225, 598, 382, 80, "食料を支援する", 0x0758a4, () => invoke(scene, "onKarmaChoice", true), "村に届け、民の声に応える");
  button(scene, root, 225, 694, 382, 80, "支援を断る", 0x981d25, () => invoke(scene, "onKarmaChoice", false), "王都の備蓄を守り、別の道を選ぶ");
  text(scene, root, 225, 766, "「どんな選択にも、意味がある」", 17, "#fff3d0", "700");
  screenFrame(scene, root);
  return { choiceRoot: root, yearText, requestTitle, requestText, acceptLabel };
}

function buildReaction(scene: Runtime, landscape = false): Pick<MockUi, "reactionRoot" | "reactionTitle" | "reactionBody" | "reactionQuote" | "reactionArrows" | "reactionResults"> {
  const screen = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  if (landscape) {
    const background = scene.add.graphics().fillStyle(0x07131e, 1).fillRect(0, 0, 800, 450);
    screen.add(background);
    artWindow(scene, screen, REACTION_BG_KEY, 8, 8, 350, 434);
    requestCard(scene, screen, 183, 49, 334, 72);
  } else {
    cover(scene, screen, REACTION_BG_KEY);
    requestCard(scene, screen, 225, 49, 414, 72);
  }
  text(scene, screen, landscape ? 183 : 225, 29, "1年目  春", 18, "#35281e", "800");
  text(scene, screen, landscape ? 183 : 225, 61, "選択の結果", 30, "#35281e", "900");
  const root = scene.add.container(landscape ? 354 : 0, landscape ? -374 : 0);
  screen.add(root);
  panel(scene, root, 225, 616, 408, 348, 0xf7efd9, 0.98);
  const reactionTitle = text(scene, root, 225, 470, "食料を支援しました", 29, "#35281e", "900");
  const reactionBody = text(scene, root, 225, 524, "王都からの食料が村に届き、\n人々の表情に笑顔が戻りました。", 18, "#43382e", "700", 360);
  const reactionQuote = text(scene, root, 225, 558, "「王都は、私たちの希望です」", 17, "#6a4a2a", "700", 350);
  const effectRows = [
    effectRow(scene, root, 590, 0x2f8c4b, "民の声", "↑", "大きく上昇"),
    effectRow(scene, root, 620, 0x245e9b, "王国", "↑", "やや上昇"),
    effectRow(scene, root, 650, 0x7a5899, "教会", "→", "変化なし"),
    effectRow(scene, root, 680, 0xa32d34, "貴族", "↓", "やや低下"),
  ];
  button(scene, root, 225, 750, 328, 80, "次へ", 0x0758a4, () => { scene.reactionUntil = 0; });
  if (!landscape) screenFrame(scene, screen);
  return {
    reactionRoot: screen,
    reactionTitle,
    reactionBody,
    reactionQuote,
    reactionArrows: effectRows.map(([arrow]) => arrow),
    reactionResults: effectRows.map(([, result]) => result),
  };
}

function buildFinal(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  cover(scene, root, BG_KEY, 0x8da0a0);
  const dim = scene.add.graphics();
  dim.fillStyle(0x06101a, 0.42).fillRect(0, 0, 450, 800);
  root.add(dim);
  requestCard(scene, root, 225, 400, 422, 756);
  panel(scene, root, 225, 66, 394, 80, 0x102c52, 1);
  text(scene, root, 225, 51, "年代記", 32, "#fffaf0", "900").setStroke("#091420", 1);
  text(scene, root, 225, 86, "あなたが紡いだ、この世界の物語", 16, "#fffaf0", "700").setStroke("#091420", 0);
  requestCard(scene, root, 225, 209, 388, 182);
  artWindow(scene, root, REACTION_BG_KEY, 45, 141, 132, 140);
  text(scene, root, 290, 151, "飢える民たち", 21, "#35281e", "900");
  text(scene, root, 295, 218, "王都の食料を村へ届けた。\n村の人々は救われ、\n王国への信頼が高まった。", 16, "#43382e", "700", 206);
  requestCard(scene, root, 225, 355, 388, 98);
  text(scene, root, 225, 331, "???", 22, "#35281e", "900");
  text(scene, root, 225, 373, "この選択が、新たな物語への扉を開いた。", 15, "#43382e", "700", 340);
  artWindow(scene, root, BG_KEY, 34, 412, 382, 108);
  panel(scene, root, 225, 492, 382, 54, 0x102c52, 0.9);
  text(scene, root, 225, 491, "王都ルナディス — 物語の始まる街", 18, "#fffaf0", "900").setStroke("#091420", 1);
  bustWindow(scene, root, "kq-hero-warrior", 40, 535, 157, 133);
  text(scene, root, 303, 542, "カイト　Lv.12", 23, "#35281e", "900");
  metricChip(scene, root, 264, 589, "正義", "+2", 0x2e6ba3);
  metricChip(scene, root, 362, 589, "共感", "+1", 0xb84a63);
  metricChip(scene, root, 264, 633, "洞察", "+0", 0x70529a);
  metricChip(scene, root, 362, 633, "魅力", "+1", 0xb48727);
  button(scene, root, 225, 708, 360, 72, "もう一度旅に出る", 0x0758a4, () => invoke(scene, "startRun"));
  screenFrame(scene, root);
  return root;
}

function build(scene: Runtime): MockUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const titleRoot = buildTitle(scene);
  const choice = buildChoice(scene);
  const reaction = buildReaction(scene);
  const finalRoot = buildFinal(scene);
  const ui = { titleRoot, ...choice, ...reaction, finalRoot, landscapeReaction: buildReaction(scene, true) };
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
  ui.landscapeReaction?.reactionRoot.setVisible(!portrait && (scene.reactionUntil ?? 0) > scene.time.now);
  ui.finalRoot.setVisible(portrait && scene.phase === "final");
  const accepted = scene.lastAccepted !== false;
  ui.reactionQuote.setText(accepted ? "「王都は、私たちの希望です」" : "「私たちの声は、届かなかった……」");
  ui.reactionTitle.setText(accepted ? "食料を支援しました" : "支援を見送りました");
  ui.reactionBody.setText(accepted
    ? "王都からの食料が村に届き、\n人々の表情に笑顔が戻りました。"
    : "王都は備蓄を守りましたが、\n村には不安と失望が広がりました。");
  const arrows = accepted ? ["↑", "↑", "→", "↓"] : ["↓", "→", "↑", "↑"];
  const results = accepted ? ["大きく上昇", "やや上昇", "変化なし", "やや低下"] : ["大きく低下", "変化なし", "やや上昇", "やや上昇"];
  ui.reactionArrows.forEach((item, index) => item.setText(arrows[index] ?? "→").setColor((arrows[index] ?? "→") === "↓" ? "#b1262c" : (arrows[index] ?? "→") === "→" ? "#6d685f" : "#16864f"));
  ui.reactionResults.forEach((item, index) => item.setText(results[index] ?? "変化なし"));
  const wide = ui.landscapeReaction;
  if (wide) {
    wide.reactionTitle.setText(ui.reactionTitle.text);
    wide.reactionBody.setText(ui.reactionBody.text);
    wide.reactionQuote.setText(ui.reactionQuote.text);
    wide.reactionArrows.forEach((item, i) => {
      const source = ui.reactionArrows[i];
      if (source) item.setText(source.text).setColor(source.style.color as string);
    });
    wide.reactionResults.forEach((item, i) => item.setText(ui.reactionResults[i]?.text ?? ""));
  }
  if (!portrait || scene.phase !== "karma") return;
  const request = scene.currentRequest;
  ui.yearText.setText(`${Phaser.Math.Clamp(scene.stage ?? 1, 1, 12)}年目  春`);
  ui.requestTitle.setText(request ? `依頼  ${FACTION_LABEL[request.faction]}` : "新しい依頼");
  ui.requestText.setText(request?.text ?? "王都の民が、あなたの決断を待っています。どうしますか？");
  const actionLabels: Record<string, string> = {
    village_food: "食料を支援する",
    warrior_iron: "鉄を届ける",
    warrior_train: "訓練を認める",
    merchant_monster: "護衛を派遣する",
    merchant_toll: "通行料を減免する",
    outlaw_gold: "酒代を与える",
    outlaw_fight: "挑戦を認める",
    mage_stone: "魔石を与える",
    mage_book: "禁書を許可する",
  };
  ui.acceptLabel.setText(request ? actionLabels[request.id] ?? "依頼を引き受ける" : "依頼を確認する");
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
