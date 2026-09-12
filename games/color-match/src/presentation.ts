import Phaser from "phaser";
import { CHALLENGE_MS, nextSwitchAt } from "./logic/challenge";
import { TURBO_ENTRY_STREAK } from "./logic/round";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type ColorScene = Phaser.Scene & {
  phase?: "title" | "playing" | "result";
  switched?: boolean;
  currentRound?: { judgeMode?: "content" | "color" };
  turboStreak?: number;
  turboPoints?: number;
  roundIndex?: number;
  sessionRemaining?: number;
};

interface MasteryHud {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  modeText: Phaser.GameObjects.Text;
  nextText: Phaser.GameObjects.Text;
  chainText: Phaser.GameObjects.Text;
}

const hudByScene = new WeakMap<object, MasteryHud>();

function ensureMasteryHud(scene: ColorScene): MasteryHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics();
  const modeText = scene.add
    .text(30, 18, "", {
      fontSize: "11px",
      fontStyle: "900",
      color: "#fff8e8",
      letterSpacing: 1,
    })
    .setOrigin(0, 0.5);
  const nextText = scene.add
    .text(225, 704, "", {
      fontSize: "12px",
      fontStyle: "800",
      color: "#f9efe0",
      align: "center",
    })
    .setOrigin(0.5);
  const chainText = scene.add
    .text(420, 18, "", {
      fontSize: "11px",
      fontStyle: "900",
      color: "#ffb071",
    })
    .setOrigin(1, 0.5);

  const root = scene.add
    .container(0, 0, [graphics, modeText, nextText, chainText])
    .setDepth(1700)
    .setVisible(false);
  const hud = { root, graphics, modeText, nextText, chainText };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshMasteryHud(scene: ColorScene): void {
  const hud = ensureMasteryHud(scene);
  const active = scene.phase === "playing";
  hud.root.setVisible(active);
  if (!active) return;

  const remaining = Phaser.Math.Clamp(scene.sessionRemaining ?? CHALLENGE_MS, 0, CHALLENGE_MS);
  const elapsed = CHALLENGE_MS - remaining;
  const sessionProgress = Phaser.Math.Clamp(elapsed / CHALLENGE_MS, 0, 1);
  const rawUntil = nextSwitchAt(elapsed) - elapsed;
  const until = Math.max(0, rawUntil);
  const mode = scene.currentRound?.judgeMode;
  const streak = scene.turboStreak ?? 0;
  const questions = scene.roundIndex ?? 0;

  hud.graphics.clear();
  hud.graphics.fillStyle(0x2a2721, 0.92);
  hud.graphics.fillRoundedRect(20, 8, 410, 20, 10);
  hud.graphics.fillStyle(0xe4d4bd, 0.35);
  hud.graphics.fillRoundedRect(26, 30, 398, 4, 2);
  hud.graphics.fillStyle(streak >= TURBO_ENTRY_STREAK ? 0xff7a3d : 0x3f8068, 1);
  hud.graphics.fillRoundedRect(26, 30, 398 * sessionProgress, 4, 2);
  hud.graphics.fillStyle(0x2a2721, 0.9);
  hud.graphics.fillRoundedRect(54, 687, 342, 34, 12);
  hud.graphics.lineStyle(1.5, streak >= TURBO_ENTRY_STREAK ? 0xff7a3d : 0xbca88b, 0.7);
  hud.graphics.strokeRoundedRect(54, 687, 342, 34, 12);

  hud.modeText.setText(
    mode === "color" ? "FOCUS  COLOR" : mode === "content" ? "FOCUS  MEANING" : "FOCUS  READY",
  );
  hud.chainText.setText(`Q${questions}  ·  CHAIN ×${streak}`);
  hud.nextText.setText(
    until <= 2000
      ? "NEXT  ルール切替まもなく"
      : `NEXT  ルール切替まで ${Math.ceil(until / 1000)}秒  ·  TURBO ${streak >= TURBO_ENTRY_STREAK ? "ON" : `${streak}/${TURBO_ENTRY_STREAK}`}`,
  );
}

