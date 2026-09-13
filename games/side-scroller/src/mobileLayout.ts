import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { bossPhase } from "./logic/style";
import { fakeKeyEvent } from "./ui/touch";
import { GameScene } from "./scenes/GameScene";

type BossEnemy = {
  boss: boolean;
  bornAt?: number;
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
  healthText?: Phaser.GameObjects.Text;
  scoreText?: Phaser.GameObjects.Text;
  weaponText?: Phaser.GameObjects.Text;
  skillText?: Phaser.GameObjects.Text;
  comboText?: Phaser.GameObjects.Text;
  itemsText?: Phaser.GameObjects.Text;
  gaugeBarBg?: Phaser.GameObjects.Rectangle;
  gaugeBarFill?: Phaser.GameObjects.Rectangle;
  gaugeLabel?: Phaser.GameObjects.Text;
  hiougiHint?: Phaser.GameObjects.Text;
  tipsHint?: Phaser.GameObjects.Text;
  pushCommand?: (token: "down" | "forward" | "back" | "attack", time: number) => void;
  tryTriggerSpecial?: (time: number) => void;
};

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

type TouchButton = {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

type MobileUi = {
  root: Phaser.GameObjects.Container;
  chrome: Phaser.GameObjects.Graphics;
  playerStatus: Phaser.GameObjects.Text;
  stage: Phaser.GameObjects.Text;
  objective: Phaser.GameObjects.Text;
  bossLabel: Phaser.GameObjects.Text;
  combo: Phaser.GameObjects.Text;
  ougiStatus: Phaser.GameObjects.Text;
  controls: Phaser.GameObjects.Container;
  ougiButton?: TouchButton;
  portrait: boolean;
  phone: boolean;
};

const uiByScene = new WeakMap<object, MobileUi>();

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#ffffff",
  align: "left" | "center" | "right" = "center",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: `${size}px`,
      fontStyle: "800",
      color,
      align,
    })
    .setOrigin(align === "left" ? 0 : align === "right" ? 1 : 0.5, 0.5);
}

function makeButton(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  radius: number,
  label: string,
  color: number,
  onDown: () => void,
  onUp?: () => void,
): TouchButton {
  const bg = scene.add
    .circle(0, 0, Math.max(24, radius), color, 0.86)
    .setStrokeStyle(radius >= 34 ? 3 : 2, 0xe9f7ff, 0.84)
    .setInteractive({ useHandCursor: true });
  const labelText = text(scene, 0, 0, label, radius >= 36 ? 17 : 13);
  const buttonRoot = scene.add.container(x, y, [bg, labelText]);
  buttonRoot.setSize(radius * 2, radius * 2);

  const release = () => {
    buttonRoot.setScale(1);
    onUp?.();
  };
  bg.on("pointerdown", () => {
    buttonRoot.setScale(0.93);
    onDown();
  });
  bg.on("pointerup", release);
  bg.on("pointerout", release);
  root.add(buttonRoot);
  return { root: buttonRoot, bg, label: labelText };
}

function keyButton(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  radius: number,
  label: string,
  key: Phaser.Input.Keyboard.Key | undefined,
  color: number,
): TouchButton | undefined {
  if (!key) return undefined;
  const releaseKey = () => requestAnimationFrame(() => key.onUp(fakeKeyEvent(scene)));
  return makeButton(
    scene,
    root,
    x,
    y,
    radius,
    label,
    color,
    () => key.onDown(fakeKeyEvent(scene)),
    releaseKey,
  );
}

function triggerOugi(scene: Runtime): void {
  if (!scene.pushCommand || !scene.tryTriggerSpecial) return;
  const now = scene.time.now;
  scene.pushCommand("down", now);
  scene.pushCommand("forward", now + 1);
  scene.pushCommand("attack", now + 2);
  scene.tryTriggerSpecial(now + 2);
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

function setLegacyHudVisible(scene: Runtime, visible: boolean): void {
  [
    scene.healthText,
    scene.scoreText,
    scene.weaponText,
    scene.skillText,
    scene.comboText,
    scene.itemsText,
    scene.gaugeBarBg,
    scene.gaugeBarFill,
    scene.gaugeLabel,
    scene.hiougiHint,
    scene.tipsHint,
  ].forEach((item) => item?.setVisible(visible));
}

function setLegacyPresentationVisible(scene: Phaser.Scene, visible: boolean): void {
  // presentation.ts / conceptArt.ts のHUDだけをスマホでは抑制する。
  // artFidelity(depth=1770) は戦闘FXなので残す。
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    if (child.depth === 118 || child.depth === 1780) child.setVisible(visible);
  }
}

