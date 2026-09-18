import Phaser from "phaser";
import { deriveStats, initialKarma, FACTION_LABEL, type KarmaRequest, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";
import { PORTRAIT_BLUEPRINT } from "./portraitBlueprint";
import { requestOutcome } from "./logic/requestOutcome";
import { loadBestStage, loadTotalEvaluation } from "./logic/progress";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "karma" | "reaction" | "encounter" | "battle" | "report" | "final" | "transition";
  stage?: number;
  karma?: KarmaState;
  currentRequest?: KarmaRequest | null;
  homeRequest?: KarmaRequest;
  reactionUntil?: number;
  lastAccepted?: boolean;
  lastOutcome?: ReturnType<typeof requestOutcome>;
  choiceHistory?: Array<{ year: number; outcome: ReturnType<typeof requestOutcome> }>;
};
type MockUi = {
  titleRoot: Phaser.GameObjects.Container;
  choiceRoot: Phaser.GameObjects.Container;
  reactionRoot: Phaser.GameObjects.Container;
  finalRoot: Phaser.GameObjects.Container;
  landscapeTitle?: Phaser.GameObjects.Container;
  landscapeFinal?: Phaser.GameObjects.Container;
  yearText: Phaser.GameObjects.Text;
  requestTitle: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
  acceptLabel: Phaser.GameObjects.Text;
  landscapeChoice?: Pick<MockUi, "choiceRoot" | "yearText" | "requestTitle" | "requestText" | "acceptLabel">;
  reactionTitle: Phaser.GameObjects.Text;
  reactionBody: Phaser.GameObjects.Text;
  reactionQuote: Phaser.GameObjects.Text;
  reactionArrows: Phaser.GameObjects.Text[];
  reactionResults: Phaser.GameObjects.Text[];
  landscapeReaction?: Omit<MockUi, "titleRoot" | "choiceRoot" | "finalRoot" | "yearText" | "requestTitle" | "requestText" | "acceptLabel" | "landscapeReaction">;
};

const BG_KEY = "kq-bg-kingdom-portrait-v2";
const HOME_BG_KEY = "kq-bg-capital-home-v3";
const HERO_BACK_KEY = "kq-hero-warrior-back";
const ELDER_KEY = "kq-npc-elder";
const REACTION_BG_KEY = "kq-bg-village-reaction";
const MAGE_BG_KEY = "kq-bg-mage-study-v1";
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

function artWindow(scene: Phaser.Scene, root: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number, alignY = 0.5): void {
  if (!scene.textures.exists(key)) return;
  const image = scene.add.image(x, y, key).setOrigin(0);
  const scale = Math.max(width / image.width, height / image.height);
  const cropWidth = width / scale, cropHeight = height / scale;
  const cropX = (image.width - cropWidth) / 2, cropY = (image.height - cropHeight) * alignY;
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
  text(scene, root, 138, y, label, 21, "#352f29", "900");
  const arrowText = text(scene, root, 223, y, arrow, 20, arrow === "↓" ? "#b1262c" : arrow === "→" ? "#6d685f" : "#16864f", "900");
  const resultText = text(scene, root, 303, y, result, 21, "#352f29", "800");
  return [arrowText, resultText];
}

function metricChip(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, label: string, value: string, color: number): Phaser.GameObjects.Text {
  const g = scene.add.graphics();
  g.fillStyle(color, 0.12).fillRoundedRect(x - 49, y - 20, 98, 40, 6);
  g.lineStyle(1, color, 0.72).strokeRoundedRect(x - 49, y - 20, 98, 40, 6);
  root.add(g);
  text(scene, root, x - 18, y, label, 21, "#43382e", "800").setName(`stat:${label}`);
  return text(scene, root, x + 29, y, value, 22, "#17663f", "900").setStroke("#17663f", 0).setName(`stat-value:${label}`);
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
  lockAfterAction = true,
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
  const labelText = text(scene, root, x, detail ? y - 13 : y, label, 26, "#fffaf0", "900", width - 70).setStroke("#091420", 1);
  if (detail) labelText.setData("detailText", text(scene, root, x, y + 19, detail, 19, "#eadfca", "700", width - 76).setStroke("#091420", 0));
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
    if (!lockAfterAction) { processing = false; paint("idle"); return; }
    scene.time.delayedCall(280, () => { processing = false; paint("idle"); });
  });
  zone.on("pointerout", () => { armed = false; if (!processing) paint("idle"); });
  return labelText;
}

