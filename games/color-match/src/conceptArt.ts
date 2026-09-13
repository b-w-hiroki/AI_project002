import Phaser from "phaser";
import { CHALLENGE_MS, nextSwitchAt } from "./logic/challenge";
import {
  COLORS,
  TURBO_ENTRY_STREAK,
  hexForColorId,
  nameForColorId,
  type Round,
  type WritingMode,
} from "./logic/round";
import { loadBestScore } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "playing" | "result";
  sessionRemaining?: number;
  currentRound?: Round | null;
  roundIndex?: number;
  turboStreak?: number;
  turboPoints?: number;
  writingMode?: WritingMode;
  results?: Array<{ correct?: boolean }>;
  accepting?: boolean;
};

type CardView = {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
};

type ArcadeUi = {
  root: Phaser.GameObjects.Container;
  timerRing: Phaser.GameObjects.Graphics;
  timerText: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  ruleText: Phaser.GameObjects.Text;
  promptText: Phaser.GameObjects.Text;
  chainText: Phaser.GameObjects.Text;
  nextText: Phaser.GameObjects.Text;
  cards: CardView[];
  mascot?: Phaser.GameObjects.Image;
};

const uiByScene = new WeakMap<object, ArcadeUi>();

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...values: unknown[]) => unknown).apply(scene, args) : undefined;
}

function text(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight = "800",
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
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
  radius = 16,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x15325c, 0.18).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.2).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.16), radius * 0.72);
  g.lineStyle(2, border, 0.84).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function makeSky(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x2399ef, 0x2ab4f5, 0xdaf8ff, 0xbfe9ff, 1, 1, 1, 1).fillRect(0, 0, 450, 800);
  // Distant fantasy city and clouds: code-native scenery so the play field feels like a world, not a form.
  g.fillStyle(0xffffff, 0.58);
  [[65,110,42],[112,92,55],[355,118,62],[405,95,42],[215,188,64]].forEach(([x,y,r]) => g.fillCircle(x!, y!, r!));
  g.fillStyle(0xe8f7ff, 0.92);
  g.fillTriangle(238, 320, 270, 204, 302, 320);
  g.fillTriangle(290, 320, 326, 178, 360, 320);
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(250, 275, 100, 72);
  for (const x of [260, 285, 310, 338]) {
    g.fillRect(x, 220, 12, 58);
    g.fillTriangle(x - 4, 220, x + 6, 194, x + 16, 220);
  }
  g.fillStyle(0x72c47e, 0.9).fillRect(0, 655, 450, 145);
  g.fillStyle(0x58b96b, 0.72).fillCircle(65, 675, 90).fillCircle(180, 700, 110).fillCircle(360, 680, 120);
  // Rainbow arcs.
  [0xe0447a,0xd97a2b,0xd6a71a,0x1f8a63,0x2f8fd1,0x8a4fd1].forEach((color, i) => {
    g.lineStyle(7, color, 0.28).beginPath().arc(220, 680, 220 - i * 8, Math.PI * 1.08, Math.PI * 1.92).strokePath();
  });
  // Floating stars.
  const stars = [[36,250],[405,235],[50,595],[390,570],[108,360],[342,370],[210,620]];
  stars.forEach(([x,y],i) => {
    g.fillStyle([0xffe36c,0xff93c8,0x9aebff,0xb4f79b][i % 4]!, 0.72).fillCircle(x!, y!, 7);
  });
  root.add(g);
}

