import Phaser from "phaser";
import { MAX_HP, OUGI_GAUGE_MAX, type BattleState } from "./logic/battle";
import { GameScene } from "./scenes/GameScene";

type FighterSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  battle?: BattleState;
  accepting?: boolean;
  timeRemainingSec?: number;
  playerSprite?: FighterSprite;
  enemySprite?: FighterSprite;
};

type Clash = "advantage" | "disadvantage" | "tie";

type Layer = { root: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics };
const layers = new WeakMap<object, Layer>();
type CombatPose = {
  clash: Clash;
  startedAt: number;
  duration: number;
  playerX: number;
  enemyX: number;
  playerScaleX: number;
  playerScaleY: number;
  enemyScaleX: number;
  enemyScaleY: number;
};
const poses = new WeakMap<object, CombatPose>();

function reducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function drawImpactRays(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
): void {
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const inner = index % 2 === 0 ? 14 : 20;
    const outer = index % 3 === 0 ? 70 : 48;
    graphics.lineStyle(index % 3 === 0 ? 6 : 3, index % 2 ? 0xffffff : color, 0.82);
    graphics.lineBetween(
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
    );
  }
  graphics.fillStyle(0xffffff, 0.88).fillCircle(x, y, 10);
}

function showCombatState(scene: Runtime, clash: Clash): void {
  if (!scene.playerSprite || !scene.enemySprite) return;
  scene.children.getByName("combat-state-fx")?.destroy(true);
  const reduce = reducedMotion();
  const player = scene.playerSprite;
  const enemy = scene.enemySprite;
  const playerWins = clash === "advantage";
  const enemyWins = clash === "disadvantage";
  const attacker = playerWins ? player : enemyWins ? enemy : null;
  const defender = playerWins ? enemy : enemyWins ? player : null;
  const cx = (player.x + enemy.x) / 2;
  const cy = (player.y + enemy.y) / 2 - 14;
  const root = scene.add.container(0, 0).setDepth(2800).setName("combat-state-fx");

  if (attacker && defender) {
    const attackColor = playerWins ? 0xff713d : 0x66b9ff;
    const trail = scene.add.graphics().setName("combat-attack-trail");
    const direction = playerWins ? 1 : -1;
    for (let index = 0; index < 5; index += 1) {
      const offset = (index - 2) * 13;
      trail.lineStyle(10 - index, attackColor, 0.24 + index * 0.1);
      trail.lineBetween(
        attacker.x + direction * 42,
        attacker.y - 72 + offset,
        cx + direction * 38,
        cy - 18 + offset * 0.35,
      );
    }
    const burst = scene.add.graphics().setName("combat-hit-burst");
    drawImpactRays(burst, defender.x - direction * 48, defender.y - 56, attackColor);
    root.add([trail, burst]);

  } else {
    const guard = scene.add.graphics().setName("combat-guard-ring");
    for (const [fighter, color, start] of [
      [player, 0xff9b54, -1.05],
      [enemy, 0x78c9ff, Math.PI - 1.05],
    ] as const) {
      guard.lineStyle(8, color, 0.82).beginPath();
      guard.arc(fighter.x, fighter.y - 28, 68, start, start + 2.1, false).strokePath();
      guard.lineStyle(2, 0xffffff, 0.7).strokeCircle(fighter.x, fighter.y - 28, 76);
    }
    drawImpactRays(guard, cx, cy, 0xffd07d);
    root.add(guard);
  }

  if (reduce) {
    scene.time.delayedCall(260, () => root.destroy(true));
    return;
  }
  poses.set(scene, {
    clash,
    startedAt: scene.time.now,
    duration: 300,
    playerX: player.x,
    enemyX: enemy.x,
    playerScaleX: player.scaleX,
    playerScaleY: player.scaleY,
    enemyScaleX: enemy.scaleX,
    enemyScaleY: enemy.scaleY,
  });
  root.setScale(0.78).setAlpha(0.94);
  scene.tweens.add({
    targets: root,
    scale: 1.18,
    alpha: 0,
    duration: 360,
    ease: "Cubic.easeOut",
    onComplete: () => root.destroy(true),
  });
}

