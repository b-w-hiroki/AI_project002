import Phaser from "phaser";
import { MAX_HP, OUGI_GAUGE_MAX } from "./logic/battle";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  timeRemainingSec?: number;
  beat?: number;
  battle?: {
    playerHp: number;
    enemyHp: number;
    playerGauge: number;
    enemyGauge: number;
  };
};

type VersusChrome = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Text;
  playerHp: Phaser.GameObjects.Text;
  enemyHp: Phaser.GameObjects.Text;
  centerText: Phaser.GameObjects.Text;
  ougiText: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, VersusChrome>();

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
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
  }).setOrigin(0.5);
  root.add(t);
  return t;
}

function build(scene: Runtime): VersusChrome {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics();
  const children: Phaser.GameObjects.GameObject[] = [graphics];
  const root = scene.add.container(0, 0, children).setDepth(1820).setVisible(false);

  // Portrait medallions use the same battle art, cropped visually by a dark circular backing.
  if (scene.textures.exists("fl-hero-fighter")) {
    const ring = scene.add.graphics();
    ring.fillStyle(0x24100d, 0.96).fillCircle(55, 55, 40);
    ring.lineStyle(3, 0xe16138, 0.9).strokeCircle(55, 55, 40);
    root.add(ring);
    const portrait = scene.add.image(55, 64, "fl-hero-fighter").setDisplaySize(62, 82);
    root.add(portrait);
  }
  if (scene.textures.exists("fl-enemy-fighter")) {
    const ring = scene.add.graphics();
    ring.fillStyle(0x101c31, 0.96).fillCircle(745, 55, 40);
    ring.lineStyle(3, 0x5aa7ef, 0.9).strokeCircle(745, 55, 40);
    root.add(ring);
    const portrait = scene.add.image(745, 64, "fl-enemy-fighter").setDisplaySize(62, 82);
    root.add(portrait);
  }

  const timer = label(scene, root, 400, 46, "60", 30, "#fff3cf", "900");
  const playerHp = label(scene, root, 102, 33, "", 11, "#ffe1bc", "900").setOrigin(0, 0.5);
  const enemyHp = label(scene, root, 698, 33, "", 11, "#d9ecff", "900").setOrigin(1, 0.5);
  const centerText = label(scene, root, 400, 14, "ROUND 1", 10, "#eac36f", "900");
  const ougiText = label(scene, root, 400, 565, "奥義", 14, "#fff0a6", "900");

  const ui = { root, graphics, timer, playerHp, enemyHp, centerText, ougiText };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "battle" && !!scene.battle;
  ui.root.setVisible(active);
  if (!active || !scene.battle) return;

  const battle = scene.battle;
  const pHp = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
  const eHp = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
  const pGauge = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);
  const eGauge = Phaser.Math.Clamp(battle.enemyGauge / OUGI_GAUGE_MAX, 0, 1);
  const remaining = Math.max(0, Math.ceil(scene.timeRemainingSec ?? 0));

  ui.graphics.clear();
  // Strong mirrored VS header matching the concept art.
  ui.graphics.fillStyle(0x120907, 0.78).fillRect(0, 0, 800, 98);
  ui.graphics.fillStyle(0x38140e, 0.98).fillRoundedRect(92, 25, 260, 23, 7);
  ui.graphics.fillStyle(0xee4e2d, 1).fillRoundedRect(92, 25, 260 * pHp, 23, 7);
  ui.graphics.fillStyle(0x10203b, 0.98).fillRoundedRect(448, 25, 260, 23, 7);
  ui.graphics.fillStyle(0x459cf1, 1).fillRoundedRect(708 - 260 * eHp, 25, 260 * eHp, 23, 7);
  ui.graphics.lineStyle(2, 0xffcb72, 0.86).strokeRoundedRect(92, 25, 260, 23, 7);
  ui.graphics.lineStyle(2, 0xaedcff, 0.78).strokeRoundedRect(448, 25, 260, 23, 7);

  // Gauge orbs: actual gauge ratio determines how many are lit.
  for (let i = 0; i < 3; i++) {
    const litP = pGauge >= (i + 1) / 3;
    const litE = eGauge >= (i + 1) / 3;
    ui.graphics.fillStyle(litP ? 0xff9d32 : 0x241815, 1).fillCircle(118 + i * 24, 65, 8);
    ui.graphics.lineStyle(1.5, 0xffcf75, 0.75).strokeCircle(118 + i * 24, 65, 8);
    ui.graphics.fillStyle(litE ? 0x59b8ff : 0x142036, 1).fillCircle(682 - i * 24, 65, 8);
    ui.graphics.lineStyle(1.5, 0xb8dcff, 0.7).strokeCircle(682 - i * 24, 65, 8);
  }

  // Central round crest.
  ui.graphics.fillStyle(0x1b110c, 0.98).fillCircle(400, 48, 39);
  ui.graphics.lineStyle(3, remaining <= 10 ? 0xff5b43 : 0xd7aa55, 0.95).strokeCircle(400, 48, 39);
  ui.graphics.lineStyle(1, 0xffffff, 0.17).strokeCircle(400, 48, 32);

  // Circular action ornaments around the existing real controls.
  [
    { x: 240, y: 480, r: 50, c: 0xd7492d },
    { x: 400, y: 480, r: 50, c: 0x3376b9 },
    { x: 560, y: 480, r: 50, c: 0x3a9a65 },
  ].forEach(({ x, y, r, c }) => {
    ui.graphics.fillStyle(c, 0.13).fillCircle(x, y, r);
    ui.graphics.lineStyle(4, c, 0.82).strokeCircle(x, y, r);
    ui.graphics.lineStyle(1, 0xffffff, 0.34).strokeCircle(x, y, r - 7);
  });
  const ougiReady = pGauge >= 1;
  ui.graphics.fillStyle(0xf3b61e, ougiReady ? 0.22 : 0.07).fillCircle(400, 545, 78);
  ui.graphics.lineStyle(ougiReady ? 6 : 3, ougiReady ? 0xffd33f : 0xa4803e, ougiReady ? 0.95 : 0.55).strokeCircle(400, 545, 72);
  if (ougiReady) {
    ui.graphics.lineStyle(10, 0xffdf4f, 0.12).strokeCircle(400, 545, 80);
  }

  ui.playerHp.setText(`リュウガ  ${battle.playerHp}/${MAX_HP}`);
  ui.enemyHp.setText(`カイエン  ${battle.enemyHp}/${MAX_HP}`);
  ui.timer.setText(String(remaining));
  ui.timer.setColor(remaining <= 10 ? "#ffb3a5" : "#fff3cf");
  ui.centerText.setText(`ROUND 1  ·  EXCHANGE ${(scene.beat ?? 0) + 1}`);
  ui.ougiText.setText(ougiReady ? "奥義 READY" : `奥義 ${Math.round(pGauge * 100)}%`);
  ui.ougiText.setColor(ougiReady ? "#fff2a0" : "#caa45d");
}

export function installFistConceptArtPass(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtFidelityUpdate) return;
  proto.__conceptArtFidelityUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
