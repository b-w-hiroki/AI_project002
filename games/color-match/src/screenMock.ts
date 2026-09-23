import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { WRITING_MODES, WRITING_MODE_LABEL, summarizeSession, type WritingMode } from "./logic/round";
import type { ChallengeResult } from "./logic/challenge";
import { loadBestScore, loadBestTurbo } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type Runtime = Phaser.Scene & {
  lang?: "ja" | "en";
  phase?: "title" | "playing" | "result";
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
  score: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, MockUi>();

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
  g.fillStyle(fill, 0.96).fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
  g.lineStyle(2, 0x8ee8ff, 0.8).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 20);
  parent.add(g);
}

function button(scene: Runtime, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, text: string, action: () => void): void {
  const g = scene.add.graphics();
  g.fillStyle(0xff713d, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 17);
  g.lineStyle(3, 0xffd469, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 17);
  parent.add(g);
  label(scene, parent, x, y, text, 20);
  const hit = scene.add.zone(x, y, w, Math.max(52, h)).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", action);
  parent.add(hit);
}

function background(scene: Phaser.Scene, parent: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x168fdf, 0x35b9ef, 0xd8f8ff, 0x79cf9a, 1).fillRect(0, 0, 450, 800);
  g.fillStyle(0xffffff, 0.45).fillCircle(50, 115, 70).fillCircle(390, 165, 95);
  g.fillStyle(0x4fac72, 0.8).fillCircle(40, 760, 125).fillCircle(390, 755, 145);
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
  label(scene, title, 225, 112, "60秒 COLOR × WORD ARCADE", 13, "#e9fbff");
  if (scene.textures.exists("cm-mascot")) title.add(scene.add.image(225, 225, "cm-mascot").setDisplaySize(190, 190));
  panel(scene, title, 225, 370, 382, 116);
  label(scene, title, 225, 345, "今のルールを読み、正しい色をタップ", 17);
  label(scene, title, 225, 388, "意味と色が切り替わる。CHAINを伸ばそう！", 13, "#cceeff");
  label(scene, title, 225, 465, "出題の表記", 14, "#173b63");
  const modeLabels: Phaser.GameObjects.Text[] = [];
  WRITING_MODES.forEach((mode, i) => {
    const x = 125 + (i % 2) * 200;
    const y = 515 + Math.floor(i / 2) * 62;
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.94).fillRoundedRect(x - 86, y - 24, 172, 48, 13);
    g.lineStyle(2, 0x3e91cf, 0.8).strokeRoundedRect(x - 86, y - 24, 172, 48, 13);
    title.add(g);
    const text = label(scene, title, x, y, WRITING_MODE_LABEL[mode], 15, "#194d78");
    modeLabels.push(text);
    const hit = scene.add.zone(x, y, 172, 52).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => invoke(scene, "setWritingMode", mode));
    title.add(hit);
  });
  label(scene, title, 225, 635, `BEST ${loadBestScore()}  ·  TURBO ${loadBestTurbo()}pt`, 14, "#173b63");
  button(scene, title, 225, 705, 350, 64, "ゲームスタート", () => invoke(scene, "startSession"));

  label(scene, result, 225, 82, "CHALLENGE RESULT", 27).setStroke("#2259b0", 6);
  panel(scene, result, 225, 360, 390, 480);
  const score = label(scene, result, 225, 205, "SCORE 0", 39, "#ffe46c");
  if (scene.textures.exists("cm-mascot")) result.add(scene.add.image(225, 315, "cm-mascot").setDisplaySize(150, 150));
  const stats = label(scene, result, 225, 455, "", 17, "#ffffff");
  button(scene, result, 225, 650, 330, 64, "もう一度あそぶ", () => invoke(scene, "startSession"));
  label(scene, result, 225, 712, "次は自己ベストを更新しよう", 13, "#173b63");

  const ui = { root, title, result, modeLabels, score, stats };
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
    ui.score.setText(`SCORE ${summary.score}`);
    ui.stats.setText(`正答率 ${Math.round(summary.accuracy * 100)}%\nMAX CHAIN ${maxStreak}\n平均反応 ${Math.round(summary.avgReactionMs)}ms\nTURBO ${scene.turboPoints ?? 0}pt`);
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