function build(scene: Runtime): Layer {
  const cached = layers.get(scene);
  if (cached) return cached;
  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setDepth(2790).setScrollFactor(0).setVisible(false);
  const layer = { root, graphics };
  layers.set(scene, layer);
  return layer;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "battle" && !!scene.battle && !!scene.playerSprite && !!scene.enemySprite;
  ui.root.setVisible(active);
  if (!active || !scene.battle || !scene.playerSprite || !scene.enemySprite) return;

  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  const g = ui.graphics;
  const battle = scene.battle;
  const player = scene.playerSprite;
  const enemy = scene.enemySprite;
  g.clear();

  // 左右の気配を明確に分け、炎 vs 氷の対戦構図を常時維持する。
  const pGauge = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);
  const eGauge = Phaser.Math.Clamp(battle.enemyGauge / OUGI_GAUGE_MAX, 0, 1);
  const pHp = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
  const eHp = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
  const motionTime = reducedMotion() ? 0 : scene.time.now;
  const pulse = 1 + Math.sin(motionTime / 180) * 0.05;

  g.fillStyle(0xff4e26, 0.045 + pGauge * 0.07).fillCircle(player.x, player.y, (portrait ? 112 : 138) * pulse);
  g.lineStyle(2 + pGauge * 3, 0xff8b43, 0.2 + pGauge * 0.35).strokeCircle(player.x, player.y, (portrait ? 96 : 118) * pulse);
  g.fillStyle(0x3c99ff, 0.045 + eGauge * 0.07).fillCircle(enemy.x, enemy.y, (portrait ? 112 : 138) * pulse);
  g.lineStyle(2 + eGauge * 3, 0x8bd4ff, 0.2 + eGauge * 0.35).strokeCircle(enemy.x, enemy.y, (portrait ? 96 : 118) * pulse);

  // HPが減るほど闘気にノイズ線を足す。危機感を文字だけにしない。
  const pDanger = 1 - pHp;
  const eDanger = 1 - eHp;
  for (let i = 0; i < 5; i++) {
    if (pDanger > 0.25) {
      const a = -1.2 + i * 0.42 + Math.sin(motionTime / 260 + i) * 0.08;
      g.lineStyle(2, 0xff6a3c, 0.12 + pDanger * 0.28).lineBetween(
        player.x + Math.cos(a) * 72,
        player.y + Math.sin(a) * 92,
        player.x + Math.cos(a) * 112,
        player.y + Math.sin(a) * 130,
      );
    }
    if (eDanger > 0.25) {
      const a = Math.PI + 0.3 + i * 0.42 + Math.sin(motionTime / 250 + i) * 0.08;
      g.lineStyle(2, 0x6abaff, 0.12 + eDanger * 0.28).lineBetween(
        enemy.x + Math.cos(a) * 72,
        enemy.y + Math.sin(a) * 92,
        enemy.x + Math.cos(a) * 112,
        enemy.y + Math.sin(a) * 130,
      );
    }
  }

  // 技が衝突した瞬間は中央へ十字スパーク。presentationの文字演出をアート側から補強する。
  if (scene.accepting === false) {
    const cx = (player.x + enemy.x) / 2;
    const cy = (player.y + enemy.y) / 2 - (portrait ? 20 : 8);
    const burst = 36 + Math.sin(motionTime / 45) * 8;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const color = i % 2 ? 0x79c8ff : 0xff9b45;
      g.lineStyle(i % 3 === 0 ? 5 : 2.5, color, 0.62).lineBetween(
        cx + Math.cos(a) * 10,
        cy + Math.sin(a) * 10,
        cx + Math.cos(a) * burst,
        cy + Math.sin(a) * burst,
      );
    }
    g.fillStyle(0xffffff, 0.78).fillCircle(cx, cy, 8);
  }

  // 炎/氷の微粒子。背景とキャラを一体にするが、操作UIには被せない。
  const particleCount = portrait ? 8 : 12;
  for (let i = 0; i < particleCount; i++) {
    const yBase = 120 + ((i * 59) % Math.max(120, height - 250));
    const drift = Math.sin(motionTime / 430 + i) * 10;
    const leftX = 16 + ((i * 41) % Math.max(60, width * 0.38));
    const rightX = width - 16 - ((i * 47) % Math.max(60, width * 0.38));
    g.fillStyle(i % 2 ? 0xffc05d : 0xff6539, 0.25).fillCircle(leftX + drift, yBase, i % 3 === 0 ? 3 : 1.7);
    g.fillStyle(i % 2 ? 0x78d6ff : 0x4d8fff, 0.25).fillCircle(rightX - drift, yBase + 7, i % 3 === 0 ? 3 : 1.7);
  }

  // 奥義100%は大きな外周リングで知らせる。
  if (pGauge >= 1) {
    const r = portrait ? 124 : 148;
    g.lineStyle(6, 0xffd452, 0.48 + Math.sin(motionTime / 120) * 0.16).strokeCircle(player.x, player.y, r * pulse);
  }
  if (eGauge >= 1) {
    const r = portrait ? 124 : 148;
    g.lineStyle(6, 0x86d9ff, 0.42 + Math.sin(motionTime / 125) * 0.15).strokeCircle(enemy.x, enemy.y, r * pulse);
  }

  // 残り10秒は画面端だけ赤く脈動。中央視認性は維持する。
  const remaining = Math.max(0, scene.timeRemainingSec ?? 0);
  if (remaining <= 10) {
    const alpha = 0.06 + (0.5 + 0.5 * Math.sin(motionTime / 120)) * 0.08;
    g.fillStyle(0xff351f, alpha).fillRect(0, 0, 8, height).fillRect(width - 8, 0, 8, height);
    g.fillStyle(0xff351f, alpha * 0.7).fillRect(0, 0, width, 6);
  }

  // 横画面の床に衝撃の亀裂を追加。
  if (!portrait) {
    const groundY = Math.min(height - 48, 390);
    g.lineStyle(2, 0xffc982, 0.16)
      .beginPath()
      .moveTo(width / 2, groundY)
      .lineTo(width / 2 - 35, groundY + 18)
      .lineTo(width / 2 - 70, groundY + 13)
      .moveTo(width / 2, groundY)
      .lineTo(width / 2 + 42, groundY + 20)
      .lineTo(width / 2 + 77, groundY + 14)
      .strokePath();
  }

  // Apply the pose after responsive layout has placed the fighters. A frame-driven
  // pose remains visible on both desktop and touch layouts without changing combat.
  const pose = poses.get(scene);
  if (pose) {
    const progress = Phaser.Math.Clamp((scene.time.now - pose.startedAt) / pose.duration, 0, 1);
    const amount = Math.sin(progress * Math.PI);
    if (progress >= 1 || scene.phase !== "battle") {
      player.setX(pose.playerX).setAngle(0).setScale(pose.playerScaleX, pose.playerScaleY);
      enemy.setX(pose.enemyX).setAngle(0).setScale(pose.enemyScaleX, pose.enemyScaleY);
      poses.delete(scene);
    } else if (pose.clash === "advantage") {
      player.setX(pose.playerX + 34 * amount).setAngle(-3 * amount)
        .setScale(pose.playerScaleX * (1 + 0.06 * amount), pose.playerScaleY * (1 + 0.03 * amount));
    } else if (pose.clash === "disadvantage") {
      enemy.setX(pose.enemyX - 34 * amount).setAngle(3 * amount)
        .setScale(pose.enemyScaleX * (1 + 0.06 * amount), pose.enemyScaleY * (1 + 0.03 * amount));
    } else {
      player.setX(pose.playerX - 8 * amount).setAngle(-1.5 * amount);
      enemy.setX(pose.enemyX + 8 * amount).setAngle(1.5 * amount);
    }
  }
}

export function installFistArtFidelity(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalClash = proto.showClash;
  if (originalClash && !proto.__artFidelityClash) {
    proto.__artFidelityClash = originalClash;
    proto.showClash = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalClash.apply(this, args);
      showCombatState(this as Runtime, args[0] as Clash);
      return result;
    };
  }
  const original = proto.update;
  if (proto.__artFidelityUpdate) return;
  proto.__artFidelityUpdate = original ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
