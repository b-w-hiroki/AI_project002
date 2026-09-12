import Phaser from "phaser";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { bossPhase, type CombatStyle } from "./logic/style";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  bornAt: number;
  bossDir: 1 | -1;
  state?: { health?: number; maxHealth?: number };
};

type GameRuntime = Phaser.Scene & {
  enemies: BossEnemy[];
  wave?: number;
  waveEnemiesAlive?: number;
  playerState?: PlayerState;
  combatStyle?: CombatStyle;
  status?: string;
};

interface CombatHud {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  stageText: Phaser.GameObjects.Text;
  objectiveText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  weaponText: Phaser.GameObjects.Text;
  comboText: Phaser.GameObjects.Text;
  ougiText: Phaser.GameObjects.Text;
  bossText: Phaser.GameObjects.Text;
  controlsText: Phaser.GameObjects.Text;
}

const lastPhase = new WeakMap<object, string>();
const hudByScene = new WeakMap<object, CombatHud>();

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
      letterSpacing: 0.4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0);
}

function ensureCombatHud(scene: GameRuntime): CombatHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics().setScrollFactor(0);
  const stageText = uiText(scene, 400, 20, "", 14, "#32405a", "900");
  const objectiveText = uiText(scene, 400, 43, "", 11, "#647187", "800");
  const hpText = uiText(scene, 34, 29, "", 12, "#34465d", "900").setOrigin(0, 0.5);
  const weaponText = uiText(scene, 34, 55, "", 10, "#63748a", "800").setOrigin(0, 0.5);
  const comboText = uiText(scene, 757, 128, "", 18, "#8a4fd1", "900").setOrigin(1, 0.5);
  const ougiText = uiText(scene, 757, 153, "", 10, "#6c7890", "900").setOrigin(1, 0.5);
  const bossText = uiText(scene, 646, 52, "", 11, "#a62d50", "900").setOrigin(0.5);
  const controlsText = scene.add
    .text(708, 548, "ATTACK  X\nSKILL   C\nJUMP  SPACE\nOUGI  ↓↓X", {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: "10px",
      fontStyle: "800",
      color: "#ffffff",
      lineSpacing: 5,
      align: "right",
    })
    .setOrigin(1, 0.5)
    .setScrollFactor(0);

  const root = scene.add
    .container(0, 0, [frame, stageText, objectiveText, hpText, weaponText, comboText, ougiText, bossText, controlsText])
    .setScrollFactor(0)
    .setDepth(118)
    .setVisible(false);
  const hud = { root, frame, stageText, objectiveText, hpText, weaponText, comboText, ougiText, bossText, controlsText };
  hudByScene.set(scene, hud);
  return hud;
}

function drawPill(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border: number,
  alpha = 0.92,
): void {
  g.fillStyle(0x213047, 0.14).fillRoundedRect(x + 2, y + 3, w, h, h / 2);
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(1.2, border, 0.55).strokeRoundedRect(x, y, w, h, h / 2);
  g.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 2, y + 2, w - 4, Math.max(4, h * 0.28), h / 3);
}