function buildTitle(scene: Runtime): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  cover(scene, root, HOME_BG_KEY);
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x07141b, 0x07141b, 0x07141b, 0x07141b, 0.03, 0.03, 0.04, 0.04).fillRect(0, 0, 450, 800);
  root.add(shade);
  panel(scene, root, 108, 45, 184, 66, 0x0a1b2b, 0.94);
  bustWindow(scene, root, "kq-hero-warrior", 22, 18, 52, 54);
  text(scene, root, 134, 34, "カイト", 24, "#ffffff", "900").setStroke("#091420", 1);
  text(scene, root, 134, 60, "旅する剣士", 18, "#fff2c4", "700").setStroke("#091420", 0);
  panel(scene, root, 322, 31, 224, 38, 0x102c52, 0.96);
  text(scene, root, 322, 31, `累計評価 ${loadTotalEvaluation()}`, 20, "#fff2c4", "900").setStroke("#091420", 1);
  panel(scene, root, 339, 83, 190, 54, 0x102c52, 0.92);
  text(scene, root, 339, 74, `最高到達 ${loadBestStage()}年`, 20, "#fff6dd", "900").setStroke("#091420", 1);
  text(scene, root, 339, 97, "王都ルナディス", 18, "#fff6dd", "700").setStroke("#091420", 0);
  const rail = scene.add.graphics();
  rail.fillStyle(0x08131d, 0.92).fillRoundedRect(12, 104, 70, 354, 8);
  rail.lineStyle(2, 0xe0bb69, 0.86).strokeRoundedRect(12, 104, 70, 354, 8);
  root.add(rail);
  for (const [index, label] of ["案内", "依頼", "仲間", "持ち物", "図鑑"].entries()) {
    const y = 125 + index * 69;
    const ink = scene.add.graphics().lineStyle(2, 0xf4dfaa, 1).fillStyle(0xf4dfaa, 1);
    if (index === 0) for (const dy of [-8, 0, 8]) ink.lineBetween(27, y + dy, 51, y + dy);
    if (index === 1 || index === 4) {
      ink.strokeRect(26, y - 12, 26, 25);
      if (index === 4) ink.lineBetween(39, y - 12, 39, y + 13);
      else { ink.lineBetween(31, y - 5, 47, y - 5); ink.lineBetween(31, y + 2, 44, y + 2); }
    }
    if (index === 2) { ink.fillCircle(39, y - 8, 6); ink.fillRoundedRect(31, y, 16, 13, 5); ink.fillCircle(26, y - 5, 4); ink.fillCircle(52, y - 5, 4); }
    if (index === 3) { ink.strokeRoundedRect(26, y - 5, 26, 21, 3); ink.strokeRoundedRect(33, y - 12, 12, 10, 3); }
    root.add(ink.setX(8));
    text(scene, root, 47, y + 29, label, 21, "#fff3ce", "900").setStroke("#091420", 0);
  }
  text(scene, root, 330, 180, "この世界の\n物語は、", 30, "#35281e", "900", 200);
  text(scene, root, 322, 237, "あなたの選択から。", 22, "#35281e", "900", 228);
  // The home mock shows a close foreground hero, with the lower body behind HUD.
  fitted(scene, root, HERO_BACK_KEY, 157, 571, 460, 614);
  panel(scene, root, 186, 581, 314, 38, 0x0758a4, 0.96);
  text(scene, root, 186, 581, "新しい依頼が届いています", 21, "#ffffff", "900").setStroke("#091420", 1);
  requestCard(scene, root, 225, 656, 414, 112);
  bustWindow(scene, root, ELDER_KEY, 31, 618, 82, 78);
  const homeRequestTitle = text(scene, root, 260, 629, "", 21, "#3c2a1e", "900");
  const homeRequestBody = text(scene, root, 263, 674, "", 21, "#43382e", "700", 276);
  root.setData("refreshRequest", () => {
    homeRequestTitle.setText(scene.homeRequest ? FACTION_LABEL[scene.homeRequest.faction] : "新しい依頼");
    homeRequestBody.setText(scene.homeRequest?.text ?? "王都であなたの決断を待っています。");
  });
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
  const icons = scene.add.graphics().lineStyle(2, 0xf4dfaa, 1).fillStyle(0xf4dfaa, 1);
  icons.fillRect(40, 744, 24, 16).fillRect(40, 738, 5, 8).fillRect(50, 734, 5, 12).fillRect(59, 738, 5, 8);
  icons.fillStyle(0x102c52, 1).fillRect(49, 749, 6, 11).fillStyle(0xf4dfaa, 1);
  for (const x of [135, 315]) {
    icons.strokeCircle(x, 747, 13);
    icons.fillTriangle(x, 730, x - 5, 749, x + 5, 745);
    icons.fillTriangle(x, 764, x - 5, 749, x + 5, 745);
    icons.lineBetween(x - 18, 747, x + 18, 747);
  }
  for (const dx of [-11, 0, 11]) {
    icons.fillCircle(225 + dx, dx === 0 ? 738 : 742, dx === 0 ? 5 : 4);
    icons.fillRoundedRect(220 + dx, dx === 0 ? 746 : 750, 10, dx === 0 ? 14 : 10, 3);
  }
  icons.strokeRoundedRect(387, 741, 26, 20, 3).strokeRoundedRect(394, 733, 12, 12, 4);
  root.add(icons);
  for (const [i, label] of ["王都", "ワールド", "キャラ", "ガチャ", "ショップ"].entries()) {
    text(scene, root, [52, 135, 225, 315, 400][i] ?? 225, 775, label, 19, "#fff0c8", "900").setStroke("#091420", 0);
  }
  screenFrame(scene, root);
  const start = scene.add.zone(225, 660, 420, 112).setInteractive({ useHandCursor: true });
  let startArmed = false;
  start.on("pointerdown", () => { startArmed = true; });
  start.on("pointerout", () => { startArmed = false; });
  start.on("pointerup", () => { if (startArmed) { startArmed = false; invoke(scene, "startRun"); } });
  root.add(start);

  const modal = scene.add.container(0, 0).setName("home-information").setVisible(false);
  const veil = scene.add.graphics().fillStyle(0x030a14, 0.84).fillRect(0, 0, 450, 800);
  const blocker = scene.add.zone(225, 400, 450, 800).setInteractive();
  modal.add([veil, blocker]);
  requestCard(scene, modal, 225, 385, 398, 458);
  const heading = text(scene, modal, 225, 204, "", 30, "#35281e", "900", 340);
  const body = text(scene, modal, 225, 358, "", 23, "#43382e", "700", 330);
  button(scene, modal, 225, 551, 326, 80, "王都へ戻る", 0x0758a4, () => modal.setVisible(false), undefined, false);
  const show = (title: string, description: string) => {
    heading.setText(title);
    body.setText(description);
    modal.setVisible(true);
  };
  const character = () => {
    const stats = deriveStats(scene.karma ?? initialKarma());
    show("カイトの能力", `攻撃力  ${stats.atk}    防御力  ${stats.def}\n体力  ${stats.hp}    魔力  ${stats.magic}\n\n依頼への選択が\n勇者を育てます。`);
  };
  const routes = [
    () => modal.setVisible(false),
    () => show("王都ルナディス", "依頼を選び、勇者を送り出す。\n戦果を神々へ報告し、\n12年の物語を紡ぎます。\n\n王都の依頼カードから出発。"),
    character,
    () => show("ガチャ", "現在は利用できません。\n\n勇者は依頼への選択と\n冒険を通じて成長します。"),
    () => show("ショップ", "現在は利用できません。\n\n購入なしで冒険を進められます。"),
  ];
  const addRoute = (x: number, y: number, w: number, h: number, action: () => void) => {
    const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    let armed = false;
    hit.on("pointerdown", () => { armed = true; });
    hit.on("pointerout", () => { armed = false; });
    hit.on("pointerup", () => { if (armed) { armed = false; action(); } });
    root.add(hit);
  };
  routes.forEach((route, i) => addRoute(51 + i * 87, 758, 85, 68, route));
  const railRoutes = [
    () => show("冒険の案内", "依頼カードを押して出発。\n依頼への返答を選び、\n世界の反応を確認します。\n\n選択は指を離したときに確定。"),
    () => invoke(scene, "startRun"),
    character,
    () => show("持ち物", "持ち物の管理は\n現在は利用できません。\n\n装備なしで冒険を開始できます。"),
    () => show("四つの派閥", "戦士・商人・荒くれ・魔術師\n\n依頼に応じると派閥の力が増し、\n勇者の能力に反映されます。"),
  ];
  railRoutes.forEach((route, i) => addRoute(47, 137 + i * 69, 76, 66, route));
  root.add(modal);
  return root;
}

