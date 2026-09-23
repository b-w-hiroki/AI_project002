import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { CHALLENGE_MS, nextSwitchAt, type ChallengeResult } from "./logic/challenge";
import {
  COLORS,
  TURBO_ENTRY_STREAK,
  WRITING_MODES,
    hexForColorId,
  nameForColorId,
  summarizeSession,
  type Round,
  type WritingMode,
} from "./logic/round";
import {
  loadBestScore,
  loadBestTurbo,
  loadPerformanceStats,
  metricAccuracy,
  metricAvgReaction,
} from "./logic/progress";
import { GameScene } from "./scenes/GameScene";
import { tr, writingModeLabel, type Lang } from "./logic/i18n";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  lang?: Lang;
  phase?: "title" | "playing" | "result";
  sessionRemaining?: number;
  sessionDurationMs?: number;
  sessionMode?: "challenge" | "practice";
  practiceJudgeMode?: "content" | "color";
  currentRound?: Round | null;
  turboStreak?: number;
  turboPoints?: number;
  writingMode?: WritingMode;
  results?: ChallengeResult[];
  accepting?: boolean;
};

type AnswerView = {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
};

type LandscapeUi = {
  root: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Container;
  play: Phaser.GameObjects.Container;
  result: Phaser.GameObjects.Container;
  flowGlow: Phaser.GameObjects.Graphics;
  timerRing: Phaser.GameObjects.Graphics;
  timerText: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  ruleText: Phaser.GameObjects.Text;
  promptText: Phaser.GameObjects.Text;
  chainText: Phaser.GameObjects.Text;
  nextText: Phaser.GameObjects.Text;
  answers: AnswerView[];
  resultHeading: Phaser.GameObjects.Text;
  resultStats: Phaser.GameObjects.Text;
  titleMode: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, LandscapeUi>();

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...values: unknown[]) => unknown).apply(scene, args) : undefined;
}

function text(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#ffffff",
  weight = "800",
): Phaser.GameObjects.Text {
  const node = scene.add.text(x, y, value, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
  }).setOrigin(0.5);
  parent.add(node);
  return node;
}

function panel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 0x164c7b,
  border = 0x8fe6ff,
  alpha = 0.96,
  radius = 16,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x12335c, 0.18).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.16).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.15), radius * 0.72);
  g.lineStyle(2, border, 0.82).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  parent.add(g);
  return g;
}

function button(
  scene: Runtime,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  action: () => void,
  color = 0xff7a3d,
): void {
  const g = scene.add.graphics();
  const paint = (pressed = false) => {
    g.clear();
    g.fillStyle(0x15325c, 0.18).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 14);
    g.fillStyle(pressed ? Phaser.Display.Color.ValueToColor(color).darken(12).color : color, 0.98)
      .fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.lineStyle(2, 0xffffff, 0.66).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
  };
  paint();
  parent.add(g);
  text(scene, parent, x, y, label, 17, "#ffffff", "900");
  const hit = scene.add.zone(x, y, w, Math.max(52, h)).setInteractive({ useHandCursor: true });
  parent.add(hit);
  hit.on("pointerdown", () => { paint(true); action(); });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
}

function sky(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1b8fe3, 0x35bdf4, 0xc8f5ff, 0x9edcf4, 1, 1, 1, 1).fillRect(0, 0, 800, 450);
  g.fillStyle(0xffffff, 0.5);
  [[90, 78, 44], [165, 62, 56], [635, 82, 62], [730, 62, 48]].forEach(([x, y, r]) => g.fillCircle(x!, y!, r!));
  g.fillStyle(0x73c887, 0.92).fillRect(0, 360, 800, 90);
  g.fillStyle(0x5ab46d, 0.75).fillCircle(90, 390, 95).fillCircle(300, 408, 110).fillCircle(690, 390, 120);
  [0xf15f8e, 0xf7a23b, 0xffd54b, 0x43bd78, 0x4ea2ef, 0x9b67df].forEach((color, i) => {
    g.lineStyle(6, color, 0.2).beginPath().arc(397, 445, 300 - i * 8, Math.PI * 1.08, Math.PI * 1.92).strokePath();
  });
  root.add(g);
}