function build(scene: Runtime): ArcadeUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(1800).setVisible(false);
  makeSky(scene, root);

  text(scene, root, 20, 28, "カラーマッチ", 29, "#ffffff", "900").setOrigin(0, 0.5).setStroke("#235bc4", 6);
  text(scene, root, 22, 57, "Color Match — 色と文字の反射神経", 9, "#eef9ff", "800").setOrigin(0, 0.5);

  panel(scene, root, 352, 42, 160, 54, 0x153e6a, 0xffd463, 0.96, 12);
  text(scene, root, 352, 29, "SCORE", 9, "#d8ecff", "900");
  const scoreText = text(scene, root, 352, 48, "0000", 23, "#fff0a6", "900");

  const timerRing = scene.add.graphics();
  root.add(timerRing);
  const timerText = text(scene, root, 70, 151, "60", 36, "#ffffff", "900");
  text(scene, root, 70, 119, "TIME", 9, "#d7f3ff", "900");

  panel(scene, root, 270, 151, 280, 100, 0x144f82, 0x8ce5ff, 0.96, 15);
  text(scene, root, 270, 122, "お題", 10, "#d8f5ff", "900");
  const ruleText = text(scene, root, 270, 149, "", 18, "#ffffff", "900");
  text(scene, root, 270, 178, "正しい色カードをタップ！", 10, "#d7f2ff", "800");

  panel(scene, root, 225, 278, 250, 112, 0xffffff, 0x8ac8f4, 0.97, 16);
  const promptText = text(scene, root, 225, 278, "", 46, "#273d5b", "900");

  const chainText = text(scene, root, 378, 245, "0\nCHAIN!", 23, "#ff5f8f", "900").setStroke("#ffffff", 5).setAngle(-4);

  const cardXs = [80, 225, 370];
  const cardYs = [430, 545];
  const cards: CardView[] = [];
  COLORS.forEach((color, i) => {
    const x = cardXs[i % 3]!;
    const y = cardYs[Math.floor(i / 3)]!;
    const bg = scene.add.graphics();
    const paint = (pressed = false) => {
      bg.clear();
      bg.fillStyle(0x14375b, 0.12).fillRoundedRect(x - 59 + 3, y - 45 + 5, 118, 90, 14);
      bg.fillStyle(0xffffff, pressed ? 0.84 : 0.96).fillRoundedRect(x - 59, y - 45, 118, 90, 14);
      bg.fillStyle(color.hex, 0.07).fillCircle(x + 29, y - 18, 20);
      bg.lineStyle(pressed ? 5 : 3, color.hex, 0.95).strokeRoundedRect(x - 59, y - 45, 118, 90, 14);
    };
    paint();
    root.add(bg);
    const label = text(scene, root, x, y, "", 20, `#${color.hex.toString(16).padStart(6, "0")}`, "900");
    const hit = scene.add.zone(x, y, 118, 90).setInteractive({ useHandCursor: true });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (scene.phase !== "playing" || scene.accepting === false) return;
      paint(true);
      invoke(scene, "finishRound", color.id);
    });
    hit.on("pointerup", () => paint(false));
    hit.on("pointerout", () => paint(false));
    cards.push({ bg, label, hit });
  });

  let mascot: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("cm-mascot")) {
    mascot = scene.add.image(376, 654, "cm-mascot").setDisplaySize(118, 118);
    root.add(mascot);
    scene.tweens.add({ targets: mascot, y: 646, duration: 950, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  panel(scene, root, 192, 704, 334, 62, 0x153d68, 0x79cff7, 0.94, 14);
  text(scene, root, 46, 686, "NEXT", 9, "#bdeaff", "900").setOrigin(0, 0.5);
  const nextText = text(scene, root, 192, 709, "", 12, "#ffffff", "900");

  const ui = { root, timerRing, timerText, scoreText, ruleText, promptText, chainText, nextText, cards, mascot };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "playing";
  ui.root.setVisible(active);
  if (!active || !scene.currentRound) return;

  const remaining = Phaser.Math.Clamp(scene.sessionRemaining ?? CHALLENGE_MS, 0, CHALLENGE_MS);
  const secs = Math.max(0, Math.ceil(remaining / 1000));
  const ratio = remaining / CHALLENGE_MS;
  const danger = secs <= 10;
  const elapsed = CHALLENGE_MS - remaining;
  const until = Math.max(0, nextSwitchAt(elapsed) - elapsed);
  const round = scene.currentRound;
  const mode = scene.writingMode ?? "hiragana";
  const streak = scene.turboStreak ?? 0;
  const correct = scene.results?.filter((r) => r.correct).length ?? 0;
  const score = correct * 100 + (scene.turboPoints ?? 0) * 10;

  ui.timerRing.clear();
  ui.timerRing.fillStyle(0x103a64, 0.94).fillCircle(70, 151, 49);
  ui.timerRing.lineStyle(8, danger ? 0xff5f78 : 0x74e9ff, 0.28).strokeCircle(70, 151, 48);
  ui.timerRing.lineStyle(8, danger ? 0xff5f78 : 0x39d8ff, 1).beginPath().arc(70, 151, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio).strokePath();
  ui.timerText.setText(String(secs));
  ui.timerText.setColor(danger ? "#ffd0d8" : "#ffffff");
  ui.scoreText.setText(String(score).padStart(4, "0"));
  ui.ruleText.setText(round.judgeMode === "color" ? "『文字の色』を見る" : "『文字の意味』を見る");
  ui.promptText.setText(nameForColorId(round.promptWord, mode)).setColor(`#${hexForColorId(round.promptInk).toString(16).padStart(6, "0")}`);
  ui.chainText.setText(`${streak}\n${streak >= TURBO_ENTRY_STREAK ? "FLOW!" : "CHAIN!"}`);
  ui.chainText.setColor(streak >= TURBO_ENTRY_STREAK ? "#ff7a3d" : "#ff5f8f");
  ui.nextText.setText(until <= 2000 ? "ルール切替まもなく！" : `次のルールまで ${Math.ceil(until / 1000)}秒  ·  BEST ${loadBestScore()}`);
  ui.cards.forEach((card, i) => card.label.setText(nameForColorId(COLORS[i]!.id, mode)));
}

export function installColorConceptArtPass(): void {
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