function buildChoice(scene: Runtime): Pick<MockUi, "choiceRoot" | "yearText" | "requestTitle" | "requestText" | "acceptLabel"> {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  cover(scene, root, BG_KEY, 0xe3d6bd);
  const shade = scene.add.graphics();
  shade.fillStyle(0x071017, 0.14).fillRect(0, 0, 450, 800);
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
  // Show the head and clasped hands at conversation distance; crop the robe
  // below them instead of shrinking the entire figure into the dialogue area.
  artWindow(scene, root, ELDER_KEY, npc.x, npc.y, npc.width, npc.height, 0);
  requestCard(scene, root, 290, 175, 304, 188);
  const requestBand = scene.add.graphics();
  requestBand.fillStyle(0x102c52, 1).fillRect(146, 93, 288, 41);
  requestBand.lineStyle(1, 0xb79451, 1).lineBetween(146, 134, 434, 134);
  root.add(requestBand);
  const requestTitle = text(scene, root, 290, 111, "", 20, "#35281e", "900", 270);
  const requestText = text(scene, root, 290, 197, "", 22, "#352f29", "700", 264).setAlign("left");
  requestTitle.setColor("#fff4d5");
  const acceptLabel = button(scene, root, 225, 598, 382, 80, "食料を支援する", 0x0758a4, () => invoke(scene, "onKarmaChoice", true), "依頼者の力になる");
  button(scene, root, 225, 694, 382, 80, "支援を断る", 0x981d25, () => invoke(scene, "onKarmaChoice", false), "他の三派閥がそれぞれ +1");
  text(scene, root, 225, 766, "「どんな選択にも、意味がある」", 17, "#fff3d0", "700");
  screenFrame(scene, root);
  return { choiceRoot: root, yearText, requestTitle, requestText, acceptLabel };
}