function refreshCombatHud(scene: GameRuntime): void {
  const hud = ensureCombatHud(scene);
  const active = scene.status === "playing";
  hud.root.setVisible(active);
  if (!active) return;

  const wave = scene.wave ?? 1;
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? scene.enemies.length);
  const player = scene.playerState;
  const combo = player?.comboStreak ?? 0;
  const boss = scene.enemies.find((enemy) => enemy.boss);
  const style = scene.combatStyle === "draw" ? "居合" : "連撃";
  const objective = boss ? "BOSSを見切って斬り返せ" : remaining > 0 ? `敵をあと ${remaining} 体倒せ` : "WAVE CLEAR";
  const hp = player?.health ?? 0;
  const maxHp = Math.max(1, player?.maxHealth ?? 3);
  const armor = player?.armorCharges ?? 0;
  const ougi = player?.ougiGauge ?? 0;
  const weapon = player?.equippedWeapon === "mid" ? "長刀" : player?.equippedWeapon === "ranged" ? "飛刃" : "太刀";

  hud.frame.clear();

  // Top-left: compact player status card. Keeps the center playfield free.
  hud.frame.fillStyle(0xffffff, 0.91).fillRoundedRect(18, 9, 225, 62, 15);
  hud.frame.lineStyle(1.4, 0x79b7c8, 0.62).strokeRoundedRect(18, 9, 225, 62, 15);
  hud.frame.fillStyle(0xdbe9ee, 1).fillRoundedRect(34, 43, 188, 7, 4);
  hud.frame.fillStyle(hp <= 1 ? 0xe66b63 : 0x55b98b, 1).fillRoundedRect(34, 43, 188 * Phaser.Math.Clamp(hp / maxHp, 0, 1), 7, 4);

  // Top-center: stage strip and visible endpoint.
  hud.frame.fillStyle(0xffffff, 0.93).fillRoundedRect(275, 7, 250, 49, 15);
  hud.frame.lineStyle(1.4, boss ? 0xe0447a : 0x8a4fd1, boss ? 0.85 : 0.4).strokeRoundedRect(275, 7, 250, 49, 15);
  hud.frame.fillStyle(0xd9dff0, 1).fillRoundedRect(300, 52, 200, 4, 2);
  const stageProgress = ((wave - 1) % 5 + (remaining === 0 ? 1 : 0.35)) / 5;
  hud.frame.fillStyle(boss ? 0xe0447a : 0x8a4fd1, 1).fillRoundedRect(300, 52, 200 * Phaser.Math.Clamp(stageProgress, 0.05, 1), 4, 2);

  // Boss state replaces missions in the top-right.
  if (boss) {
    hud.frame.fillStyle(0xffedf2, 0.96).fillRoundedRect(565, 12, 216, 64, 15);
    hud.frame.lineStyle(1.8, 0xe0447a, 0.8).strokeRoundedRect(565, 12, 216, 64, 15);
    hud.frame.fillStyle(0xf3c5d2, 1).fillRoundedRect(584, 62, 178, 6, 3);
    const bossHealth = Phaser.Math.Clamp((boss.state?.health ?? 10) / Math.max(1, boss.state?.maxHealth ?? 10), 0, 1);
    hud.frame.fillStyle(0xd93261, 1).fillRoundedRect(584, 62, 178 * bossHealth, 6, 3);
  } else {
    hud.frame.fillStyle(0xffffff, 0.82).fillRoundedRect(622, 12, 159, 42, 13);
    hud.frame.lineStyle(1.1, 0x8fc1a7, 0.5).strokeRoundedRect(622, 12, 159, 42, 13);
  }

  // Combo and ougi are game-feel signals, not prose.
  if (combo >= 1) {
    drawPill(hud.frame, combo >= 30 ? 620 : 646, 105, combo >= 30 ? 160 : 134, 35, combo >= 30 ? 0x8a4fd1 : 0xffffff, 0x8a4fd1, combo >= 30 ? 0.96 : 0.9);
  }
  hud.frame.fillStyle(0x3d4d69, 0.75).fillRoundedRect(624, 161, 150, 5, 3);
  hud.frame.fillStyle(0x8a4fd1, 1).fillRoundedRect(624, 161, 150 * Phaser.Math.Clamp(ougi / OUGI_GAUGE_MAX, 0, 1), 5, 3);

  // Bottom-right game-control cluster. Purely visual; existing keyboard/touch bindings remain authoritative.
  hud.frame.fillStyle(0x17243a, 0.68).fillRoundedRect(612, 486, 172, 103, 18);
  hud.frame.lineStyle(1.2, 0xb7d8ea, 0.42).strokeRoundedRect(612, 486, 172, 103, 18);
  [[742, 536, 29, 0xff6483], [672, 525, 22, 0x65c6f0], [630, 557, 18, 0x78d39b]].forEach(([x, y, r, color]) => {
    hud.frame.fillStyle(color!, 0.72).fillCircle(x!, y!, r!);
    hud.frame.lineStyle(1.5, 0xffffff, 0.55).strokeCircle(x!, y!, r!);
  });

  hud.stageText.setText(`STAGE 1  ·  WAVE ${wave}`);
  hud.objectiveText.setText(objective);
  hud.hpText.setText(`HP ${hp}/${maxHp}   ARMOR ${armor}`);
  hud.weaponText.setText(`${weapon}  ·  ${style} STYLE`);
  hud.comboText.setText(combo >= 1 ? `COMBO ×${combo}` : "");
  hud.comboText.setColor(combo >= 30 ? "#ffffff" : combo >= 10 ? "#6f3db7" : "#8a4fd1");
  hud.ougiText.setText(`奥義 ${Math.floor((ougi / OUGI_GAUGE_MAX) * 100)}%`);
  hud.bossText.setText(boss ? "BOSS  ·  予兆を読め" : `BEST WAVE  ·  ${wave}`);
  hud.controlsText.setText("ATTACK  X\nSKILL   C\nJUMP  SPACE\nOUGI  ↓↓X");
}

