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
import { tr, type Lang } from "./logic/i18n";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  lang?: Lang;
  phase?: "title" | "playing" | "result";
  sessionMode?: "challenge" | "practice";
  sessionRemaining?: number;
  sessionDurationMs?: number;
  practiceJudgeMode?: "content" | "color";
  currentRound?: Round | null;
  roundIndex?: number;
  turboStreak?: number;
  turboPoints?: number;
  writingMode?: WritingMode;
  results?: Array<{ correct?: boolean }>;
  accepting?: boolean;
};

type CardView = {
  colorId: string;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
};

type ArcadeUi = {
  root: Phaser.GameObjects.Container;
  timerRing: Phaser.GameObjects.Graphics;
  timerText: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  progressText: Phaser.GameObjects.Text;
  ruleText: Phaser.GameObjects.Text;
  promptText: Phaser.GameObjects.Text;
  chainText: Phaser.GameObjects.Text;
  nextLabel: Phaser.GameObjects.Text;
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

  text(scene, root, 20, 28, tr(scene.lang ?? "en", "カラーマッチ", "Color Match"), 29, "#ffffff", "900").setOrigin(0, 0.5).setStroke("#235bc4", 6);
  text(scene, root, 22, 57, tr(scene.lang ?? "en", "Color Match — 色と文字の反射神経", "Color Match — Reflex Arcade"), 9, "#eef9ff", "800").setOrigin(0, 0.5);

  panel(scene, root, 352, 42, 160, 54, 0x153e6a, 0xffd463, 0.96, 12);
  text(scene, root, 352, 29, "SCORE", 9, "#d8ecff", "900");
  const scoreText = text(scene, root, 352, 48, "0000", 23, "#fff0a6", "900");

  // Approved mock header, drawn above the legacy title chrome.
  const header = scene.add.graphics();
  header.fillGradientStyle(0x172e63, 0x204d8a, 0x142956, 0x18386c, 1, 1, 1, 1).fillRect(0, 0, 450, 92);
  header.lineStyle(3, 0xffd66f, 0.9).lineBetween(0, 90, 450, 90);
  header.fillStyle(0xffd66f, 1).fillCircle(44, 44, 29);
  header.fillStyle(0x254c89, 1).fillCircle(44, 44, 23);
  root.add(header);
  text(scene, root, 44, 44, "2", 27, "#fff6c7", "900");
  text(scene, root, 82, 33, tr(scene.lang ?? "en", "メインゲーム", "MAIN GAME"), 23, "#ffffff", "900").setOrigin(0, 0.5);
  text(scene, root, 84, 62, tr(scene.lang ?? "en", "色とことばを見極めよう", "JUDGMENT PLAY"), 11, "#cdeaff", "800").setOrigin(0, 0.5);
  panel(scene, root, 374, 46, 126, 58, 0x102f5c, 0xffd463, 0.96, 12);
  text(scene, root, 374, 31, "SCORE", 9, "#d8ecff", "900");
  const approvedScoreText = text(scene, root, 374, 53, "0000", 23, "#fff0a6", "900");
  scoreText.setVisible(false);

  const timerRing = scene.add.graphics();
  root.add(timerRing);
  const timerText = text(scene, root, 86, 158, "60", 36, "#ffffff", "900");
  text(scene, root, 86, 123, "TIME", 9, "#d7f3ff", "900");

  panel(scene, root, 270, 151, 280, 100, 0x144f82, 0x8ce5ff, 0.96, 15);
  text(scene, root, 270, 122, tr(scene.lang ?? "en", "お題", "PROMPT"), 10, "#d8f5ff", "900");
  const ruleText = text(scene, root, 270, 149, "", 18, "#ffffff", "900");
  text(scene, root, 270, 178, tr(scene.lang ?? "en", "正しい色カードをタップ！", "Tap the correct color card!"), 10, "#d7f2ff", "800");

  panel(scene, root, 225, 278, 250, 112, 0xfffbec, 0xf4c85f, 0.98, 16);
  const promptText = text(scene, root, 225, 278, "", 46, "#273d5b", "900");

  // Larger status and problem cards follow the approved hierarchy.
  panel(scene, root, 292, 150, 266, 88, 0x144f82, 0x8ce5ff, 0.98, 15);
  const progressText = text(scene, root, 292, 121, "QUESTION 1", 10, "#d8f5ff", "900");
  const approvedRuleText = text(scene, root, 292, 150, "", 18, "#ffffff", "900");
  text(scene, root, 292, 177, "Tap the correct color!", 10, "#d7f2ff", "800");
  panel(scene, root, 225, 287, 330, 126, 0xfffbec, 0xf4c85f, 0.99, 20);
  const approvedPromptText = text(scene, root, 225, 288, "", 50, "#273d5b", "900");
  ruleText.setVisible(false);
  promptText.setVisible(false);

  const chainText = text(scene, root, 373, 344, "0\nCHAIN!", 21, "#ff5f8f", "900").setStroke("#ffffff", 5).setAngle(-7);

  const cardXs = [108, 342];
  const cardYs = [438, 548, 658];
  const displayColors = [COLORS[0]!, COLORS[1]!, COLORS[3]!, COLORS[2]!, COLORS[4]!, COLORS[5]!];
  const cards: CardView[] = [];
  displayColors.forEach((color, i) => {
    const x = cardXs[i % 2]!;
    const y = cardYs[Math.floor(i / 2)]!;
    const bg = scene.add.graphics();
    const paint = (pressed = false) => {
      bg.clear();
      bg.fillStyle(0x102a49, 0.34).fillRoundedRect(x - 90 + 5, y - 44 + 8, 180, 88, 17);
      bg.fillStyle(color.hex, pressed ? 0.78 : 0.96).fillRoundedRect(x - 90, y - 44, 180, 88, 17);
      bg.fillStyle(0xffffff, 0.22).fillRoundedRect(x - 83, y - 37, 166, 17, 11);
      bg.lineStyle(pressed ? 5 : 3, 0xffe58a, 0.96).strokeRoundedRect(x - 90, y - 44, 180, 88, 17);
      bg.lineStyle(1, 0xffffff, 0.55).strokeRoundedRect(x - 83, y - 37, 166, 74, 12);
    };
    paint();
    root.add(bg);
    const label = text(scene, root, x, y, "", 21, "#ffffff", "900").setStroke("#173453", 3);
    bg.setName(`portrait-answer-card-${i}-${color.id}`);
    const hit = scene.add.zone(x, y, 180, 88).setName(`portrait-answer-hit-${i}-${color.id}`).setInteractive({ useHandCursor: true });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (scene.phase !== "playing" || scene.accepting === false) return;
      paint(true);
      invoke(scene, "finishRound", color.id);
    });
    hit.on("pointerup", () => paint(false));
    hit.on("pointerout", () => paint(false));
    cards.push({ colorId: color.id, bg, label, hit });
  });

  let mascot: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("cm-mascot")) {
    mascot = scene.add.image(52, 754, "cm-mascot").setDisplaySize(72, 72);
    root.add(mascot);
    scene.tweens.add({ targets: mascot, y: 748, duration: 950, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  panel(scene, root, 270, 760, 330, 48, 0x153d68, 0x79cff7, 0.94, 14);
  const nextLabel = text(scene, root, 120, 747, "NEXT", 9, "#bdeaff", "900")
    .setOrigin(0, 0.5)
    .setName("portrait-session-context");
  const nextText = text(scene, root, 278, 764, "", 11, "#ffffff", "900")
    .setName("portrait-session-guidance");

  const ui = { root, timerRing, timerText, scoreText: approvedScoreText, progressText, ruleText: approvedRuleText, promptText: approvedPromptText, chainText, nextLabel, nextText, cards, mascot };
  uiByScene.set(scene, ui);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => uiByScene.delete(scene));
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "playing";
  ui.root.setVisible(active);
  if (!active || !scene.currentRound) return;

  const duration = scene.sessionDurationMs ?? CHALLENGE_MS;
  const remaining = Phaser.Math.Clamp(scene.sessionRemaining ?? duration, 0, duration);
  const secs = Math.max(0, Math.ceil(remaining / 1000));
  const ratio = duration > 0 ? remaining / duration : 0;
  const danger = secs <= 10;
  const elapsed = duration - remaining;
  const until = scene.sessionMode === "practice" ? 0 : Math.max(0, nextSwitchAt(elapsed) - elapsed);
  const round = scene.currentRound;
  const mode = scene.writingMode ?? "hiragana";
  const streak = scene.turboStreak ?? 0;
  const correct = scene.results?.filter((r) => r.correct).length ?? 0;
  const score = correct * 100 + (scene.turboPoints ?? 0) * 10;

  ui.timerRing.clear();
  ui.timerRing.fillStyle(0x103a64, 0.94).fillCircle(86, 158, 49);
  ui.timerRing.lineStyle(8, danger ? 0xff5f78 : 0x74e9ff, 0.28).strokeCircle(86, 158, 48);
  ui.timerRing.lineStyle(8, danger ? 0xff5f78 : 0x39d8ff, 1).beginPath().arc(86, 158, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio).strokePath();
  ui.timerText.setText(String(secs));
  ui.timerText.setColor(danger ? "#ffd0d8" : "#ffffff");
  ui.scoreText.setText(String(score).padStart(4, "0"));
  ui.progressText.setText(`${scene.sessionMode === "practice" ? "PRACTICE" : "QUESTION"} ${scene.roundIndex ?? 1}`);
  ui.ruleText.setText(round.judgeMode === "color" ? tr(scene.lang ?? "en", "『文字の色』を見る", "Watch INK COLOR") : tr(scene.lang ?? "en", "『文字の意味』を見る", "Watch WORD MEANING"));
  ui.promptText.setText(nameForColorId(round.promptWord, mode)).setColor(`#${hexForColorId(round.promptInk).toString(16).padStart(6, "0")}`);
  ui.chainText.setText(`${streak}\n${streak >= TURBO_ENTRY_STREAK ? "FLOW!" : "CHAIN!"}`);
  ui.chainText.setColor(streak >= TURBO_ENTRY_STREAK ? "#ff7a3d" : "#ff5f8f");
  if (scene.sessionMode === "practice") {
    ui.nextLabel.setText("PRACTICE");
    ui.nextText.setText(
      scene.practiceJudgeMode === "color"
        ? tr(scene.lang ?? "en", "文字の色だけで判断", "INK COLOR only")
        : tr(scene.lang ?? "en", "文字の意味だけで判断", "WORD MEANING only"),
    );
  } else {
    ui.nextLabel.setText("NEXT");
    ui.nextText.setText(until <= 2000 ? tr(scene.lang ?? "en", "ルール切替まもなく！", "RULE SHIFT SOON!") : `${tr(scene.lang ?? "en", "次のルールまで", "NEXT RULE IN")} ${Math.ceil(until / 1000)}${tr(scene.lang ?? "en", "秒", "s")} · BEST ${loadBestScore()}`);
  }
  ui.cards.forEach((card) => card.label.setText(nameForColorId(card.colorId, mode)));
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