function buildLandscapeChoice(scene: Runtime): NonNullable<MockUi["landscapeChoice"]> {
  const root = scene.add.container(0, 0).setDepth(6100).setVisible(false);
  root.add(scene.add.graphics().fillStyle(0x07131e, 1).fillRect(0, 0, 800, 450));
  root.add(scene.add.zone(400, 225, 800, 450).setInteractive());
  artWindow(scene, root, BG_KEY, 8, 8, 374, 434);
  panel(scene, root, 195, 39, 354, 58, 0x0b1a29, 0.94);
  const yearText = text(scene, root, 195, 39, "", 22, "#fff4d0", "900");
  bustWindow(scene, root, "kq-hero-warrior", 12, 230, 183, 204);
  artWindow(scene, root, ELDER_KEY, 156, 126, 222, 308, 0);
  requestCard(scene, root, 591, 132, 390, 244);
  panel(scene, root, 591, 45, 366, 50, 0x102c52, 1);
  const requestTitle = text(scene, root, 591, 45, "", 22, "#fff4d5", "900", 338);
  const requestText = text(scene, root, 591, 157, "", 24, "#352f29", "700", 338).setAlign("left");
  const acceptLabel = button(scene, root, 591, 301, 382, 80, "依頼を引き受ける", 0x0758a4,
    () => invoke(scene, "onKarmaChoice", true), "依頼者の力になる");
  button(scene, root, 591, 397, 382, 80, "支援を断る", 0x981d25,
    () => invoke(scene, "onKarmaChoice", false), "他の三派閥がそれぞれ +1");
  const frame = scene.add.graphics().lineStyle(2, 0xe3bd69, 0.96).strokeRoundedRect(8, 8, 374, 434, 10);
  ornament(frame, 8, 8, 374, 434);
  root.add(frame);
  return { choiceRoot: root, yearText, requestTitle, requestText, acceptLabel };
}