function announce(scene: Phaser.Scene, text: string, color: string, duration = 520): void {
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

  scene.tweens.add({ targets: label, alpha: 1, scale: 1, duration: 110, ease: "Back.easeOut" });
  scene.time.delayedCall(duration, () => {
    scene.tweens.add({ targets: label, alpha: 0, y: 146, duration: 150, onComplete: () => label.destroy() });
  });
}

function pulseBorder(scene: Phaser.Scene, color: number): void {
  const frame = scene.add.graphics().setScrollFactor(0).setDepth(125);
  frame.lineStyle(5, color, 0.8).strokeRoundedRect(10, 10, 780, 580, 18);
  scene.tweens.add({ targets: frame, alpha: 0, duration: 420, ease: "Sine.easeOut", onComplete: () => frame.destroy() });
}

function chargeStreak(scene: Phaser.Scene, dir: 1 | -1): void {
  const streak = scene.add.graphics().setScrollFactor(0).setDepth(124);
  const fromX = dir === 1 ? 140 : 660;
  const toX = dir === 1 ? 660 : 140;
  streak.lineStyle(7, 0xff8b63, 0.88).lineBetween(fromX, 340, toX, 340);
  streak.lineStyle(2, 0xffe0b0, 0.95).lineBetween(fromX, 333, toX, 333);
  streak.setScale(0.15, 1);
  scene.tweens.add({ targets: streak, scaleX: 1, alpha: 0, duration: 230, ease: "Cubic.easeOut", onComplete: () => streak.destroy() });
}

function onBossPhase(scene: GameRuntime, enemy: BossEnemy): void {
  const phase = bossPhase(scene.time.now - enemy.bornAt);
  if (lastPhase.get(scene) === phase) return;
  lastPhase.set(scene, phase);

  if (phase === "tell") {
    announce(scene, "DODGE!　突進方向を読む", "#ffd0a3", 560);
    pulseBorder(scene, 0xd85d47);
  } else if (phase === "charge") {
    scene.cameras.main.shake(120, 0.0035);
    chargeStreak(scene, enemy.bossDir);
  } else {
    announce(scene, "CHANCE!　斬り返せ", "#ffe17d", 650);
    pulseBorder(scene, 0xf0bd4f);
  }
}

export function installSideScrollerPresentation(): void {
  const proto = GameScene.prototype as unknown as Record<string, unknown>;
  const originalUpdateEnemies = Reflect.get(proto, "updateEnemies") as ((this: GameScene) => void) | undefined;
  if (!originalUpdateEnemies || Reflect.get(proto, "__conceptCombatUpdateEnemies")) return;

  Reflect.set(proto, "__conceptCombatUpdateEnemies", originalUpdateEnemies);
  Reflect.set(proto, "updateEnemies", function (this: GameScene) {
    originalUpdateEnemies.call(this);
    const runtime = this as unknown as GameRuntime;
    refreshCombatHud(runtime);
    const boss = runtime.enemies.find((enemy) => enemy.boss);
    if (!boss) {
      lastPhase.delete(runtime);
      return;
    }
    onBossPhase(runtime, boss);
  });
}