function build(scene: Runtime): LandscapeUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(4200).setVisible(false);
  sky(scene, root);
  text(scene, root, 22, 22, tr(scene.lang ?? "en", "カラーマッチ", "Color Match"), 26, "#ffffff", "900").setOrigin(0, 0.5).setStroke("#245bc4", 5);
  text(scene, root, 24, 55, "60 SEC ARCADE · COLOR / WORD SWITCH", 9, "#e8f8ff", "800").setOrigin(0, 0.5);

  const title = scene.add.container(0, 0);
  const play = scene.add.container(0, 0);
  const result = scene.add.container(0, 0);
  root.add([title, play, result]);

  const flowGlow = scene.add.graphics();
  play.add(flowGlow);

  panel(scene, title, 250, 225, 400, 300, 0x164f82, 0x9be9ff, 0.94, 22);
  text(
    scene,
    title,
    250,
    scene.lang === "ja" ? 118 : 112,
    tr(scene.lang ?? "en", "色と文字のズレを見抜け！", "Spot the mismatch\nbetween word and color!"),
    scene.lang === "ja" ? 25 : 22,
    "#ffffff",
    "900",
  ).setName("marketing-title");
  text(scene, title, 250, 180, tr(scene.lang ?? "en", "60秒で総合力。20秒練習で弱点集中。\n指示が『文字の意味』か『文字の色』かを見て\n正しいカードをタップ。", "60 seconds tests overall skill. 20-second practice targets your weakness.\nFollow WORD MEANING or INK COLOR\nand tap the correct card."), 14, "#def5ff", "700");
  const titleMode = text(scene, title, 250, 244, "", 13, "#fff1a8", "900");

  const modeXs = [92, 194, 296, 398];
  WRITING_MODES.forEach((mode, i) => {
    panel(scene, title, modeXs[i]!, 292, 92, 46, 0x193b66, 0xffffff, 0.9, 12);
    text(scene, title, modeXs[i]!, 292, writingModeLabel(scene.lang ?? "en", mode), 11, "#ffffff", "800");
    const hit = scene.add.zone(modeXs[i]!, 292, 96, 52).setInteractive({ useHandCursor: true });
    title.add(hit);
    hit.on("pointerdown", () => invoke(scene, "setWritingMode", mode));
  });
  button(scene, title, 640, 250, 250, 62, tr(scene.lang ?? "en", "60秒チャレンジ", "60-Second Challenge"), () => invoke(scene, "startSession", "challenge"));
  button(scene, title, 640, 326, 250, 54, tr(scene.lang ?? "en", "20秒 弱点練習", "20-Second Practice"), () => invoke(scene, "startPractice"), 0x4b75d6);
  panel(scene, title, 640, 150, 250, 120, 0xffffff, 0x8ac8f4, 0.94, 18);
  text(scene, title, 640, 128, "BEST", 11, "#2b5b87", "900");
  text(scene, title, 640, 158, `${loadBestScore()} SCORE`, 27, "#ff7a3d", "900");
  text(scene, title, 640, 190, `TURBO ${loadBestTurbo()}pt`, 12, "#47709b", "800");

  const timerRing = scene.add.graphics();
  play.add(timerRing);
  const timerText = text(scene, play, 88, 115, "60", 36, "#ffffff", "900");
  text(scene, play, 88, 77, "TIME", 10, "#d8f5ff", "900");
  panel(scene, play, 247, 92, 250, 74, 0x164f82, 0x90e6ff, 0.95, 15);
  const ruleText = text(scene, play, 247, 92, "", 17, "#ffffff", "900");
  panel(scene, play, 228, 230, 300, 180, 0xffffff, 0x8ac8f4, 0.98, 18);
  text(scene, play, 228, 168, tr(scene.lang ?? "en", "お題", "PROMPT"), 10, "#426c99", "900");
  const promptText = text(scene, play, 228, 232, "", 50, "#253c58", "900");
  const chainText = text(scene, play, 342, 335, "0\nCHAIN!", 23, "#ff5f8f", "900").setStroke("#ffffff", 5).setAngle(-4);

  panel(scene, play, 650, 54, 270, 58, 0x153e6a, 0xffd463, 0.96, 13);
  text(scene, play, 548, 42, "SCORE", 9, "#d8ecff", "900").setOrigin(0, 0.5);
  const scoreText = text(scene, play, 720, 55, "0000", 26, "#fff0a6", "900");

  const answers: AnswerView[] = [];
  const xs = [470, 600, 730];
  const ys = [170, 285];
  COLORS.forEach((color, i) => {
    const x = xs[i % 3]!;
    const y = ys[Math.floor(i / 3)]!;
    const bg = scene.add.graphics();
    bg.fillStyle(0x15325c, 0.16).fillRoundedRect(x - 56 + 3, y - 40 + 5, 112, 80, 14);
    bg.fillStyle(0xffffff, 0.97).fillRoundedRect(x - 56, y - 40, 112, 80, 14);
    bg.lineStyle(4, color.hex, 0.96).strokeRoundedRect(x - 56, y - 40, 112, 80, 14);
    play.add(bg);
    const answerText = text(scene, play, x, y, "", 18, `#${color.hex.toString(16).padStart(6, "0")}`, "900");
    const hit = scene.add.zone(x, y, 116, 84).setInteractive({ useHandCursor: true });
    play.add(hit);
    hit.on("pointerdown", () => {
      if (scene.phase !== "playing" || scene.accepting === false) return;
      invoke(scene, "finishRound", color.id);
    });
    answers.push({ bg, text: answerText });
  });

  panel(scene, play, 610, 390, 330, 54, 0x153d68, 0x79cff7, 0.94, 14);
  const nextText = text(scene, play, 610, 390, "", 12, "#ffffff", "900");
  if (scene.textures.exists("cm-mascot")) {
    const mascot = scene.add.image(94, 345, "cm-mascot").setDisplaySize(118, 118);
    play.add(mascot);
    scene.tweens.add({ targets: mascot, y: 338, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  panel(scene, result, 400, 225, 620, 330, 0x164f82, 0x9be9ff, 0.96, 22);
  const resultHeading = text(scene, result, 400, 118, "RESULT", 30, "#ffffff", "900");
  const resultStats = text(scene, result, 400, 215, "", 17, "#e8f8ff", "800");
  button(scene, result, 400, 340, 280, 62, tr(scene.lang ?? "en", "もう一度あそぶ", "Play Again"), () => invoke(scene, "startSession"), 0xff7a3d);

  const ui = {
    root,
    title,
    play,
    result,
    flowGlow,
    timerRing,
    timerText,
    scoreText,
    ruleText,
    promptText,
    chainText,
    nextText,
    answers,
    resultHeading,
    resultStats,
    titleMode,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const layout = getResponsiveLayout(scene as never);
  const landscape = !!layout && !layout.isPortrait;
  ui.root.setVisible(landscape);
  if (!landscape) return;

  ui.title.setVisible(scene.phase === "title");
  ui.play.setVisible(scene.phase === "playing");
  ui.result.setVisible(scene.phase === "result");
  ui.titleMode.setText(`${tr(scene.lang ?? "en", "表記", "Style")}: ${writingModeLabel(scene.lang ?? "en", scene.writingMode ?? "hiragana")}`);

  if (scene.phase === "playing" && scene.currentRound) {
    const duration = scene.sessionDurationMs ?? CHALLENGE_MS;
    const remaining = Phaser.Math.Clamp(scene.sessionRemaining ?? duration, 0, duration);
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    const ratio = remaining / duration;
    const elapsed = duration - remaining;
    const until = scene.sessionMode === "practice" ? 0 : Math.max(0, nextSwitchAt(elapsed) - elapsed);
    const streak = scene.turboStreak ?? 0;
    const correct = scene.results?.filter((entry) => entry.correct).length ?? 0;
    const score = correct * 100 + (scene.turboPoints ?? 0) * 10;

    ui.flowGlow.clear();
    if (streak >= TURBO_ENTRY_STREAK) {
      const pulse = 0.10 + (Math.sin(scene.time.now / 140) + 1) * 0.035;
      ui.flowGlow.fillStyle(0xff7a3d, pulse).fillRoundedRect(12, 74, 776, 340, 24);
      ui.flowGlow.lineStyle(5, 0xffd35e, 0.42).strokeRoundedRect(16, 78, 768, 332, 22);
      ui.flowGlow.fillStyle(0xffe96a, 0.08).fillCircle(225, 225, 128);
      ui.flowGlow.fillStyle(0xff7a3d, 0.07).fillCircle(650, 240, 150);
    }

    ui.timerRing.clear();
    ui.timerRing.fillStyle(0x113c65, 0.96).fillCircle(88, 115, 48);
    ui.timerRing.lineStyle(8, seconds <= 10 ? 0xff5f78 : 0x65dff7, 0.28).strokeCircle(88, 115, 47);
    ui.timerRing.lineStyle(8, seconds <= 10 ? 0xff5f78 : 0x39d8ff, 1)
      .beginPath().arc(88, 115, 47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio).strokePath();
    ui.timerText.setText(String(seconds)).setColor(seconds <= 10 ? "#ffd0d8" : "#ffffff");
    ui.scoreText.setText(String(score).padStart(4, "0"));
    ui.ruleText.setText(scene.currentRound.judgeMode === "color" ? tr(scene.lang ?? "en", "『文字の色』でタップ", "Tap by INK COLOR") : tr(scene.lang ?? "en", "『文字の意味』でタップ", "Tap by WORD MEANING"));
    ui.promptText
      .setText(nameForColorId(scene.currentRound.promptWord, scene.writingMode ?? "hiragana"))
      .setColor(`#${hexForColorId(scene.currentRound.promptInk).toString(16).padStart(6, "0")}`);
    ui.chainText.setText(`${streak}\n${streak >= TURBO_ENTRY_STREAK ? "FLOW!" : "CHAIN!"}`)
      .setColor(streak >= TURBO_ENTRY_STREAK ? "#ff7a3d" : "#ff5f8f");
    ui.nextText.setText(
      scene.sessionMode === "practice"
        ? `WEAK POINT  ${scene.practiceJudgeMode === "color" ? tr(scene.lang ?? "en", "文字の色", "INK COLOR") : tr(scene.lang ?? "en", "文字の意味", "WORD MEANING")}`
        : until <= 2000
          ? tr(scene.lang ?? "en", "RULE SHIFT まもなく！", "RULE SHIFT SOON!")
          : `NEXT RULE ${Math.ceil(until / 1000)}${tr(scene.lang ?? "en", "秒", "s")} · BEST ${loadBestScore()}`,
    );
    ui.answers.forEach((answer, i) => answer.text.setText(nameForColorId(COLORS[i]!.id, scene.writingMode ?? "hiragana")));
  }

  if (scene.phase === "result") {
    const summary = summarizeSession(scene.results ?? []);
    const accuracyPct = Math.round(summary.accuracy * 100);
    const grade = accuracyPct >= 95 && summary.avgReactionMs <= 900
      ? "S"
      : accuracyPct >= 85
        ? "A"
        : accuracyPct >= 70
          ? "B"
          : "C";
    ui.flowGlow.clear();
    ui.resultHeading
      .setText(`${grade}  ·  SCORE ${summary.score}`)
      .setColor(grade === "S" ? "#ffd75e" : grade === "A" ? "#7ee9ff" : "#ffffff");
    const performance = loadPerformanceStats();
    const metric = (key: "content" | "color" | "switch", label: string) => {
      const value = performance[key];
      const accuracy = value.total ? Math.round(metricAccuracy(value) * 100) : 0;
      const reaction = value.reactionSamples ? Math.round(metricAvgReaction(value)) : 0;
      return `${label} ${accuracy}%${reaction ? ` / ${reaction}ms` : ""}`;
    };
    ui.resultStats.setText(
      `${scene.sessionMode === "practice" ? tr(scene.lang ?? "en", "20秒弱点練習", "20-Second Practice") : tr(scene.lang ?? "en", "60秒チャレンジ", "60-Second Challenge")} · ${tr(scene.lang ?? "en", "正答率", "Accuracy")} ${Math.round(summary.accuracy * 100)}% · ${tr(scene.lang ?? "en", "平均", "Avg")} ${Math.round(summary.avgReactionMs)}ms\n` +
      `${metric("content", tr(scene.lang ?? "en", "意味", "Word"))} · ${metric("color", tr(scene.lang ?? "en", "色", "Color"))} · ${metric("switch", tr(scene.lang ?? "en", "切替", "Switch"))}`,
    );
  }
}

export function installColorMobileLayout(): void {
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