function outcomeArt(scene: Runtime, root: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number): void {
  const art = scene.add.container(0, 0);
  root.add(art);
  let current = "";
  root.setData("refreshOutcomeArt", () => {
    const outcome = scene.lastOutcome;
    const key = outcome?.faction === "mage" ? MAGE_BG_KEY
      : outcome?.requestId === "village_food" && scene.lastAccepted ? REACTION_BG_KEY : HOME_BG_KEY;
    if (key === current) return;
    current = key;
    art.removeAll(true);
    artWindow(scene, art, key, x, y, width, height, key === MAGE_BG_KEY ? 0.25 : 0.5);
  });
}

function buildReaction(scene: Runtime, landscape = false): Pick<MockUi, "reactionRoot" | "reactionTitle" | "reactionBody" | "reactionQuote" | "reactionArrows" | "reactionResults"> {
  const screen = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  if (landscape) {
    const background = scene.add.graphics().fillStyle(0x07131e, 1).fillRect(0, 0, 800, 450);
    screen.add(background);
    outcomeArt(scene, screen, 8, 8, 350, 434);
    requestCard(scene, screen, 183, 49, 334, 72);
  } else {
    cover(scene, screen, HOME_BG_KEY);
    outcomeArt(scene, screen, 12, 88, 426, 296);
    requestCard(scene, screen, 225, 49, 414, 72);
  }
  text(scene, screen, landscape ? 183 : 225, 29, "", 18, "#35281e", "800").setName("reactionYear");
  text(scene, screen, landscape ? 183 : 225, 61, "選択の結果", 30, "#35281e", "900");
  const root = scene.add.container(landscape ? 354 : 0, landscape ? -374 : 0);
  screen.add(root);
  panel(scene, root, 225, landscape ? 616 : 587, 408, landscape ? 348 : 406, 0xf7efd9, 0.98);
  const reactionTitle = text(scene, root, 225, landscape ? 470 : 415, "", 28, "#35281e", "900");
  const reactionBody = text(scene, root, 225, landscape ? 518 : 472, "", 21, "#43382e", "700", 378).setName("reactionBody");
  const reactionQuote = text(scene, root, 225, landscape ? 558 : 526, "", 18, "#6a4a2a", "700", 370).setName("reactionQuote");
  const effectRows = [
    effectRow(scene, root, landscape ? 590 : 565, 0x245e9b, "戦士", "→", "変化なし"),
    effectRow(scene, root, landscape ? 620 : 603, 0x2f8c4b, "商人", "→", "変化なし"),
    effectRow(scene, root, landscape ? 650 : 641, 0xa32d34, "荒くれ", "→", "変化なし"),
    effectRow(scene, root, landscape ? 680 : 679, 0x7a5899, "魔術師", "→", "変化なし"),
  ];
  button(scene, root, 225, 750, 328, 80, "次へ", 0x0758a4, () => {
    if (scene.phase !== "reaction") return;
    scene.reactionUntil = 0;
    invoke(scene, "continueAfterReaction");
  });
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
  text(scene, root, 225, 86, "あなたが紡いだ、この世界の物語", 19, "#fffaf0", "700").setStroke("#091420", 0);
  requestCard(scene, root, 225, 215, 388, 194);
  outcomeArt(scene, root, 45, 140, 124, 154);
  const eventTitle = text(scene, root, 290, 154, "", 22, "#35281e", "900", 226).setName("chronicleTitle");
  const eventBody = text(scene, root, 292, 244, "", 21, "#43382e", "700", 222).setName("chronicleBody");
  requestCard(scene, root, 225, 362, 388, 86);
  const previousTitle = text(scene, root, 225, 343, "", 21, "#35281e", "900", 350);
  const recordCount = text(scene, root, 225, 381, "", 21, "#43382e", "700", 350);
  artWindow(scene, root, BG_KEY, 34, 412, 382, 108);
  panel(scene, root, 225, 492, 382, 54, 0x102c52, 0.9);
  text(scene, root, 225, 491, "王都ルナディス — 始まりの街", 21, "#fffaf0", "900").setStroke("#091420", 1);
  bustWindow(scene, root, "kq-hero-warrior", 40, 535, 157, 133);
  text(scene, root, 303, 542, "カイトの能力", 23, "#35281e", "900");
  const stats = [
    metricChip(scene, root, 264, 589, "攻撃", "", 0x2e6ba3),
    metricChip(scene, root, 362, 589, "防御", "", 0xb84a63),
    metricChip(scene, root, 264, 633, "体力", "", 0x70529a),
    metricChip(scene, root, 362, 633, "魔力", "", 0xb48727),
  ];
  root.setData("refreshChronicle", () => {
    const history = scene.choiceHistory ?? [];
    const latest = history.at(-1);
    const previous = history.at(-2);
    eventTitle.setText(latest ? `${latest.year}年目\n${latest.outcome.title}` : "旅の記録");
    eventBody.setText(latest?.outcome.body.replace(/\n/g, "") ?? "まだ選択の記録がありません。");
    previousTitle.setText(previous ? `${previous.year}年目 · ${previous.outcome.title}` : "次の旅も、あなたの選択から");
    recordCount.setText(`この旅で刻んだ選択：${history.length}件`);
    const values = deriveStats(scene.karma ?? initialKarma());
    [values.atk, values.def, values.hp, values.magic].forEach((value, i) => stats[i]?.setText(String(value)));
  });
  button(scene, root, 225, 719, 360, 80, "もう一度旅に出る", 0x0758a4, () => invoke(scene, "startRun"));
  screenFrame(scene, root);
  return root;
}

