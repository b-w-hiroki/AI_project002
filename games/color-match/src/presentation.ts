import Phaser from "phaser";
import { CHALLENGE_MS, challengeRound, nextSwitchAt } from "./logic/challenge";
import { TURBO_ENTRY_STREAK } from "./logic/round";
import { loadBestScore } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type TargetBoxLike = {
  colorId: string;
  container: Phaser.GameObjects.Container;
};
type ColorScene = Phaser.Scene & {
  phase?: "title" | "playing" | "result";
  switched?: boolean;
  currentRound?: { judgeMode?: "content" | "color" };
  turboStreak?: number;
  turboPoints?: number;
  roundIndex?: number;
  sessionRemaining?: number;
  results?: Array<{ correct: boolean; reactionMs: number }>;
  targetBoxes?: TargetBoxLike[];
  promptCard?: Phaser.GameObjects.Container;
  progressText?: Phaser.GameObjects.Text;
  judgeModeText?: Phaser.GameObjects.Text;
  timerText?: Phaser.GameObjects.Text;
  timerBarBg?: Phaser.GameObjects.Graphics;
  timerBarFill?: Phaser.GameObjects.Graphics;
  turboText?: Phaser.GameObjects.Text;
  turboHudBadge?: Phaser.GameObjects.Image | null;
  switchHint?: Phaser.GameObjects.Text;
};

interface ArcadeHud {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  timeText: Phaser.GameObjects.Text;
  timeLabel: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  bestText: Phaser.GameObjects.Text;
  ruleKicker: Phaser.GameObjects.Text;
  ruleText: Phaser.GameObjects.Text;
  chainText: Phaser.GameObjects.Text;
  flowText: Phaser.GameObjects.Text;
  nextText: Phaser.GameObjects.Text;
  nextModeText: Phaser.GameObjects.Text;
  mascot?: Phaser.GameObjects.Image;
}

const hudByScene = new WeakMap<object, ArcadeHud>();
const maxChainByScene = new WeakMap<object, number>();
const resultBadgeByScene = new WeakMap<object, Phaser.GameObjects.Text>();

function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight = "800",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      align: "center",
      letterSpacing: 0.4,
    })
    .setOrigin(0.5);
}

function ensureArcadeHud(scene: ColorScene): ArcadeHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics();
  const timeText = uiText(scene, 53, 64, "60", 27, "#22334e", "900");
  const timeLabel = uiText(scene, 53, 91, "TIME", 9, "#67768c", "900");
  const scoreText = uiText(scene, 397, 45, "SCORE 000", 17, "#263952", "900").setOrigin(1, 0.5);
  const bestText = uiText(scene, 397, 70, "BEST 000", 10, "#6d7c91", "800").setOrigin(1, 0.5);
  const ruleKicker = uiText(scene, 225, 88, "CURRENT RULE", 9, "#718097", "900");
  const ruleText = uiText(scene, 225, 113, "", 17, "#ffffff", "900");
  const chainText = uiText(scene, 395, 207, "", 18, "#ff7546", "900");
  const flowText = uiText(scene, 395, 232, "", 10, "#9a5438", "900");
  const nextText = uiText(scene, 225, 693, "", 13, "#ffffff", "900");
  const nextModeText = uiText(scene, 225, 718, "", 10, "#e7f0ff", "800");

  const children: Phaser.GameObjects.GameObject[] = [
    graphics,
    timeText,
    timeLabel,
    scoreText,
    bestText,
    ruleKicker,
    ruleText,
    chainText,
    flowText,
    nextText,
    nextModeText,
  ];
  let mascot: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("cm-mascot")) {
    mascot = scene.add.image(397, 326, "cm-mascot").setDisplaySize(72, 72);
    children.push(mascot);
  }

  const root = scene.add.container(0, 0, children).setDepth(1700).setVisible(false);
  const hud = { root, graphics, timeText, timeLabel, scoreText, bestText, ruleKicker, ruleText, chainText, flowText, nextText, nextModeText, mascot };
  hudByScene.set(scene, hud);
  return hud;
}

function hideLegacyHud(scene: ColorScene): void {
  scene.progressText?.setVisible(false);
  scene.judgeModeText?.setVisible(false);
  scene.timerText?.setVisible(false);
  scene.timerBarBg?.setVisible(false);
  scene.timerBarFill?.setVisible(false);
  scene.turboText?.setVisible(false);
  scene.turboHudBadge?.setVisible(false);
  scene.switchHint?.setVisible(false);
}