function showRuleShift(scene: Phaser.Scene, mode: "content" | "color"): void {
  const band = scene.add.graphics().setDepth(2000).setAlpha(0);
  band.fillStyle(mode === "color" ? 0x3f66d4 : 0x3a8067, 0.94);
  band.fillRoundedRect(25, 278, 400, 170, 22);
  band.lineStyle(3, 0xffffff, 0.75);
  band.strokeRoundedRect(25, 278, 400, 170, 22);

  const kicker = scene.add
    .text(225, 315, "RULE SHIFT", {
      fontSize: "17px",
      fontStyle: "900",
      color: "#ffffff",
      letterSpacing: 2,
    })
    .setOrigin(0.5)
    .setDepth(2001)
    .setAlpha(0);
  const title = scene.add
    .text(225, 365, mode === "color" ? "文字の『色』を見る" : "文字の『意味』を見る", {
      fontSize: "29px",
      fontStyle: "900",
      color: "#ffffff",
      stroke: "#26344a",
      strokeThickness: 5,
      align: "center",
    })
    .setOrigin(0.5)
    .setDepth(2001)
    .setAlpha(0)
    .setScale(0.85);
  const sub = scene.add
    .text(225, 414, "切り替えに気づけたら、もう一段うまくなる", {
      fontSize: "13px",
      fontStyle: "700",
      color: "#f6f6f6",
    })
    .setOrigin(0.5)
    .setDepth(2001)
    .setAlpha(0);

  scene.cameras.main.flash(90, 255, 255, 255, false);
  scene.tweens.add({ targets: [band, kicker, title, sub], alpha: 1, duration: 130 });
  scene.tweens.add({ targets: title, scale: 1, duration: 190, ease: "Back.Out" });
  scene.time.delayedCall(620, () => {
    scene.tweens.add({
      targets: [band, kicker, title, sub],
      alpha: 0,
      duration: 220,
      onComplete: () => {
        band.destroy();
        kicker.destroy();
        title.destroy();
        sub.destroy();
      },
    });
  });
}

function showTurboEntry(scene: Phaser.Scene): void {
  const ring = scene.add.graphics().setDepth(2000).setAlpha(0.95);
  ring.lineStyle(7, 0xff7a3d, 0.9);
  ring.strokeCircle(225, 380, 72);
  ring.lineStyle(2, 0xffd36a, 0.9);
  ring.strokeCircle(225, 380, 94);

  const flow = scene.add
    .text(225, 345, "FLOW!", {
      fontSize: "46px",
      fontStyle: "900",
      color: "#ff7a3d",
      stroke: "#fff7e8",
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(2001)
    .setScale(0.72);
  const sub = scene.add
    .text(225, 410, `TURBO ×${TURBO_ENTRY_STREAK}`, {
      fontSize: "20px",
      fontStyle: "900",
      color: "#7b3f22",
      stroke: "#fff7e8",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(2001);

  scene.cameras.main.flash(100, 255, 184, 90, false);
  scene.tweens.add({
    targets: [ring, flow],
    scale: 1.12,
    duration: 180,
    ease: "Back.Out",
    yoyo: true,
  });
  scene.tweens.add({
    targets: [ring, flow, sub],
    alpha: 0,
    duration: 300,
    delay: 420,
    onComplete: () => {
      ring.destroy();
      flow.destroy();
      sub.destroy();
    },
  });
}

function showChainMilestone(scene: Phaser.Scene, streak: number): void {
  const text = scene.add
    .text(225, 325, `${streak} CHAIN`, {
      fontSize: "30px",
      fontStyle: "900",
      color: "#ff7a3d",
      stroke: "#fff7e8",
      strokeThickness: 7,
    })
    .setOrigin(0.5)
    .setDepth(1900)
    .setScale(0.8);
  scene.tweens.add({
    targets: text,
    y: 290,
    scale: 1.08,
    alpha: 0,
    duration: 620,
    ease: "Cubic.easeOut",
    onComplete: () => text.destroy(),
  });
}

/**
 * ルール切替への気づきとターボ到達を「習熟した瞬間」として強調する。
 * 正誤判定・制限時間・スコア計算は変更しない。
 */
export function installColorMatchPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalNextRound = proto.nextRound;
  if (originalNextRound && !proto.__momentPassNextRound) {
    proto.__momentPassNextRound = originalNextRound;
    proto.nextRound = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalNextRound.apply(this, args);
      const state = this as ColorScene;
      const mode = state.currentRound?.judgeMode;
      if (state.switched && (mode === "content" || mode === "color")) {
        showRuleShift(this, mode);
      }
      return result;
    };
  }

  const originalTurbo = proto.applyTurboResult;
  if (originalTurbo && !proto.__momentPassTurbo) {
    proto.__momentPassTurbo = originalTurbo;
    proto.applyTurboResult = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const state = this as ColorScene;
      const before = state.turboStreak ?? 0;
      const result = originalTurbo.apply(this, args);
      const after = state.turboStreak ?? 0;
      if (before < TURBO_ENTRY_STREAK && after === TURBO_ENTRY_STREAK) {
        showTurboEntry(this);
      } else if (after > TURBO_ENTRY_STREAK && after % 5 === 0) {
        showChainMilestone(this, after);
      }
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__hudPassUpdate) {
    proto.__hudPassUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      refreshMasteryHud(this as ColorScene);
      return result;
    };
  }
}