function buildLandscapeOverview(scene: Runtime, final: boolean): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(6200).setVisible(false);
  root.add(scene.add.graphics().fillStyle(0x07131e, 1).fillRect(0, 0, 800, 450));
  root.add(scene.add.zone(400, 225, 800, 450).setInteractive());
  artWindow(scene, root, HOME_BG_KEY, 8, 8, 374, 434);
  panel(scene, root, 195, 43, 350, 62, 0x102c52, 0.98);
  text(scene, root, 195, 43, final ? "カイトの能力" : "王都ルナディス", 28, "#fffaf0", "900");
  if (final) {
    bustWindow(scene, root, "kq-hero-warrior", 38, 85, 310, 215);
    requestCard(scene, root, 195, 367, 346, 134);
  } else {
    fitted(scene, root, HERO_BACK_KEY, 178, 267, 340, 380);
    panel(scene, root, 195, 399, 350, 66, 0x102c52, 0.96);
    text(scene, root, 195, 399, "この世界の物語は、\nあなたの選択から。", 23, "#fffaf0", "900");
  }
  const statValues = final ? [
    metricChip(scene, root, 133, 337, "攻撃", "", 0x2e6ba3),
    metricChip(scene, root, 253, 337, "防御", "", 0xb84a63),
    metricChip(scene, root, 133, 395, "体力", "", 0x70529a),
    metricChip(scene, root, 253, 395, "魔力", "", 0xb48727),
  ] : [];
  requestCard(scene, root, 591, 176, 390, 336);
  panel(scene, root, 591, 43, 366, 52, 0x102c52, 1);
  text(scene, root, 591, 43, final ? "年代記" : "王都に届いた依頼", 28, "#fffaf0", "900");
  const status = text(scene, root, 591, 86, "", 20, "#43382e", "700", 338);
  const heading = text(scene, root, 591, 136, "", 23, "#35281e", "900", 338);
  const body = text(scene, root, 591, 218, "", 23, "#43382e", "700", 338);
  const footer = text(scene, root, 591, 302, "", 20, "#43382e", "700", 338);
  button(scene, root, 591, 397, 382, 80, final ? "もう一度旅に出る" : "依頼を聞く", 0x0758a4,
    () => invoke(scene, "startRun"));
  const frame = scene.add.graphics().lineStyle(2, 0xe3bd69, 0.96).strokeRoundedRect(8, 8, 374, 434, 10);
  ornament(frame, 8, 8, 374, 434);
  root.add(frame);
  root.setData("refreshOverview", () => {
    if (final) {
      const history = scene.choiceHistory ?? [];
      const latest = history.at(-1), previous = history.at(-2);
      status.setText(`この旅で刻んだ選択：${history.length}件`);
      heading.setText(latest ? `${latest.year}年目 · ${latest.outcome.title}` : "旅の記録");
      body.setText(latest?.outcome.body.replace(/\n/g, "") ?? "まだ選択の記録がありません。");
      footer.setText(previous ? `${previous.year}年目 · ${previous.outcome.title}` : "次の旅も、あなたの選択から");
      const stats = deriveStats(scene.karma ?? initialKarma());
      [stats.atk, stats.def, stats.hp, stats.magic].forEach((value, i) => statValues[i]?.setText(String(value)));
    } else {
      status.setText(`最高到達 ${loadBestStage()}年`);
      heading.setText(scene.homeRequest ? FACTION_LABEL[scene.homeRequest.faction] : "新しい依頼");
      body.setText(scene.homeRequest?.text ?? "王都であなたの決断を待っています。");
      footer.setText(`累計評価 ${loadTotalEvaluation()}`);
    }
  });
  return root;
}

