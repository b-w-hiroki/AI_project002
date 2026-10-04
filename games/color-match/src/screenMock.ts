import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { WRITING_MODES, WRITING_MODE_LABEL, summarizeSession, type WritingMode } from "./logic/round";
import type { ChallengeResult } from "./logic/challenge";
import { improvementFocus, type ImprovementFocus } from "./logic/resultInsight";
import { loadBestScore, loadBestTurbo } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type Runtime = Phaser.Scene & {
  lang?: "ja" | "en";
  phase?: "title" | "playing" | "result";
  sessionMode?: "challenge" | "practice";
  writingMode?: WritingMode;
  results?: ChallengeResult[];
  turboPoints?: number;
};
type Method = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type Methods = Record<string, Method | undefined>;

type MockUi = {
  root: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Container;
  result: Phaser.GameObjects.Container;
  modeLabels: Phaser.GameObjects.Text[];
  resultHeading: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text;
  nextGoal: Phaser.GameObjects.Text;
  resultPrimaryLabel: Phaser.GameObjects.Text;
  resultSecondaryLabel: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, MockUi>();

function improvementText(focus: ImprovementFocus): string {
  switch (focus) {
    case "switch":
      return "ルール切替直後の1問を丁寧に";
    case "content":
      return "文字の意味判断を20秒練習";
    case "color":
      return "文字の色判断を20秒練習";
    case "speed":
      return "正確さを保って1秒以内を狙う";
    case "flow":
      return "5連続高速正解でFLOWを伸ばす";
  }
}

function invoke(scene: Runtime, method: string, ...args: unknown[]): void {
  const fn = Reflect.get(scene, method);
  if (typeof fn === "function") fn.apply(scene, args);
}

function label(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = "#ffffff"): Phaser.GameObjects.Text {
  const node = scene.add.text(x, y, value, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    fontSize: `${size}px`, fontStyle: "900", color, align: "center", lineSpacing: 6,
  }).setOrigin(0.5);
  parent.add(node);
  return node;
}

function panel(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, fill = 0x163f6b): void {
  const g = scene.add.graphics();
  g.fillStyle(0x0d2948, 0.25).fillRoundedRect(x - w / 2 + 4, y - h / 2 + 6, w, h, 20);
  g.fillStyle(0x0b2f57, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
  g.fillStyle(fill, 0.9).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 16);
  g.fillStyle(0xffffff, 0.1).fillRoundedRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, Math.max(7, h * 0.12), 12);
  g.lineStyle(3, 0x8ee8ff, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 20);
  g.lineStyle(1, 0xffffff, 0.3).strokeRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 15);
  parent.add(g);
}

function button(
  scene: Runtime,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  action: () => void,
  options: { kind?: "primary" | "secondary"; name?: string; fontSize?: number } = {},
): Phaser.GameObjects.Text {
  const secondary = options.kind === "secondary";
  const g = scene.add.graphics();
  g.fillStyle(secondary ? 0x123d68 : 0xa93c2a, 0.45).fillRoundedRect(x - w / 2 + 4, y - h / 2 + 6, w, h, 17);
  g.fillStyle(secondary ? 0x2f76b8 : 0xff713d, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 17);
  g.fillStyle(secondary ? 0x64a9de : 0xffa35f, 0.8).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, Math.max(8, h * 0.22), 12);
  g.lineStyle(secondary ? 3 : 4, secondary ? 0xa8e8ff : 0xffd469, 0.96).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 17);
  g.lineStyle(1, 0xffffff, 0.5).strokeRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 12);
  parent.add(g);
  const textNode = label(scene, parent, x, y, text, options.fontSize ?? (secondary ? 16 : 20))
    .setStroke(secondary ? "#174774" : "#9d321f", secondary ? 3 : 4);
  const hit = scene.add.zone(x, y, w, Math.max(52, h));
  if (options.name) hit.setName(options.name);
  hit.setInteractive({ useHandCursor: true });
  hit.on("pointerdown", action);
  parent.add(hit);
  return textNode;
}

