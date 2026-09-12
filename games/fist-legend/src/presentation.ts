import Phaser from "phaser";
import { MAX_HP, OUGI_GAUGE_MAX } from "./logic/battle";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type FistRuntime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  beat?: number;
  timeRemainingSec?: number;
  battle?: {
    playerHp: number;
    enemyHp: number;
    playerGauge: number;
    enemyGauge: number;
  };
};

type ReadStats = {
  wins: number;
  losses: number;
  streak: number;
  maxStreak: number;
  ougiUsed: boolean;
};

interface BattleHud {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  roundText: Phaser.GameObjects.Text;
  playerText: Phaser.GameObjects.Text;
  enemyText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  gaugeText: Phaser.GameObjects.Text;
  readText: Phaser.GameObjects.Text;
  rewardText: Phaser.GameObjects.Text;
  moveHints: Phaser.GameObjects.Text[];
}

const hudByScene = new WeakMap<object, BattleHud>();
const statsByScene = new WeakMap<object, ReadStats>();
const resultTextByScene = new WeakMap<object, Phaser.GameObjects.Text>();

function newStats(): ReadStats {
  return { wins: 0, losses: 0, streak: 0, maxStreak: 0, ougiUsed: false };
}

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
      letterSpacing: 0.5,
    })
    .setOrigin(0.5);
}