function build(scene: Runtime): MockUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const titleRoot = buildTitle(scene);
  const choice = buildChoice(scene);
  const reaction = buildReaction(scene);
  const finalRoot = buildFinal(scene);
  const ui = { titleRoot, ...choice, ...reaction, finalRoot, landscapeTitle: buildLandscapeOverview(scene, false), landscapeFinal: buildLandscapeOverview(scene, true), landscapeChoice: buildLandscapeChoice(scene), landscapeReaction: buildReaction(scene, true) };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  for (const root of [ui.reactionRoot, ui.landscapeReaction?.reactionRoot, ui.finalRoot]) {
    const refreshArt = root?.getData("refreshOutcomeArt") as (() => void) | undefined;
    refreshArt?.();
  }
  for (const [root, phase] of [[ui.landscapeTitle, "title"], [ui.landscapeFinal, "final"]] as const) {
    root?.setVisible(!portrait && scene.phase === phase);
    if (root?.visible) (root.getData("refreshOverview") as () => void)();
  }
  ui.titleRoot.setVisible(portrait && scene.phase === "title");
  if (scene.phase === "title") (ui.titleRoot.getData("refreshRequest") as () => void)();
  ui.choiceRoot.setVisible(portrait && scene.phase === "karma");
  ui.landscapeChoice?.choiceRoot.setVisible(!portrait && scene.phase === "karma");
  ui.reactionRoot.setVisible(portrait && scene.phase === "reaction");
  ui.landscapeReaction?.reactionRoot.setVisible(!portrait && scene.phase === "reaction");
  for (const root of [ui.reactionRoot, ui.landscapeReaction?.reactionRoot]) {
    (root?.getByName("reactionYear") as Phaser.GameObjects.Text | null)?.setText(`${scene.stage ?? 1}年目  春`);
  }
  ui.finalRoot.setVisible(portrait && scene.phase === "final");
  if (scene.phase === "final") (ui.finalRoot.getData("refreshChronicle") as () => void)();
  if (scene.lastOutcome) {
    const outcome = scene.lastOutcome;
    ui.reactionTitle.setText(outcome.title);
    ui.reactionBody.setText(outcome.body);
    ui.reactionQuote.setText(outcome.quote);
    outcome.deltas.forEach((delta, i) => {
      ui.reactionArrows[i]?.setText(delta > 0 ? "↑" : delta < 0 ? "↓" : "→").setColor(delta > 0 ? "#16864f" : delta < 0 ? "#b1262c" : "#6d685f");
      ui.reactionResults[i]?.setText(delta === 0 ? "変化なし" : `${delta > 0 ? "+" : ""}${delta}`);
    });
  }
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
  if (scene.phase !== "karma") return;
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
  const detail = ui.acceptLabel.getData("detailText") as Phaser.GameObjects.Text | undefined;
  const factionNames = { warrior: "戦士", merchant: "商人", outlaw: "荒くれ", mage: "魔術師" };
  detail?.setText(request ? `${factionNames[request.faction]}の力 +${request.karmaDelta}・勇者が成長` : "依頼者の力になる");
  const wideChoice = ui.landscapeChoice;
  if (wideChoice) {
    wideChoice.yearText.setText(ui.yearText.text);
    wideChoice.requestTitle.setText(ui.requestTitle.text);
    wideChoice.requestText.setText(ui.requestText.text);
    wideChoice.acceptLabel.setText(ui.acceptLabel.text);
    (wideChoice.acceptLabel.getData("detailText") as Phaser.GameObjects.Text).setText(detail?.text ?? "");
  }
}

