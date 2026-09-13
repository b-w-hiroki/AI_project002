import Phaser from "phaser";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { bossPhase, type CombatStyle } from "./logic/style";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  bornAt: number;
  state?: { health?: number; maxHealth?: number };
};
type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  enemies?: BossEnemy[];
  wave?: number;
  waveEnemiesAlive?: number;
  playerState?: PlayerState;
  combatStyle?: CombatStyle;
  status?: string;
};

type ActionChrome = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  stageText: Phaser.GameObjects.Text;
  missionText: Phaser.GameObjects.Text;
  comboText: Phaser.GameObjects.Text;
  bossText: Phaser.GameObjects.Text;
  ougiText: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, ActionChrome>();

function label(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight = "900",
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
  }).setOrigin(0.5).setScrollFactor(0);
  root.add(t);
  return t;
}

function build(scene: Runtime): ActionChrome {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setScrollFactor(0).setDepth(1780).setVisible(false);

  if (scene.textures.exists("sf-hero-swordsman")) {
    const portraitBg = scene.add.graphics().setScrollFactor(0);
    portraitBg.fillStyle(0x17334b, 0.96).fillCircle(57, 57, 42);
    portraitBg.lineStyle(3, 0x81d4ff, 0.86).strokeCircle(57, 57, 42);
    root.add(portraitBg);
    const portrait = scene.add.image(57, 66, "sf-hero-swordsman").setDisplaySize(61, 91).setScrollFactor(0);
    root.add(portrait);
  }

  const hpText = label(scene, root, 111, 35, "", 12, "#effaff", "900").setOrigin(0, 0.5);
  const stageText = label(scene, root, 400, 24, "", 15, "#ffffff", "900");
  const missionText = label(scene, root, 700, 40, "", 10, "#f6f3dc", "800");
  const comboText = label(scene, root, 98, 154, "", 25, "#ffd56f", "900").setAngle(-5).setStroke("#81240e", 6);
  const bossText = label(scene, root, 618, 132, "", 12, "#ffd5d1", "900");
  const ougiText = label(scene, root, 694, 472, "", 10, "#e8f7ff", "900");

  const ui = { root, graphics, hpText, stageText, missionText, comboText, bossText, ougiText };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.status === "playing";
  ui.root.setVisible(active);
  if (!active) return;

  const player = scene.playerState;
  const hp = player?.health ?? 0;
  const maxHp = Math.max(1, player?.maxHealth ?? 3);
  const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
  const armor = player?.armorCharges ?? 0;
  const combo = player?.comboStreak ?? 0;
  const ougi = player?.ougiGauge ?? 0;
  const ougiRatio = Phaser.Math.Clamp(ougi / OUGI_GAUGE_MAX, 0, 1);
  const wave = scene.wave ?? 1;
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? scene.enemies?.length ?? 0);
  const boss = scene.enemies?.find((e) => e.boss);
  const style = scene.combatStyle === "draw" ? "居合" : "連撃";

  ui.graphics.clear();
  // Dark jewel-like top HUD, matching the concept art while keeping the forest readable.
  ui.graphics.fillStyle(0x0c2230, 0.86).fillRoundedRect(16, 10, 240, 82, 17);
  ui.graphics.lineStyle(2, 0x7bd5e8, 0.72).strokeRoundedRect(16, 10, 240, 82, 17);
  ui.graphics.fillStyle(0x183142, 0.95).fillRoundedRect(110, 48, 128, 12, 6);
  ui.graphics.fillStyle(hpRatio <= 0.34 ? 0xf06c61 : 0x53d977, 1).fillRoundedRect(110, 48, 128 * hpRatio, 12, 6);
  ui.graphics.fillStyle(0x17334a, 0.95).fillRoundedRect(110, 67, 128, 9, 5);
  ui.graphics.fillStyle(0x46aaf1, 1).fillRoundedRect(110, 67, 128 * ougiRatio, 9, 5);

  ui.graphics.fillStyle(0x153047, 0.9).fillRoundedRect(306, 8, 188, 52, 14);
  ui.graphics.lineStyle(1.8, 0xb5e6ff, 0.62).strokeRoundedRect(306, 8, 188, 52, 14);
  const waveProgress = Phaser.Math.Clamp((wave % 5 || 5) / 5, 0.05, 1);
  ui.graphics.fillStyle(0x284a5d, 1).fillRoundedRect(330, 49, 140, 6, 3);
  ui.graphics.fillStyle(0x6bd8f4, 1).fillRoundedRect(330, 49, 140 * waveProgress, 6, 3);
  for (let i = 0; i < 3; i++) {
    const color = [0x54d86b, 0xffcc4a, 0xff754f][i]!;
    ui.graphics.fillStyle(color, 1).fillCircle(356 + i * 44, 52, 5);
  }

  ui.graphics.fillStyle(0x0d2637, 0.84).fillRoundedRect(610, 8, 174, 86, 15);
  ui.graphics.lineStyle(1.4, boss ? 0xf45c55 : 0x8bd7a3, 0.65).strokeRoundedRect(610, 8, 174, 86, 15);

  if (boss) {
    const health = Phaser.Math.Clamp((boss.state?.health ?? 1) / Math.max(1, boss.state?.maxHealth ?? 1), 0, 1);
    ui.graphics.fillStyle(0x31191b, 1).fillRoundedRect(573, 150, 204, 13, 7);
    ui.graphics.fillStyle(0xec3940, 1).fillRoundedRect(573, 150, 204 * health, 13, 7);
    ui.graphics.lineStyle(2, 0xffa49e, 0.72).strokeRoundedRect(573, 150, 204, 13, 7);
  }

  // Left virtual stick framing.
  ui.graphics.fillStyle(0x102337, 0.58).fillCircle(105, 500, 72);
  ui.graphics.lineStyle(4, 0xe2f5ff, 0.65).strokeCircle(105, 500, 72);
  ui.graphics.fillStyle(0x566f83, 0.7).fillCircle(105, 500, 34);
  ui.graphics.lineStyle(2, 0xffffff, 0.4).strokeCircle(105, 500, 34);

  // Premium circular skill cluster surrounding the real control area.
  [
    { x: 570, y: 530, r: 43, c: 0x217ee7 },
    { x: 663, y: 525, r: 43, c: 0x3a9ce9 },
    { x: 744, y: 445, r: 38, c: 0x5d7188 },
    { x: 744, y: 535, r: 38, c: 0x446276 },
  ].forEach(({ x, y, r, c }) => {
    ui.graphics.fillStyle(c, 0.32).fillCircle(x, y, r);
    ui.graphics.lineStyle(4, 0xe9f7ff, 0.72).strokeCircle(x, y, r);
    ui.graphics.lineStyle(2, c, 0.95).strokeCircle(x, y, r - 8);
  });
  // Simple iconography.
  ui.graphics.lineStyle(5, 0xffffff, 0.9).lineBetween(553, 546, 587, 514).lineBetween(554, 514, 586, 546);
  ui.graphics.lineStyle(5, 0xbfe9ff, 0.95).beginPath().arc(663, 525, 22, -1.0, 1.5).strokePath();
  ui.graphics.fillStyle(0xffffff, 0.9).fillTriangle(744, 424, 730, 448, 758, 448);
  ui.graphics.lineStyle(4, 0xffffff, 0.9).lineBetween(730, 547, 744, 522).lineBetween(744, 522, 758, 547);

  ui.hpText.setText(`Lv.28   HP ${hp}/${maxHp}   ARMOR ${armor}\n${style} STYLE`);
  ui.stageText.setText(`1-${wave}  緑風の森`);
  ui.missionText.setText(boss ? "★ BOSS撃破\n★ 被弾を抑える\n★ CHAINを伸ばす" : `★ WAVE突破\n★ 残敵 ${remaining}\n★ COMBOを伸ばす`);
  ui.comboText.setText(combo > 0 ? `${combo}\nCOMBO!` : "");
  ui.bossText.setText(boss ? `BOSS  ${bossPhase(scene.time.now - boss.bornAt).toUpperCase()}` : "");
  ui.ougiText.setText(ougiRatio >= 1 ? "OUGI READY" : `OUGI ${Math.round(ougiRatio * 100)}%`);
}

export function installSideConceptArtPass(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdateEnemies = proto.updateEnemies;
  if (!originalUpdateEnemies || proto.__conceptArtFidelityEnemies) return;
  proto.__conceptArtFidelityEnemies = originalUpdateEnemies;
  proto.updateEnemies = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdateEnemies.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