function ensureBattleHud(scene: FistRuntime): BattleHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics();
  const roundText = uiText(scene, 400, 15, "ROUND 1", 11, "#e9c16e", "900");
  const playerText = uiText(scene, 30, 15, "PLAYER  覇拳士", 11, "#ffd4aa", "900").setOrigin(0, 0.5);
  const enemyText = uiText(scene, 770, 15, "RIVAL", 11, "#cbe4ff", "900").setOrigin(1, 0.5);
  const timerText = uiText(scene, 400, 42, "60", 28, "#fff1cf", "900");
  const gaugeText = uiText(scene, 187, 71, "", 10, "#f5c967", "900");
  const readText = uiText(scene, 613, 71, "", 10, "#9ec9ff", "900");
  const rewardText = uiText(scene, 400, 82, "勝利報酬  +60 豪拳石", 10, "#d7bd86", "800");
  const moveHints = [
    uiText(scene, 240, 444, "PUNCH  ·  気に強い", 10, "#ffb38d", "900"),
    uiText(scene, 400, 444, "KICK  ·  拳に強い", 10, "#9edca2", "900"),
    uiText(scene, 560, 444, "KI  ·  蹴に強い", 10, "#9fc9ff", "900"),
  ];

  const root = scene.add
    .container(0, 0, [frame, roundText, playerText, enemyText, timerText, gaugeText, readText, rewardText, ...moveHints])
    .setDepth(1700)
    .setVisible(false);
  const hud = { root, frame, roundText, playerText, enemyText, timerText, gaugeText, readText, rewardText, moveHints };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshBattleHud(scene: FistRuntime): void {
  const hud = ensureBattleHud(scene);
  const active = scene.phase === "battle" && !!scene.battle;
  hud.root.setVisible(active);
  if (!active || !scene.battle) return;

  const battle = scene.battle;
  const gauge = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);
  const enemyGauge = Phaser.Math.Clamp(battle.enemyGauge / OUGI_GAUGE_MAX, 0, 1);
  const playerHp = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
  const enemyHp = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
  const remaining = Math.max(0, Math.ceil(scene.timeRemainingSec ?? 0));
  const stats = statsByScene.get(scene) ?? newStats();

  hud.frame.clear();

  // Versus-game top plate: mirrored HP, round and timer. This intentionally covers the old utility HUD.
  hud.frame.fillStyle(0x100c0a, 0.93).fillRect(0, 0, 800, 92);
  hud.frame.fillStyle(0x3a1d17, 0.92).fillRoundedRect(24, 27, 300, 19, 6);
  hud.frame.fillStyle(0xd35237, 1).fillRoundedRect(24, 27, 300 * playerHp, 19, 6);
  hud.frame.fillStyle(0x17283d, 0.92).fillRoundedRect(476, 27, 300, 19, 6);
  const enemyW = 300 * enemyHp;
  hud.frame.fillStyle(0x5598dc, 1).fillRoundedRect(776 - enemyW, 27, enemyW, 19, 6);
  hud.frame.lineStyle(1.5, 0xf0c575, 0.7).strokeRoundedRect(24, 27, 300, 19, 6);
  hud.frame.lineStyle(1.5, 0xd7e8ff, 0.58).strokeRoundedRect(476, 27, 300, 19, 6);

  // Small Ougi rails under each HP bar.
  hud.frame.fillStyle(0x332a20, 1).fillRoundedRect(24, 53, 300, 5, 3);
  hud.frame.fillStyle(gauge >= 1 ? 0xffe06d : 0xc68e30, 1).fillRoundedRect(24, 53, 300 * gauge, 5, 3);
  hud.frame.fillStyle(0x24334a, 1).fillRoundedRect(476, 53, 300, 5, 3);
  hud.frame.fillStyle(0x6d9ccf, 1).fillRoundedRect(776 - 300 * enemyGauge, 53, 300 * enemyGauge, 5, 3);

  // Timer medallion.
  hud.frame.fillStyle(0x211711, 1).fillCircle(400, 43, 34);
  hud.frame.lineStyle(2.2, remaining <= 10 ? 0xe75d43 : 0xe2b45f, 0.95).strokeCircle(400, 43, 34);
  hud.frame.lineStyle(1, 0xffffff, 0.18).strokeCircle(400, 43, 28);

  // Bottom action deck: outlines only so the real interactive buttons stay visible and authoritative.
  const moveDeck = [
    { x: 240, color: 0xb3482d },
    { x: 400, color: 0x3a7840 },
    { x: 560, color: 0x355f91 },
  ];
  moveDeck.forEach(({ x, color }) => {
    hud.frame.lineStyle(3, color, 0.78).strokeRoundedRect(x - 58, 450, 116, 61, 14);
    hud.frame.lineStyle(1, 0xffffff, 0.28).strokeRoundedRect(x - 53, 455, 106, 51, 11);
  });
  hud.frame.lineStyle(gauge >= 1 ? 5 : 2, gauge >= 1 ? 0xffdd61 : 0xb28b45, gauge >= 1 ? 0.92 : 0.5);
  hud.frame.strokeRoundedRect(282, 519, 236, 53, 15);
  if (gauge >= 1) {
    hud.frame.lineStyle(8, 0xffd455, 0.15).strokeRoundedRect(278, 515, 244, 61, 18);
  }

  hud.timerText.setText(String(remaining).padStart(2, "0"));
  hud.timerText.setColor(remaining <= 10 ? "#ffb3a4" : "#fff1cf");
  hud.gaugeText.setText(gauge >= 1 ? "奥義 READY!" : `奥義 ${Math.round(gauge * 100)}%`);
  hud.gaugeText.setColor(gauge >= 1 ? "#fff4a8" : "#f5c967");
  hud.readText.setText(`READ WIN ${stats.wins}  ·  STREAK ${stats.streak}`);
  hud.rewardText.setText(`拳 > 気 > 蹴 > 拳   ·   EXCHANGE ${String((scene.beat ?? 0) + 1).padStart(2, "0")}`);
}