function liveScore(scene: ColorScene): number {
  const results = scene.results ?? [];
  if (!results.length) return 0;
  const correct = results.filter((result) => result.correct);
  const accuracy = correct.length / results.length;
  const avg = correct.length
    ? correct.reduce((sum, result) => sum + result.reactionMs, 0) / correct.length
    : 0;
  const speed = correct.length ? Math.max(0, 100 - avg / 20) : 0;
  return Math.round(accuracy * 60 + speed * 0.4);
}

function refreshArcadeHud(scene: ColorScene): void {
  const hud = ensureArcadeHud(scene);
  const active = scene.phase === "playing";
  hud.root.setVisible(active);
  if (!active) return;
  hideLegacyHud(scene);

  const remainingMs = Phaser.Math.Clamp(scene.sessionRemaining ?? CHALLENGE_MS, 0, CHALLENGE_MS);
  const seconds = Math.ceil(remainingMs / 1000);
  const elapsed = CHALLENGE_MS - remainingMs;
  const nextAt = nextSwitchAt(elapsed);
  const until = Math.max(0, nextAt - elapsed);
  const mode = scene.currentRound?.judgeMode;
  const nextMode = challengeRound(Math.min(CHALLENGE_MS - 1, nextAt + 1)).judgeMode;
  const streak = scene.turboStreak ?? 0;
  const maxChain = Math.max(maxChainByScene.get(scene) ?? 0, streak);
  maxChainByScene.set(scene, maxChain);
  const score = liveScore(scene);
  const finalTen = seconds <= 10;
  const flow = streak >= TURBO_ENTRY_STREAK;

  hud.graphics.clear();
  // Sky-white arcade header that replaces the prose HUD.
  hud.graphics.fillStyle(0xf9fbff, 0.96).fillRoundedRect(10, 8, 430, 142, 20);
  hud.graphics.lineStyle(1.5, flow ? 0xff8557 : 0x88a9d8, 0.65).strokeRoundedRect(10, 8, 430, 142, 20);

  // Circular TIME gauge.
  const timerColor = finalTen ? 0xff6655 : flow ? 0xff8b4a : 0x4d86d8;
  hud.graphics.fillStyle(0xffffff, 1).fillCircle(53, 64, 38);
  hud.graphics.lineStyle(6, 0xdde6f2, 1).strokeCircle(53, 64, 32);
  const ratio = remainingMs / CHALLENGE_MS;
  hud.graphics.lineStyle(6, timerColor, 1);
  hud.graphics.beginPath();
  hud.graphics.arc(53, 64, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
  hud.graphics.strokePath();
  if (finalTen) {
    hud.graphics.lineStyle(4, 0xff6655, 0.18 + 0.14 * Math.abs(Math.sin(scene.time.now / 150))).strokeCircle(53, 64, 39);
  }

  // Current rule badge at the center, clearly above the prompt card.
  const ruleColor = mode === "color" ? 0x516fe0 : 0x3d9a75;
  hud.graphics.fillStyle(ruleColor, 0.96).fillRoundedRect(112, 96, 226, 40, 13);
  hud.graphics.fillStyle(0xffffff, 0.2).fillRoundedRect(115, 99, 220, 10, 10);
  hud.graphics.lineStyle(1.4, 0xffffff, 0.52).strokeRoundedRect(112, 96, 226, 40, 13);

  // Score box top-right.
  hud.graphics.fillStyle(0xffffff, 0.94).fillRoundedRect(315, 24, 103, 60, 14);
  hud.graphics.lineStyle(1.2, 0x9ab2d1, 0.55).strokeRoundedRect(315, 24, 103, 60, 14);

  // Chain / FLOW beacon stays outside the central card.
  hud.graphics.fillStyle(flow ? 0xffefe5 : 0xffffff, 0.94).fillRoundedRect(348, 180, 88, 69, 16);
  hud.graphics.lineStyle(1.5, flow ? 0xff7a3d : 0xe5b19e, flow ? 0.9 : 0.45).strokeRoundedRect(348, 180, 88, 69, 16);
  if (flow) {
    hud.graphics.lineStyle(6, 0xff7a3d, 0.12).strokeRoundedRect(344, 176, 96, 77, 20);
  }

  // Bottom NEXT RULE ribbon.
  hud.graphics.fillStyle(flow ? 0x30395c : 0x273b58, 0.96).fillRoundedRect(38, 670, 374, 67, 18);
  hud.graphics.lineStyle(1.5, flow ? 0xffaa6f : 0x8db1df, 0.7).strokeRoundedRect(38, 670, 374, 67, 18);
  hud.graphics.fillStyle(0xffffff, 0.1).fillRoundedRect(41, 673, 368, 13, 12);

  hud.timeText.setText(String(seconds).padStart(2, "0")).setColor(finalTen ? "#d9493d" : "#22334e");
  hud.scoreText.setText(`SCORE ${String(score).padStart(3, "0")}`);
  hud.bestText.setText(`BEST ${String(loadBestScore()).padStart(3, "0")}  ·  Q${scene.roundIndex ?? 0}`);
  hud.ruleText.setText(mode === "color" ? "文字の『色』を見る" : "文字の『意味』を見る");
  hud.chainText.setText(streak > 0 ? `×${streak}` : "×0");
  hud.flowText.setText(flow ? "FLOW / TURBO" : `CHAIN  ·  ${streak}/${TURBO_ENTRY_STREAK}`);
  hud.nextText.setText(until <= 1500 ? "RULE SHIFT!" : `NEXT RULE  ${Math.ceil(until / 1000)}s`);
  hud.nextModeText.setText(`次は ${nextMode === "color" ? "文字の『色』" : "文字の『意味』"}  ·  MAX CHAIN ${maxChain}`);

  if (hud.mascot) {
    hud.mascot.setTint(flow ? 0xffd0b5 : 0xffffff);
    hud.mascot.setAngle(flow ? Math.sin(scene.time.now / 120) * 3 : 0);
  }
}

function attachTapTargets(scene: ColorScene): void {
  for (const box of scene.targetBoxes ?? []) {
    if (box.container.getData("conceptTapReady")) continue;
    box.container.setData("conceptTapReady", true);
    box.container.setInteractive({ useHandCursor: true });
    box.container.on("pointerdown", () => {
      const fn = Reflect.get(scene, "finishRound");
      if (typeof fn === "function") (fn as (colorId: string) => void).call(scene, box.colorId);
    });
  }
}

function showRuleShift(scene: Phaser.Scene, mode: "content" | "color"): void {
  const band = scene.add.graphics().setDepth(2000).setAlpha(0);
  band.fillStyle(mode === "color" ? 0x4f6ee0 : 0x3a9a73, 0.96).fillRoundedRect(25, 278, 400, 170, 22);
  band.lineStyle(3, 0xffffff, 0.75).strokeRoundedRect(25, 278, 400, 170, 22);
  const kicker = scene.add.text(225, 315, "RULE SHIFT", { fontSize: "17px", fontStyle: "900", color: "#ffffff", letterSpacing: 2 }).setOrigin(0.5).setDepth(2001).setAlpha(0);
  const title = scene.add.text(225, 365, mode === "color" ? "文字の『色』を見る" : "文字の『意味』を見る", { fontSize: "29px", fontStyle: "900", color: "#ffffff", stroke: "#26344a", strokeThickness: 5, align: "center" }).setOrigin(0.5).setDepth(2001).setAlpha(0).setScale(0.85);
  const sub = scene.add.text(225, 414, "切り替えを見抜いて CHAIN をつなげ", { fontSize: "13px", fontStyle: "700", color: "#f6f6f6" }).setOrigin(0.5).setDepth(2001).setAlpha(0);
  scene.cameras.main.flash(90, 255, 255, 255, false);
  scene.tweens.add({ targets: [band, kicker, title, sub], alpha: 1, duration: 130 });
  scene.tweens.add({ targets: title, scale: 1, duration: 190, ease: "Back.Out" });
  scene.time.delayedCall(620, () => {
    scene.tweens.add({ targets: [band, kicker, title, sub], alpha: 0, duration: 220, onComplete: () => {
      band.destroy(); kicker.destroy(); title.destroy(); sub.destroy();
    } });
  });
}

function showTurboEntry(scene: Phaser.Scene): void {
  const ring = scene.add.graphics().setDepth(2000).setAlpha(0.95);
  ring.lineStyle(7, 0xff7a3d, 0.9).strokeCircle(225, 380, 72);
  ring.lineStyle(2, 0xffd36a, 0.9).strokeCircle(225, 380, 94);
  const flow = scene.add.text(225, 345, "FLOW!", { fontSize: "46px", fontStyle: "900", color: "#ff7a3d", stroke: "#fff7e8", strokeThickness: 8 }).setOrigin(0.5).setDepth(2001).setScale(0.72);
  const sub = scene.add.text(225, 410, `TURBO ×${TURBO_ENTRY_STREAK}`, { fontSize: "20px", fontStyle: "900", color: "#7b3f22", stroke: "#fff7e8", strokeThickness: 5 }).setOrigin(0.5).setDepth(2001);
  scene.cameras.main.flash(100, 255, 184, 90, false);
  scene.tweens.add({ targets: [ring, flow], scale: 1.12, duration: 180, ease: "Back.Out", yoyo: true });
  scene.tweens.add({ targets: [ring, flow, sub], alpha: 0, duration: 300, delay: 420, onComplete: () => {
    ring.destroy(); flow.destroy(); sub.destroy();
  } });
}

function showChainMilestone(scene: Phaser.Scene, streak: number): void {
  const label = scene.add.text(225, 325, `${streak} CHAIN`, { fontSize: "30px", fontStyle: "900", color: "#ff7a3d", stroke: "#fff7e8", strokeThickness: 7 }).setOrigin(0.5).setDepth(1900).setScale(0.8);
  scene.tweens.add({ targets: label, y: 290, scale: 1.08, alpha: 0, duration: 620, ease: "Cubic.easeOut", onComplete: () => label.destroy() });
}

function showResultBadge(scene: ColorScene): void {
  resultBadgeByScene.get(scene)?.destroy();
  const badge = scene.add
    .text(225, 470, `MAX CHAIN  ${maxChainByScene.get(scene) ?? 0}   ·   ${loadBestScore() === liveScore(scene) ? "BEST UPDATED!" : "60 SEC COMPLETE"}`, {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: "12px",
      fontStyle: "900",
      color: "#ffffff",
      backgroundColor: "#425d86",
      padding: { x: 16, y: 8 },
    })
    .setOrigin(0.5)
    .setDepth(1800);
  resultBadgeByScene.set(scene, badge);
}

export function installColorMatchPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalBuildTargets = proto.buildTargetBoxes;
  if (originalBuildTargets && !proto.__conceptArcadeTargets) {
    proto.__conceptArcadeTargets = originalBuildTargets;
    proto.buildTargetBoxes = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalBuildTargets.apply(this, args);
      attachTapTargets(this as ColorScene);
      return result;
    };
  }

  const originalStart = proto.startSession;
  if (originalStart && !proto.__conceptArcadeStart) {
    proto.__conceptArcadeStart = originalStart;
    proto.startSession = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      maxChainByScene.set(this, 0);
      resultBadgeByScene.get(this)?.destroy();
      resultBadgeByScene.delete(this);
      const result = originalStart.apply(this, args);
      const state = this as ColorScene;
      state.promptCard?.setScale(1.12);
      attachTapTargets(state);
      return result;
    };
  }

  const originalNextRound = proto.nextRound;
  if (originalNextRound && !proto.__conceptArcadeRound) {
    proto.__conceptArcadeRound = originalNextRound;
    proto.nextRound = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalNextRound.apply(this, args);
      const state = this as ColorScene;
      state.promptCard?.setScale(1.12);
      const mode = state.currentRound?.judgeMode;
      if (state.switched && (mode === "content" || mode === "color")) showRuleShift(this, mode);
      return result;
    };
  }

  const originalTurbo = proto.applyTurboResult;
  if (originalTurbo && !proto.__conceptArcadeTurbo) {
    proto.__conceptArcadeTurbo = originalTurbo;
    proto.applyTurboResult = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const state = this as ColorScene;
      const before = state.turboStreak ?? 0;
      const result = originalTurbo.apply(this, args);
      const after = state.turboStreak ?? 0;
      maxChainByScene.set(this, Math.max(maxChainByScene.get(this) ?? 0, after));
      if (before < TURBO_ENTRY_STREAK && after === TURBO_ENTRY_STREAK) showTurboEntry(this);
      else if (after > TURBO_ENTRY_STREAK && after % 5 === 0) showChainMilestone(this, after);
      return result;
    };
  }

  const originalEnd = proto.endSession;
  if (originalEnd && !proto.__conceptArcadeEnd) {
    proto.__conceptArcadeEnd = originalEnd;
    proto.endSession = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalEnd.apply(this, args);
      showResultBadge(this as ColorScene);
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__conceptArcadeUpdate) {
    proto.__conceptArcadeUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      refreshArcadeHud(this as ColorScene);
      return result;
    };
  }
}