function buildUi(scene: Runtime): MobileUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const chrome = scene.add.graphics();
  const playerStatus = text(scene, 20, 28, "", 13, "#f4fbff", "left");
  const stage = text(scene, 400, 25, "", 14, "#ffffff");
  const objective = text(scene, 780, 28, "", 12, "#fff0bd", "right");
  const bossLabel = text(scene, 400, 77, "", 12, "#ffd8cf");
  const combo = text(scene, 98, 126, "", 28, "#ffd56f", "left").setStroke("#5b210f", 5).setAngle(-5);
  const ougiStatus = text(scene, 400, 54, "", 10, "#dff6ff");
  const controls = scene.add.container(0, 0);
  const root = scene.add
    .container(0, 0, [chrome, playerStatus, stage, objective, bossLabel, combo, ougiStatus, controls])
    .setScrollFactor(0)
    .setDepth(2600)
    .setVisible(false);

  const ui: MobileUi = {
    root,
    chrome,
    playerStatus,
    stage,
    objective,
    bossLabel,
    combo,
    ougiStatus,
    controls,
    portrait: false,
    phone: false,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function rebuildControls(scene: Runtime, ui: MobileUi, portrait: boolean): void {
  ui.controls.removeAll(true);

  if (portrait) {
    // 左手: 十字。下入力を残し、しゃがみ/コマンド入力も失わない。
    keyButton(scene, ui.controls, 64, 708, 29, "←", scene.cursors?.left, 0x233d50);
    keyButton(scene, ui.controls, 132, 708, 29, "→", scene.cursors?.right, 0x233d50);
    keyButton(scene, ui.controls, 98, 646, 27, "↑", scene.cursors?.up, 0x355d78);
    keyButton(scene, ui.controls, 98, 766, 27, "↓", scene.cursors?.down, 0x355d78);

    keyButton(scene, ui.controls, 332, 706, 40, "斬", scene.attackKey, 0xd94f5b);
    keyButton(scene, ui.controls, 397, 640, 29, "跳", scene.cursors?.up, 0x42677f);
    keyButton(scene, ui.controls, 397, 708, 29, "技", scene.skillKey, 0x227fc5);
    keyButton(scene, ui.controls, 268, 756, 26, "守", scene.guardKey, 0x56677d);
    ui.ougiButton = makeButton(scene, ui.controls, 397, 770, 34, "奥義", 0xb97a16, () => triggerOugi(scene));
  } else {
    // 横持ちは戦場を最大化。操作は左右の下端へ追いやる。
    keyButton(scene, ui.controls, 72, 378, 27, "←", scene.cursors?.left, 0x233d50);
    keyButton(scene, ui.controls, 136, 378, 27, "→", scene.cursors?.right, 0x233d50);
    keyButton(scene, ui.controls, 104, 322, 25, "↑", scene.cursors?.up, 0x355d78);
    keyButton(scene, ui.controls, 104, 430, 25, "↓", scene.cursors?.down, 0x355d78);

    keyButton(scene, ui.controls, 716, 378, 40, "斬", scene.attackKey, 0xd94f5b);
    keyButton(scene, ui.controls, 766, 316, 27, "跳", scene.cursors?.up, 0x42677f);
    keyButton(scene, ui.controls, 645, 391, 29, "技", scene.skillKey, 0x227fc5);
    keyButton(scene, ui.controls, 584, 405, 24, "守", scene.guardKey, 0x56677d);
    ui.ougiButton = makeButton(scene, ui.controls, 770, 410, 32, "奥義", 0xb97a16, () => triggerOugi(scene));
  }
}

function applyLayout(scene: Runtime, layout: ViewportLayout): void {
  const ui = buildUi(scene);
  const phone = !layout.isTablet;
  ui.phone = phone;
  hideLegacyOrientationWarning(scene);

  setLegacyHudVisible(scene, !phone);
  setLegacyPresentationVisible(scene, !phone);
  ui.root.setVisible(phone && scene.status === "playing");
  if (!phone) return;

  const portrait = layout.isPortrait;
  const target = portrait ? { width: 450, height: 800 } : { width: 800, height: 450 };
  const current = scene.scale.gameSize;
  if (current.width !== target.width || current.height !== target.height) {
    scene.scale.resize(target.width, target.height);
  }
  scene.cameras.main.setViewport(0, 0, target.width, target.height);
  scene.cameras.main.setFollowOffset(0, portrait ? -34 : 0);

  if (ui.portrait !== portrait || ui.controls.length === 0) {
    ui.portrait = portrait;
    rebuildControls(scene, ui, portrait);
  }
}

function refresh(scene: Runtime): void {
  const ui = buildUi(scene);
  if (!ui.phone) return;

  setLegacyHudVisible(scene, false);
  setLegacyPresentationVisible(scene, false);
  hideLegacyOrientationWarning(scene);

  const portrait = ui.portrait;
  const width = portrait ? 450 : 800;
  const height = portrait ? 800 : 450;
  const player = scene.playerState;
  const hp = player?.health ?? 0;
  const maxHp = Math.max(1, player?.maxHealth ?? 3);
  const gauge = player?.ougiGauge ?? 0;
  const combo = player?.comboStreak ?? 0;
  const boss = scene.enemies?.find((enemy) => enemy.boss);
  const remaining = Math.max(0, scene.waveEnemiesAlive ?? scene.enemies?.length ?? 0);
  const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
  const gaugeRatio = Phaser.Math.Clamp(gauge / OUGI_GAUGE_MAX, 0, 1);

  ui.chrome.clear();

  // 上端だけをHUDとして使い、中央の戦場を遮らない。
  const hudH = portrait ? 98 : 68;
  ui.chrome.fillStyle(0x06141f, 0.84).fillRoundedRect(8, 8, width - 16, hudH, 15);
  ui.chrome.lineStyle(1.5, 0x6fcbe9, 0.45).strokeRoundedRect(8, 8, width - 16, hudH, 15);

  const hpX = portrait ? 18 : 18;
  const hpY = portrait ? 61 : 48;
  const hpW = portrait ? 174 : 220;
  ui.chrome.fillStyle(0x233b4a, 0.96).fillRoundedRect(hpX, hpY, hpW, 9, 5);
  ui.chrome.fillStyle(hpRatio < 0.34 ? 0xf05d5c : 0x4ed27f, 1).fillRoundedRect(hpX, hpY, hpW * hpRatio, 9, 5);

  const ougiX = portrait ? 218 : 260;
  const ougiY = hpY;
  const ougiW = portrait ? 214 : 154;
  ui.chrome.fillStyle(0x1a3244, 0.96).fillRoundedRect(ougiX, ougiY, ougiW, 9, 5);
  ui.chrome.fillStyle(gaugeRatio >= 1 ? 0xf5be35 : 0x42a9ed, 1).fillRoundedRect(ougiX, ougiY, ougiW * gaugeRatio, 9, 5);

  if (boss) {
    const ratio = Phaser.Math.Clamp((boss.state?.health ?? 1) / Math.max(1, boss.state?.maxHealth ?? 1), 0, 1);
    const y = portrait ? 116 : 82;
    const barX = portrait ? 62 : 458;
    const barW = portrait ? 326 : 320;
    ui.chrome.fillStyle(0x321719, 0.94).fillRoundedRect(barX, y, barW, 12, 6);
    ui.chrome.fillStyle(0xe7474f, 1).fillRoundedRect(barX, y, barW * ratio, 12, 6);
    ui.chrome.lineStyle(1.5, 0xffa197, 0.68).strokeRoundedRect(barX, y, barW, 12, 6);
  }

  // Portraitだけ下部に薄い操作帯を置く。Landscapeでは戦場を最後まで見せる。
  if (portrait) {
    ui.chrome.fillStyle(0x06131d, 0.82).fillRect(0, 606, 450, 194);
    ui.chrome.lineStyle(1, 0x72cbe8, 0.24).lineBetween(0, 606, 450, 606);
  }

  ui.playerStatus.setPosition(18, portrait ? 31 : 27).setText(`HP ${hp}/${maxHp}`);
  ui.stage.setPosition(width / 2, portrait ? 28 : 24).setText(`WAVE ${scene.wave ?? 1}`);
  ui.objective
    .setPosition(width - 18, portrait ? 31 : 27)
    .setText(boss ? "BOSS" : `残敵 ${remaining}`);
  ui.ougiStatus
    .setPosition(portrait ? 325 : 337, portrait ? 80 : 48)
    .setText(gaugeRatio >= 1 ? "奥義 READY" : `奥義 ${Math.round(gaugeRatio * 100)}%`);

  if (boss) {
    const phase = bossPhase(scene.time.now - (boss.bornAt ?? scene.time.now));
    const phaseText = phase === "tell" ? "DODGE" : phase === "charge" ? "DANGER" : "CHANCE";
    ui.bossLabel
      .setPosition(portrait ? 225 : 618, portrait ? 139 : 101)
      .setColor(phase === "charge" ? "#ff6a5a" : phase === "tell" ? "#ffc36d" : "#8feaff")
      .setText(`BOSS · ${phaseText}`);
  } else {
    ui.bossLabel.setText("");
  }

  ui.combo
    .setPosition(portrait ? 28 : 34, portrait ? 175 : 123)
    .setText(combo >= 2 ? `${combo} COMBO!` : "")
    .setScale(combo >= 10 ? 1.08 : 1);

  if (ui.ougiButton) {
    const ready = gaugeRatio >= 1;
    ui.ougiButton.root.setAlpha(ready ? 1 : 0.42);
    ui.ougiButton.bg.setFillStyle(ready ? 0xe5a51e : 0x6d5a35, ready ? 0.95 : 0.7);
    ui.ougiButton.label.setColor(ready ? "#ffffff" : "#d2c7a8");
  }

  const active = scene.status === "playing";
  ui.root.setVisible(active);
  ui.controls.setVisible(active);

  scene.cameras.main.setViewport(0, 0, width, height);
}

export function installSideMobileLayout(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  // Phoneでは旧仮想スティック群を生成せず、このファイルのレイアウトだけを使う。
  const legacyVirtualControls = proto.buildVirtualControls;
  if (legacyVirtualControls && !proto.__rebootVirtualControls) {
    proto.__rebootVirtualControls = legacyVirtualControls;
    proto.buildVirtualControls = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const shortEdge = Math.min(window.innerWidth, window.innerHeight);
      if (shortEdge <= 600) return undefined;
      return legacyVirtualControls.apply(this, args);
    };
  }

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