function background(scene: Phaser.Scene, parent: Phaser.GameObjects.Container): void {
  if (scene.textures.exists("cm-bg-fantasy-portrait")) {
    parent.add(scene.add.image(225, 400, "cm-bg-fantasy-portrait").setDisplaySize(450, 800));
  }
  const g = scene.add.graphics();
  if (!scene.textures.exists("cm-bg-fantasy-portrait")) {
    g.fillGradientStyle(0x168fdf, 0x35b9ef, 0xd8f8ff, 0x79cf9a, 1).fillRect(0, 0, 450, 800);
    g.fillStyle(0xffffff, 0.45).fillCircle(50, 115, 70).fillCircle(390, 165, 95);
    g.fillStyle(0x4fac72, 0.8).fillCircle(40, 760, 125).fillCircle(390, 755, 145);
  }
  g.fillGradientStyle(0x0b2852, 0x164a82, 0x164a82, 0x071b39, 0.34, 0.08, 0.02, 0.38).fillRect(0, 0, 450, 800);
  g.fillStyle(0xffffff, 0.16);
  [[38, 154, 5], [405, 202, 7], [66, 344, 4], [385, 478, 5], [52, 604, 6], [405, 666, 4]].forEach(([x, y, r]) => {
    g.fillCircle(x!, y!, r!);
  });
  g.lineStyle(3, 0xffd76f, 0.72).strokeRoundedRect(8, 8, 434, 784, 24);
  g.lineStyle(1, 0xffffff, 0.38).strokeRoundedRect(13, 13, 424, 774, 20);
  parent.add(g);
}