export function installKarmaConceptArtPass(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalStart = proto.startRun;
  if (originalStart && !proto.__visualMockStart) {
    proto.__visualMockStart = originalStart;
    proto.startRun = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const runtime = this as Runtime;
      runtime.choiceHistory = [];
      runtime.lastOutcome = undefined;
      runtime.lastAccepted = undefined;
      runtime.reactionUntil = 0;
      return originalStart.apply(this, args);
    };
  }
  const originalPreload = proto.preload;
  if (!proto.__visualMockPreload) {
    proto.__visualMockPreload = originalPreload ?? (() => undefined);
    proto.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload?.apply(this, args);
      this.load.image(BG_KEY, `images/${BG_KEY}.png`);
      this.load.image(HOME_BG_KEY, `images/${HOME_BG_KEY}.png`);
      this.load.image(HERO_BACK_KEY, `images/${HERO_BACK_KEY}.png`);
      this.load.image(ELDER_KEY, `images/${ELDER_KEY}.png`);
      this.load.image(REACTION_BG_KEY, `images/${REACTION_BG_KEY}.png`);
      this.load.image(MAGE_BG_KEY, `images/${MAGE_BG_KEY}.png`);
      return result;
    };
  }
  const originalChoice = proto.onKarmaChoice;
  if (originalChoice && !proto.__visualMockChoice) {
    proto.__visualMockChoice = originalChoice;
    proto.onKarmaChoice = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const runtime = this as Runtime;
      if (runtime.phase !== "karma" || !runtime.currentRequest || !runtime.karma) return undefined;
      const request = { ...runtime.currentRequest };
      const before = { ...runtime.karma };
      const result = originalChoice.apply(this, args);
      runtime.lastAccepted = args[0] === true;
      runtime.lastOutcome = requestOutcome(request, runtime.lastAccepted, before, runtime.karma);
      (runtime.choiceHistory ??= []).push({ year: runtime.stage ?? 1, outcome: runtime.lastOutcome });
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
