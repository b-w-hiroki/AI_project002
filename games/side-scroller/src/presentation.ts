import Phaser from "phaser";
import { type PlayerState } from "./logic/combat";
import { bossPhase, type CombatStyle } from "./logic/style";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  bornAt: number;
  bossDir: 1 | -1;
};

type GameRuntime = Phaser.Scene & {
  enemies: BossEnemy[];
  wave?: number;
  waveEnemiesAlive?: number;
  playerState?: PlayerState;
  combatStyle?: CombatStyle;
  status?: string;
};

interface WaveHud {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
}

const lastPhase = new WeakMap<object, string>();
const hudByScene = new WeakMap<object, WaveHud>();

function ensureWaveHud(scene: GameRuntime): WaveHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics().setScrollFactor(0);
  const title = scene.add
    .text(400, 18, "", {
      fontFamily: "sans-serif",
      fontSize: "13px",
      fontStyle: "900",
      color: "#34445d",
      letterSpacing: 0.5,
    })
    .setOrigin(0.5)
    .setScrollFactor(0);
  const sub = scene.add
    .text(400, 40, "", {
      fontFamily: "sans-serif",
      fontSize: "10px",
      fontStyle: "800",
      color: "#6c7890",
    })
    .setOrigin(0.5)
    .setScrollFactor(0);

  const root = scene.add
    .container(0, 0, [frame, title, sub])
    .setScrollFactor(0)
    .setDepth(120)
    .setVisible(false);
  const hud = { root, frame, title, sub };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshWaveHud(scene: GameRuntime): void {
  const hud = ensureWaveHud(scene);
  const active = scene.status === "playing";
  hud.root.setVisible(active);
  if (!active) return;

  const wave = scene.wave ?? 1;
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? scene.enemies.length);
  const player = scene.playerState;
  const combo = player?.comboStreak ?? 0;
  const boss = scene.enemies.some((enemy) => enemy.boss);
  const style = scene.combatStyle === "draw" ? "居合" : "連撃";
  const objective = boss ? "BOSSを倒せ" : remaining > 0 ? `残敵 ${remaining}` : "WAVE CLEAR";

  hud.frame.clear();
  hud.frame.fillStyle(0xffffff, 0.9);
  hud.frame.fillRoundedRect(292, 7, 216, 45, 13);
  hud.frame.lineStyle(1.5, boss ? 0xe0447a : 0x8a4fd1, boss ? 0.85 : 0.45);
  hud.frame.strokeRoundedRect(292, 7, 216, 45, 13);
  if (boss) {
    hud.frame.fillStyle(0xe0447a, 0.12);
    hud.frame.fillRoundedRect(296, 11, 208, 37, 10);
  }

  hud.title.setText(`WAVE ${wave}  ·  ${objective}`);
  hud.title.setColor(boss ? "#a72f58" : "#34445d");
  hud.sub.setText(`${style} STYLE  ·  COMBO ×${combo}  ·  SCORE ${player?.score ?? 0}`);
}

function announce(
  scene: Phaser.Scene,
  text: string,
  color: string,
  duration = 520,
): void {
  const label = scene.add
    .text(400, 154, text, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      fontStyle: "800",
      color,
      stroke: "#201812",
      strokeThickness: 5,
      backgroundColor: "rgba(20, 15, 14, 0.72)",
      padding: { x: 16, y: 7 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(130)
    .setAlpha(0)
    .setScale(1.12);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    duration: 110,
    ease: "Back.easeOut",
  });
  scene.time.delayedCall(duration, () => {
    scene.tweens.add({
      targets: label,
      alpha: 0,
      y: 146,
      duration: 150,
      onComplete: () => label.destroy(),
    });
  });
}

function pulseBorder(scene: Phaser.Scene, color: number): void {
  const frame = scene.add.graphics().setScrollFactor(0).setDepth(125);
  frame.lineStyle(5, color, 0.8).strokeRoundedRect(10, 10, 780, 580, 18);
  scene.tweens.add({
    targets: frame,
    alpha: 0,
    duration: 420,
    ease: "Sine.easeOut",
    onComplete: () => frame.destroy(),
  });
}

function chargeStreak(scene: Phaser.Scene, dir: 1 | -1): void {
  const streak = scene.add.graphics().setScrollFactor(0).setDepth(124);
  const fromX = dir === 1 ? 140 : 660;
  const toX = dir === 1 ? 660 : 140;
  streak.lineStyle(7, 0xff8b63, 0.88).lineBetween(fromX, 340, toX, 340);
  streak.lineStyle(2, 0xffe0b0, 0.95).lineBetween(fromX, 333, toX, 333);
  streak.setScale(0.15, 1);
  scene.tweens.add({
    targets: streak,
    scaleX: 1,
    alpha: 0,
    duration: 230,
    ease: "Cubic.easeOut",
    onComplete: () => streak.destroy(),
  });
}

function onBossPhase(scene: GameRuntime, enemy: BossEnemy): void {
  const phase = bossPhase(scene.time.now - enemy.bornAt);
  if (lastPhase.get(scene) === phase) return;
  lastPhase.set(scene, phase);

  if (phase === "tell") {
    announce(scene, "予兆　突進方向を読む", "#ffd0a3", 560);
    pulseBorder(scene, 0xd85d47);
  } else if (phase === "charge") {
    scene.cameras.main.shake(120, 0.0035);
    chargeStreak(scene, enemy.bossDir);
  } else {
    announce(scene, "隙！　反撃", "#ffe17d", 650);
    pulseBorder(scene, 0xf0bd4f);
  }
}

/**
 * ボスAIはそのままに、予兆→突進→隙の読み合いを視覚的に強調する。
 * フェーズ切替時だけ生成するため、通常フレームの負荷は最小限に抑える。
 */
export function installSideScrollerPresentation(): void {
  const proto = GameScene.prototype as unknown as Record<string, unknown>;
  const originalUpdateEnemies = Reflect.get(proto, "updateEnemies") as
    | ((this: GameScene) => void)
    | undefined;
  if (!originalUpdateEnemies || Reflect.get(proto, "__hudPassUpdateEnemies")) return;

  Reflect.set(proto, "__hudPassUpdateEnemies", originalUpdateEnemies);
  Reflect.set(proto, "updateEnemies", function (this: GameScene) {
    originalUpdateEnemies.call(this);
    const runtime = this as unknown as GameRuntime;
    refreshWaveHud(runtime);
    const boss = runtime.enemies.find((enemy) => enemy.boss);
    if (!boss) {
      lastPhase.delete(runtime);
      return;
    }
    onBossPhase(runtime, boss);
  });
}
