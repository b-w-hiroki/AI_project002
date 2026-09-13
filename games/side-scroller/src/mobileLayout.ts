import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { fakeKeyEvent } from "./ui/touch";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  state?: { health?: number; maxHealth?: number };
};

type Runtime = Phaser.Scene & {
  playerState?: PlayerState;
  status?: string;
  wave?: number;
  waveEnemiesAlive?: number;
  enemies?: BossEnemy[];
  attackKey?: Phaser.Input.Keyboard.Key;
  skillKey?: Phaser.Input.Keyboard.Key;
  guardKey?: Phaser.Input.Keyboard.Key;
  cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
};

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

type MobileUi = {
  root: Phaser.GameObjects.Container;
  chrome: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  objective: Phaser.GameObjects.Text;
  ougi: Phaser.GameObjects.Text;
  controls: Phaser.GameObjects.Container;
  portrait: boolean;
  phone: boolean;
};

const uiByScene = new WeakMap<object, MobileUi>();

function keyButton(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  radius: number,
  label: string,
  key: Phaser.Input.Keyboard.Key | undefined,
  color: number,
): void {
  if (!key) return;
  const circle = scene.add
    .circle(x, y, Math.max(24, radius), color, 0.78)
    .setStrokeStyle(2, 0xffffff, 0.72)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: radius >= 32 ? "16px" : "13px",
      fontStyle: "800",
      color: "#ffffff",
      align: "center",
    })
    .setOrigin(0.5);

  const release = () => requestAnimationFrame(() => key.onUp(fakeKeyEvent(scene)));
  circle.on("pointerdown", () => key.onDown(fakeKeyEvent(scene)));
  circle.on("pointerup", release);
  circle.on("pointerout", release);
  root.add([circle, text]);
}

function hideLegacyOrientationWarning(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    const isWarning = child.list.some(
      (item) => item instanceof Phaser.GameObjects.Text && item.text.includes("横向きにしてください"),
    );
    if (isWarning) child.setVisible(false);
  }
}

function buildUi(scene: Runtime): MobileUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const chrome = scene.add.graphics();
  const status = scene.add
    .text(18, 18, "", {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: "14px",
      fontStyle: "800",
      color: "#f4fbff",
    })
    .setOrigin(0, 0);
  const objective = scene.add
    .text(0, 18, "", {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: "13px",
      fontStyle: "800",
      color: "#fff0bd",
      align: "right",
    })
    .setOrigin(1, 0);
  const ougi = scene.add
    .text(0, 0, "", {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: "12px",
      fontStyle: "900",
      color: "#dff6ff",
    })
    .setOrigin(0.5);
  const controls = scene.add.container(0, 0);
  const root = scene.add
    .container(0, 0, [chrome, status, objective, ougi, controls])
    .setScrollFactor(0)
    .setDepth(2600);

  const ui: MobileUi = { root, chrome, status, objective, ougi, controls, portrait: false, phone: false };
  uiByScene.set(scene, ui);
  return ui;
}

function rebuildControls(scene: Runtime, ui: MobileUi, portrait: boolean): void {
  ui.controls.removeAll(true);
  const c = scene.add.container(0, 0);
  ui.controls.add(c);

  if (portrait) {
    keyButton(scene, c, 70, 700, 32, "←", scene.cursors?.left, 0x29485d);
    keyButton(scene, c, 142, 700, 32, "→", scene.cursors?.right, 0x29485d);
    keyButton(scene, c, 106, 632, 30, "跳", scene.cursors?.up, 0x46667b);
    keyButton(scene, c, 340, 695, 38, "斬", scene.attackKey, 0xc94f5f);
    keyButton(scene, c, 405, 625, 32, "技", scene.skillKey, 0x2e88c9);
    keyButton(scene, c, 405, 742, 28, "守", scene.guardKey, 0x55718a);
  } else {
    keyButton(scene, c, 72, 385, 29, "←", scene.cursors?.left, 0x29485d);
    keyButton(scene, c, 136, 385, 29, "→", scene.cursors?.right, 0x29485d);
    keyButton(scene, c, 104, 326, 27, "跳", scene.cursors?.up, 0x46667b);
    keyButton(scene, c, 716, 382, 36, "斬", scene.attackKey, 0xc94f5f);
    keyButton(scene, c, 646, 390, 31, "技", scene.skillKey, 0x2e88c9);
    keyButton(scene, c, 765, 326, 27, "守", scene.guardKey, 0x55718a);
  }
}