function build(scene: Runtime): MockUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const root = scene.add.container(0, 0).setDepth(5000);
  background(scene, root);
  const title = scene.add.container(0, 0);
  const result = scene.add.container(0, 0);
  root.add([title, result]);

  label(scene, title, 225, 74, "カラーマッチ", 36).setStroke("#2259b0", 7);
  label(scene, title, 225, 112, "60秒 COLOR × WORD ARCADE", 20, "#e9fbff");
  if (scene.textures.exists("cm-mascot")) title.add(scene.add.image(225, 225, "cm-mascot").setDisplaySize(220, 220));
  panel(scene, title, 225, 382, 382, 96);
  label(scene, title, 225, 356, "今のルールを読み、正しい色をタップ", 22);
  label(scene, title, 225, 400, "意味と色が切り替わる。\nCHAINを伸ばそう！", 17, "#cceeff");
  label(scene, title, 225, 458, "出題の表記", 18, "#173b63");
  const modeLabels: Phaser.GameObjects.Text[] = [];
  WRITING_MODES.forEach((mode, i) => {
    const x = 125 + (i % 2) * 200;
    const y = 505 + Math.floor(i / 2) * 58;
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.94).fillRoundedRect(x - 86, y - 24, 172, 48, 13);
    g.lineStyle(2, 0x3e91cf, 0.8).strokeRoundedRect(x - 86, y - 24, 172, 48, 13);
    title.add(g);
    const text = label(scene, title, x, y, WRITING_MODE_LABEL[mode], 22, "#194d78");
    modeLabels.push(text);
    const hit = scene.add.zone(x, y, 172, 52).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => invoke(scene, "setWritingMode", mode));
    title.add(hit);
  });
  label(scene, title, 225, 610, `最高 ${loadBestScore()}  ·  ターボ ${loadBestTurbo()}pt`, 20, "#173b63");
  button(scene, title, 225, 664, 360, 64, "60秒チャレンジ", () => invoke(scene, "startSession", "challenge"), {
    name: "portrait-challenge-action",
    fontSize: 22,
  });
  button(scene, title, 225, 736, 360, 54, "20秒 弱点練習", () => invoke(scene, "startPractice"), {
    kind: "secondary",
    name: "portrait-practice-action",
    fontSize: 22,
  });

  const resultHeading = label(scene, result, 225, 76, "チャレンジ結果", 27).setStroke("#2259b0", 6);
  panel(scene, result, 225, 350, 370, 430);
  const resultOrnaments = scene.add.graphics();
  resultOrnaments.fillStyle(0xffd86f, 0.96);
  resultOrnaments.fillTriangle(55, 154, 72, 154, 55, 171).fillTriangle(395, 154, 378, 154, 395, 171);
  resultOrnaments.fillTriangle(55, 546, 72, 546, 55, 529).fillTriangle(395, 546, 378, 546, 395, 529);
  resultOrnaments.lineStyle(2, 0xffe89a, 0.72).lineBetween(88, 154, 362, 154).lineBetween(88, 546, 362, 546);
  resultOrnaments.fillStyle(0xfff7df, 0.96).fillRoundedRect(66, 508, 318, 58, 13);
  resultOrnaments.lineStyle(2, 0xe1b855, 0.9).strokeRoundedRect(66, 508, 318, 58, 13);
  result.add(resultOrnaments);
  const score = label(scene, result, 225, 178, "得点 0", 42, "#ffe46c");
  if (scene.textures.exists("cm-mascot")) result.add(scene.add.image(225, 285, "cm-mascot").setDisplaySize(164, 164));
  const stats = label(scene, result, 225, 424, "", 20, "#ffffff");
  const nextGoal = label(scene, result, 225, 537, "", 16, "#173b63").setName("result-next-focus");
  const resultPrimaryLabel = button(
    scene,
    result,
    225,
    630,
    350,
    60,
    "もう一度60秒",
    () => scene.sessionMode === "practice" ? invoke(scene, "startPractice") : invoke(scene, "startSession", "challenge"),
    { name: "portrait-result-primary-action", fontSize: 18 },
  );
  const resultSecondaryLabel = button(
    scene,
    result,
    225,
    704,
    350,
    54,
    "弱点を20秒練習",
    () => scene.sessionMode === "practice" ? invoke(scene, "startSession", "challenge") : invoke(scene, "startPractice"),
    { kind: "secondary", name: "portrait-result-secondary-action", fontSize: 16 },
  );

  const ui = { root, title, result, modeLabels, resultHeading, score, stats, nextGoal, resultPrimaryLabel, resultSecondaryLabel };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  if (scene.lang === "en") {
    uiByScene.get(scene)?.root.setVisible(false);
    return;
  }
  const ui = build(scene);
  const layout = getResponsiveLayout(scene as never);
  const portrait = !layout || layout.isPortrait;
  const title = portrait && scene.phase === "title";
  const result = portrait && scene.phase === "result";
  ui.root.setVisible(title || result);
  ui.title.setVisible(title);
  ui.result.setVisible(result);
  ui.modeLabels.forEach((node, i) => node.setColor(WRITING_MODES[i] === scene.writingMode ? "#ff6238" : "#194d78"));
  if (result) {
    const results = scene.results ?? [];
    const summary = summarizeSession(results);
    let streak = 0;
    let maxStreak = 0;
    results.forEach(entry => {
      streak = entry.correct ? streak + 1 : 0;
      maxStreak = Math.max(maxStreak, streak);
    });
    ui.score.setText(`得点 ${summary.score}`);
    ui.stats.setText(`正答率 ${Math.round(summary.accuracy * 100)}%\n最大連続 ${maxStreak}\n平均反応 ${Math.round(summary.avgReactionMs)}ms\nターボ ${scene.turboPoints ?? 0}pt`);
    ui.nextGoal.setText(`次の目標: ${improvementText(improvementFocus(results))}`);
    const practice = scene.sessionMode === "practice";
    ui.resultHeading.setText(practice ? "練習結果" : "チャレンジ結果");
    ui.resultPrimaryLabel.setText(practice ? "もう一度20秒" : "もう一度60秒");
    ui.resultSecondaryLabel.setText(practice ? "60秒チャレンジ" : "弱点を20秒練習");
  }
}

export function installColorScreenMock(): void {
  const proto = GameScene.prototype as unknown as Methods;
  const update = proto.update;
  if (proto.__screenMockUpdate) return;
  proto.__screenMockUpdate = update ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const value = update?.apply(this, args);
    refresh(this as Runtime);
    return value;
  };
}