function showReadWin(scene: Phaser.Scene): void {
  const flash = scene.add.graphics().setDepth(2000).setAlpha(0.9);
  flash.fillStyle(0xffd36a, 0.16);
  flash.fillRect(0, 0, 800, 600);
  const slash = scene.add.graphics().setDepth(2001);
  slash.lineStyle(9, 0xfff2c2, 0.95).lineBetween(185, 420, 620, 120);
  slash.lineStyle(3, 0xd99c2b, 0.95).lineBetween(205, 438, 640, 138);
  const label = scene.add
    .text(400, 154, "読み勝ち！", {
      fontSize: "44px",
      fontStyle: "900",
      color: "#fff4ce",
      stroke: "#5e3515",
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(2002)
    .setScale(0.78);
  const sub = scene.add
    .text(400, 202, "相手の癖を捉えた  ·  奥義ゲージ上昇", {
      fontSize: "17px",
      fontStyle: "700",
      color: "#ffd36a",
      stroke: "#26150a",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(2002);

  scene.cameras.main.shake(85, 0.004);
  scene.tweens.add({ targets: label, scale: 1.08, duration: 120, ease: "Back.Out", yoyo: true });
  scene.tweens.add({
    targets: [flash, slash, label, sub],
    alpha: 0,
    duration: 360,
    delay: 230,
    ease: "Sine.easeIn",
    onComplete: () => {
      flash.destroy();
      slash.destroy();
      label.destroy();
      sub.destroy();
    },
  });
}

function showReadLoss(scene: Phaser.Scene): void {
  const warning = scene.add.graphics().setDepth(1999).setAlpha(0.85);
  warning.lineStyle(8, 0xb63a32, 0.72).strokeRect(6, 6, 788, 588);
  const label = scene.add
    .text(400, 150, "読まれた…", {
      fontSize: "28px",
      fontStyle: "800",
      color: "#ffb8aa",
      stroke: "#32110e",
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(2000);
  scene.cameras.main.shake(110, 0.006);
  scene.tweens.add({ targets: [warning, label], alpha: 0, duration: 300, delay: 140, onComplete: () => {
    warning.destroy();
    label.destroy();
  } });
}

function updateReadStats(scene: FistRuntime, clash: unknown): void {
  const stats = statsByScene.get(scene) ?? newStats();
  if (clash === "advantage") {
    stats.wins += 1;
    stats.streak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
  } else if (clash === "disadvantage") {
    stats.losses += 1;
    stats.streak = 0;
  }
  statsByScene.set(scene, stats);
}

function showResultSummary(scene: FistRuntime): void {
  resultTextByScene.get(scene)?.destroy();
  const stats = statsByScene.get(scene) ?? newStats();
  const line = scene.add
    .text(
      400,
      320,
      `読み勝ち ${stats.wins}回  ·  MAX STREAK ${stats.maxStreak}  ·  奥義 ${stats.ougiUsed ? "発動" : "未発動"}`,
      {
        fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
        fontSize: "14px",
        fontStyle: "800",
        color: "#d49b3d",
        backgroundColor: "rgba(255, 247, 225, 0.92)",
        padding: { x: 18, y: 9 },
      },
    )
    .setOrigin(0.5)
    .setDepth(1800);
  resultTextByScene.set(scene, line);
}

export function installFistLegendPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalStart = proto.startBattle;
  if (originalStart && !proto.__conceptVersusStart) {
    proto.__conceptVersusStart = originalStart;
    proto.startBattle = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      statsByScene.set(this, newStats());
      resultTextByScene.get(this)?.destroy();
      resultTextByScene.delete(this);
      return originalStart.apply(this, args);
    };
  }

  const originalClash = proto.showClash;
  if (originalClash && !proto.__conceptVersusClash) {
    proto.__conceptVersusClash = originalClash;
    proto.showClash = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalClash.apply(this, args);
      const runtime = this as FistRuntime;
      const clash = args[0];
      updateReadStats(runtime, clash);
      if (clash === "advantage") showReadWin(this);
      if (clash === "disadvantage") showReadLoss(this);
      return result;
    };
  }

  const originalOugi = proto.onPlayerOugi;
  if (originalOugi && !proto.__conceptVersusOugi) {
    proto.__conceptVersusOugi = originalOugi;
    proto.onPlayerOugi = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const runtime = this as FistRuntime;
      const ready = (runtime.battle?.playerGauge ?? 0) >= OUGI_GAUGE_MAX;
      const result = originalOugi.apply(this, args);
      if (ready) {
        const stats = statsByScene.get(this) ?? newStats();
        stats.ougiUsed = true;
        statsByScene.set(this, stats);
      }
      return result;
    };
  }

  const originalFinish = proto.finishBattle;
  if (originalFinish && !proto.__conceptVersusFinish) {
    proto.__conceptVersusFinish = originalFinish;
    proto.finishBattle = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalFinish.apply(this, args);
      showResultSummary(this as FistRuntime);
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__conceptVersusUpdate) {
    proto.__conceptVersusUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      refreshBattleHud(this as FistRuntime);
      return result;
    };
  }
}