function applyLayout(scene: Runtime, layout: ViewportLayout): void {
  const ui = buildUi(scene);
  const phone = !layout.isTablet;
  ui.phone = phone;
  ui.root.setVisible(phone);
  hideLegacyOrientationWarning(scene);
  if (!phone) return;

  const portrait = layout.isPortrait;
  const target = portrait ? { width: 450, height: 800 } : { width: 800, height: 450 };
  const current = scene.scale.gameSize;
  if (current.width !== target.width || current.height !== target.height) {
    scene.scale.resize(target.width, target.height);
  }
  scene.cameras.main.setViewport(0, 0, target.width, target.height);
  scene.cameras.main.setFollowOffset(0, portrait ? -30 : 0);

  if (ui.portrait !== portrait || ui.controls.length === 0) {
    ui.portrait = portrait;
    rebuildControls(scene, ui, portrait);
  }

  ui.objective.setPosition(target.width - 18, 18);
  ui.ougi.setPosition(portrait ? 225 : 400, portrait ? 96 : 72);
}

function refresh(scene: Runtime): void {
  const ui = buildUi(scene);
  if (!ui.phone) return;

  const portrait = ui.portrait;
  const width = portrait ? 450 : 800;
  const height = portrait ? 800 : 450;
  const player = scene.playerState;
  const hp = player?.health ?? 0;
  const maxHp = Math.max(1, player?.maxHealth ?? 3);
  const gauge = player?.ougiGauge ?? 0;
  const boss = scene.enemies?.find((enemy) => enemy.boss);
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? scene.enemies?.length ?? 0);

  ui.chrome.clear();
  ui.chrome.fillStyle(0x071926, 0.9).fillRoundedRect(8, 8, width - 16, 82, 16);
  ui.chrome.lineStyle(2, 0x72cbe8, 0.55).strokeRoundedRect(8, 8, width - 16, 82, 16);

  const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
  ui.chrome.fillStyle(0x243a48, 1).fillRoundedRect(18, 62, portrait ? 170 : 230, 10, 5);
  ui.chrome.fillStyle(hpRatio < 0.34 ? 0xee635f : 0x55d783, 1).fillRoundedRect(18, 62, (portrait ? 170 : 230) * hpRatio, 10, 5);

  const gaugeRatio = Phaser.Math.Clamp(gauge / OUGI_GAUGE_MAX, 0, 1);
  ui.chrome.fillStyle(0x1d3446, 1).fillRoundedRect(portrait ? 226 : 292, 62, portrait ? 206 : 220, 10, 5);
  ui.chrome.fillStyle(0x4ba9ee, 1).fillRoundedRect(portrait ? 226 : 292, 62, (portrait ? 206 : 220) * gaugeRatio, 10, 5);

  if (portrait) {
    ui.chrome.fillStyle(0x081b29, 0.94).fillRect(0, 600, 450, 200);
    ui.chrome.lineStyle(1, 0x85d8ef, 0.3).lineBetween(0, 600, 450, 600);
  }

  if (boss) {
    const ratio = Phaser.Math.Clamp((boss.state?.health ?? 1) / Math.max(1, boss.state?.maxHealth ?? 1), 0, 1);
    const y = portrait ? 112 : 103;
    ui.chrome.fillStyle(0x35191c, 0.95).fillRoundedRect(width * 0.2, y, width * 0.6, 12, 6);
    ui.chrome.fillStyle(0xe54d55, 1).fillRoundedRect(width * 0.2, y, width * 0.6 * ratio, 12, 6);
  }

  ui.status.setText(`HP ${hp}/${maxHp}   WAVE ${scene.wave ?? 1}`);
  ui.objective.setText(boss ? "BOSSを斬れ" : `残敵 ${remaining}  ·  COMBOを伸ばせ`);
  ui.ougi.setText(gaugeRatio >= 1 ? "奥義 READY" : `奥義 ${Math.round(gaugeRatio * 100)}%`);
  ui.root.setVisible(scene.status === "playing");
  if (scene.status !== "playing") ui.controls.setVisible(false);
  else ui.controls.setVisible(true);

  // Portraitは下部200pxを操作帯にする。Landscapeは戦場を最大化する。
  if (portrait) {
    scene.cameras.main.setViewport(0, 0, 450, height);
  }
}

export function installSideMobileLayout(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalCreate = proto.create;
  const originalUpdate = proto.update;
  if (!originalCreate || !originalUpdate || proto.__mobileLayoutCreate) return;

  proto.__mobileLayoutCreate = originalCreate;
  proto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalCreate.apply(this, args);
    const scene = this as Runtime;
    hideLegacyOrientationWarning(scene);
    bindResponsiveScene(scene, (layout) => applyLayout(scene, layout));
    refresh(scene);
    return result;
  };

  proto.__mobileLayoutUpdate = originalUpdate;
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
