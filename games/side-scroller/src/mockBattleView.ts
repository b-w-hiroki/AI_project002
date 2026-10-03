import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { OUGI_GAUGE_MAX, type PlayerState } from "./logic/combat";
import { tr, type Lang } from "./logic/i18n";
import { fakeKeyEvent } from "./ui/touch";
import { GameScene } from "./scenes/GameScene";

type BattleStatus = "playing" | "gameover" | "clear";
type Direction = "left" | "right" | "up" | "down";

type Runtime = Phaser.Scene & {
  lang?: Lang;
  playerState?: PlayerState;
  status?: BattleStatus;
  styleChoosing?: boolean;
  combatStyle?: "chain" | "draw";
  wave?: number;
  waveEnemiesAlive?: number;
  enemies?: Array<{ boss: boolean; state?: { health?: number; maxHealth?: number } }>;
  cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  attackKey?: Phaser.Input.Keyboard.Key;
  skillKey?: Phaser.Input.Keyboard.Key;
  guardKey?: Phaser.Input.Keyboard.Key;
  virtualControls?: Phaser.GameObjects.Container;
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
  styleText?: Phaser.GameObjects.Text;
  tacticText?: Phaser.GameObjects.Text;
  pushCommand?: (token: "down" | "forward" | "back" | "attack", time: number) => void;
  tryTriggerSpecial?: (time: number) => void;
};

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

export interface BattleViewModel {
  readonly status: BattleStatus;
  readonly wave: number;
  readonly enemies: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly score: number;
  readonly combo: number;
  readonly ougi: number;
  readonly ougiReady: boolean;
  readonly bossHpRatio: number | null;
}

export function readBattleViewModel(scene: Runtime): BattleViewModel {
  const state = scene.playerState;
  const boss = scene.enemies?.find((enemy) => enemy.boss);
  const bossMax = Math.max(1, boss?.state?.maxHealth ?? 1);
  const ougi = Phaser.Math.Clamp(state?.ougiGauge ?? 0, 0, OUGI_GAUGE_MAX);
  return Object.freeze({
    status: scene.status ?? "playing",
    wave: Math.max(1, scene.wave ?? 1),
    enemies: Math.max(0, scene.waveEnemiesAlive ?? scene.enemies?.length ?? 0),
    hp: Math.max(0, state?.health ?? 0),
    maxHp: Math.max(1, state?.maxHealth ?? 1),
    score: Math.max(0, state?.score ?? 0),
    combo: Math.max(0, state?.comboStreak ?? 0),
    ougi,
    ougiReady: ougi >= OUGI_GAUGE_MAX,
    bossHpRatio: boss ? Phaser.Math.Clamp((boss.state?.health ?? 0) / bossMax, 0, 1) : null,
  });
}

/** Translates view gestures into the existing keyboard/command contract. */
export class BattleInputAdapter {
  constructor(private readonly scene: Runtime) {}

  press(direction: Direction): void {
    this.scene.cursors?.[direction].onDown(fakeKeyEvent(this.scene));
  }

  release(direction: Direction): void {
    const key = this.scene.cursors?.[direction];
    if (key) requestAnimationFrame(() => key.onUp(fakeKeyEvent(this.scene)));
  }

  pressAction(action: "attack" | "skill" | "guard"): void {
    this.actionKey(action)?.onDown(fakeKeyEvent(this.scene));
  }

  releaseAction(action: "attack" | "skill" | "guard"): void {
    const key = this.actionKey(action);
    if (key) requestAnimationFrame(() => key.onUp(fakeKeyEvent(this.scene)));
  }

  triggerOugi(): void {
    if (!this.scene.pushCommand || !this.scene.tryTriggerSpecial) return;
    const now = this.scene.time.now;
    this.scene.pushCommand("down", now);
    this.scene.pushCommand("forward", now + 1);
    this.scene.pushCommand("attack", now + 2);
    this.scene.tryTriggerSpecial(now + 2);
  }

  private actionKey(action: "attack" | "skill" | "guard"): Phaser.Input.Keyboard.Key | undefined {
    if (action === "attack") return this.scene.attackKey;
    if (action === "skill") return this.scene.skillKey;
    return this.scene.guardKey;
  }
}

type ActionButton = {
  root: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

const views = new WeakMap<object, SideBattleView>();

function makeText(scene: Phaser.Scene, value: string, size: number, color = "#ffffff"): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, value, {
    fontFamily: '"Trebuchet MS", "Yu Gothic", sans-serif',
    fontSize: `${size}px`,
    fontStyle: "bold",
    color,
  }).setOrigin(0.5).setStroke("#06131c", Math.max(2, Math.round(size / 7)));
}

function hideBaseHud(scene: Runtime): void {
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
    scene.styleText,
    scene.tacticText,
  ].forEach((object) => object?.setVisible(false));
  scene.virtualControls?.setVisible(false);
  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Container && child.depth === 200) child.setVisible(false);
  }
}

class SideBattleView {
  readonly root: Phaser.GameObjects.Container;
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly heroPortrait: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly stageText: Phaser.GameObjects.Text;
  private readonly missionText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly controls: Phaser.GameObjects.Container;
  private readonly adapter: BattleInputAdapter;
  private ougiButton?: ActionButton;
  private portrait = false;
  private active = false;

  constructor(private readonly scene: Runtime) {
    this.adapter = new BattleInputAdapter(scene);
    this.chrome = scene.add.graphics();
    this.heroPortrait = scene.add.image(0, 0, "sf-approved-hero-avatar").setDisplaySize(42, 42);
    this.title = makeText(scene, "BLADE WOODS", 10, "#e8f8ff");
    this.hpText = makeText(scene, "", 11);
    this.scoreText = makeText(scene, "", 9, "#f3d88d");
    this.stageText = makeText(scene, "", 13, "#ffffff");
    this.missionText = makeText(scene, "", 10, "#e5f8ff");
    this.comboText = makeText(scene, "", 30, "#ffe070").setOrigin(0, 0.5).setAngle(-7);
    this.controls = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [
      this.chrome,
      this.heroPortrait,
      this.title,
      this.hpText,
      this.scoreText,
      this.stageText,
      this.missionText,
      this.comboText,
      this.controls,
    ]).setScrollFactor(0).setDepth(2600).setName("side-mock-battle-view");

    // The base HUD draws two anonymous Graphics panels. They are presentation-only
    // and stay hidden while the game-over panel (initially invisible) remains intact.
    for (const child of scene.children.list) {
      if (child instanceof Phaser.GameObjects.Graphics && child.depth === 20 && child.visible) {
        child.setVisible(false);
      }
    }
  }

  applyLayout(layout: ViewportLayout): void {
    const portrait = layout.isPortrait;
    const logical = portrait ? { width: 450, height: 800 } : { width: 800, height: 450 };
    const gameSize = this.scene.scale.gameSize;
    if (gameSize.width !== logical.width || gameSize.height !== logical.height) {
      this.scene.scale.resize(logical.width, logical.height);
    }
    const fit = Math.min(
      Math.max(1, layout.contentWidth - 12) / logical.width,
      Math.max(1, layout.contentHeight - 8) / logical.height,
    );
    this.scene.scale.canvas.style.setProperty("width", `${Math.floor(logical.width * fit)}px`, "important");
    this.scene.scale.canvas.style.setProperty("height", `${Math.floor(logical.height * fit)}px`, "important");
    this.scene.scale.canvas.style.setProperty("margin", "0 auto", "important");
    this.scene.scale.updateBounds();
    this.scene.scale.displayScale.set(
      this.scene.scale.baseSize.width / this.scene.scale.canvasBounds.width,
      this.scene.scale.baseSize.height / this.scene.scale.canvasBounds.height,
    );
    this.scene.cameras.main.setViewport(0, 0, logical.width, logical.height);
    this.scene.cameras.main.setFollowOffset(0, portrait ? -42 : 24);
    this.scene.cameras.main.setZoom(1);

    if (!this.active || this.portrait !== portrait) {
      this.portrait = portrait;
      this.active = true;
      this.rebuildControls();
    }
    this.layoutLabels();
  }

  refresh(): void {
    hideBaseHud(this.scene);
    const vm = readBattleViewModel(this.scene);
    const width = this.portrait ? 450 : 800;
    const hpRatio = Phaser.Math.Clamp(vm.hp / vm.maxHp, 0, 1);
    const ougiRatio = vm.ougi / OUGI_GAUGE_MAX;
    const topH = this.portrait ? 108 : 72;

    this.chrome.clear();
    this.chrome.fillStyle(0x03131e, 0.83).fillRoundedRect(7, 7, width - 14, topH, 7);
    this.chrome.lineStyle(1.5, 0xb6e7ee, 0.78).strokeRoundedRect(7, 7, width - 14, topH, 7);
    this.chrome.fillStyle(0x0a2631, 0.92).fillRoundedRect(14, this.portrait ? 49 : 38, this.portrait ? 184 : 214, 11, 4);
    this.chrome.fillStyle(hpRatio < 0.34 ? 0xe8534f : 0x42d377, 1).fillRoundedRect(14, this.portrait ? 49 : 38, (this.portrait ? 184 : 214) * hpRatio, 11, 4);
    const gaugeX = this.portrait ? 220 : 245;
    const gaugeW = this.portrait ? 216 : 176;
    this.chrome.fillStyle(0x0a2631, 0.92).fillRoundedRect(gaugeX, this.portrait ? 49 : 38, gaugeW, 11, 4);
    this.chrome.fillStyle(vm.ougiReady ? 0xf5b62a : 0x2d9fdf, 1).fillRoundedRect(gaugeX, this.portrait ? 49 : 38, gaugeW * ougiRatio, 11, 4);

    if (vm.bossHpRatio !== null) {
      const y = this.portrait ? 124 : 82;
      const x = this.portrait ? 65 : 462;
      const w = this.portrait ? 320 : 315;
      this.chrome.fillStyle(0x240d12, 0.9).fillRoundedRect(x, y, w, 10, 3);
      this.chrome.fillStyle(0xef4d51, 1).fillRoundedRect(x, y, w * vm.bossHpRatio, 10, 3);
    }

    this.hpText.setText(`HP ${vm.hp}/${vm.maxHp}`);
    const lang = this.scene.lang ?? "ja";
    this.scoreText.setText(`${tr(lang, "得点", "SCORE")} ${vm.score.toLocaleString("en-US")}`);
    this.stageText.setText(tr(lang, `第${vm.wave}波`, `WAVE ${vm.wave}`));
    this.missionText.setText(tr(
      lang,
      `敵 ${vm.enemies}体  ·  奥義 ${Math.round(ougiRatio * 100)}%`,
      `${vm.enemies} ENEMIES  ·  OUGI ${Math.round(ougiRatio * 100)}%`,
    ));
    this.comboText.setText(vm.combo >= 2 ? tr(lang, `${vm.combo}連撃!`, `${vm.combo} COMBO!`) : "");

    if (this.ougiButton) {
      this.ougiButton.root.setAlpha(vm.ougiReady ? 1 : 0.48);
      this.ougiButton.face.setFillStyle(vm.ougiReady ? 0xf09518 : 0x56482f, 0.94);
    }
    const playing = vm.status === "playing" && !this.scene.styleChoosing;
    this.root.setVisible(playing);
    this.controls.setVisible(playing);
  }

  private layoutLabels(): void {
    if (this.portrait) {
      this.title.setPosition(102, 24);
      this.heroPortrait.setPosition(30, 54);
      this.hpText.setPosition(104, 72);
      this.scoreText.setPosition(370, 72);
      this.stageText.setPosition(225, 24);
      this.missionText.setPosition(225, 96);
      this.comboText.setPosition(20, 170);
    } else {
      this.title.setPosition(91, 20);
      this.heroPortrait.setPosition(34, 46);
      this.hpText.setPosition(101, 57);
      this.scoreText.setPosition(362, 57);
      this.stageText.setPosition(332, 20);
      this.missionText.setPosition(675, 25);
      this.comboText.setPosition(22, 126);
    }
  }

  private rebuildControls(): void {
    this.controls.removeAll(true);
    const lang = this.scene.lang ?? "ja";
    if (this.portrait) {
      this.addDpad(96, 695, 38);
      this.addKeyButton(343, 704, 43, tr(lang, "攻撃", "ATK"), 0xbf3f48, "attack");
      this.addKeyButton(407, 642, 30, tr(lang, "跳躍", "JMP"), 0x264b61, "up");
      this.addKeyButton(407, 715, 30, tr(lang, "技", "SKL"), 0x236896, "skill");
      this.addKeyButton(268, 756, 28, tr(lang, "防御", "GRD"), 0x334856, "guard");
      this.ougiButton = this.addButton(405, 778, 33, tr(lang, "奥義", "OUGI"), 0x8b6522, () => this.adapter.triggerOugi());
    } else {
      this.addDpad(86, 356, 34);
      this.addKeyButton(704, 356, 43, tr(lang, "攻撃", "ATK"), 0xbf3f48, "attack");
      this.addKeyButton(765, 291, 29, tr(lang, "跳躍", "JMP"), 0x264b61, "up");
      this.addKeyButton(766, 356, 29, tr(lang, "技", "SKL"), 0x236896, "skill");
      this.addKeyButton(628, 390, 27, tr(lang, "防御", "GRD"), 0x334856, "guard");
      this.ougiButton = this.addButton(752, 414, 32, tr(lang, "奥義", "OUGI"), 0x8b6522, () => this.adapter.triggerOugi());
    }
  }

  private addDpad(cx: number, cy: number, radius: number): void {
    const gap = radius * 1.45;
    this.addKeyButton(cx - gap, cy, radius * 0.72, "←", 0x17313e, "left");
    this.addKeyButton(cx + gap, cy, radius * 0.72, "→", 0x17313e, "right");
    this.addKeyButton(cx, cy - gap, radius * 0.72, "↑", 0x17313e, "up");
    this.addKeyButton(cx, cy + gap, radius * 0.72, "↓", 0x17313e, "down");
    const center = this.scene.add.circle(cx, cy, radius * 0.72, 0x07141c, 0.5).setStrokeStyle(1, 0xa3d4df, 0.55);
    this.controls.add(center);
  }

  private addKeyButton(
    x: number,
    y: number,
    radius: number,
    label: string,
    color: number,
    binding: Direction | "attack" | "skill" | "guard",
  ): ActionButton {
    const isDirection = binding === "left" || binding === "right" || binding === "up" || binding === "down";
    return this.addButton(
      x,
      y,
      radius,
      label,
      color,
      () => isDirection ? this.adapter.press(binding) : this.adapter.pressAction(binding),
      () => isDirection ? this.adapter.release(binding) : this.adapter.releaseAction(binding),
    );
  }

  private addButton(
    x: number,
    y: number,
    radius: number,
    label: string,
    color: number,
    onDown: () => void,
    onUp?: () => void,
  ): ActionButton {
    const shadow = this.scene.add.circle(3, 5, radius + 3, 0x02080c, 0.58);
    const rim = this.scene.add.circle(0, 0, radius + 3, 0x101e27, 0.92).setStrokeStyle(2, 0xb9dce4, 0.85);
    const face = this.scene.add.circle(0, 0, radius - 3, color, 0.88).setStrokeStyle(1.5, 0xe5f7fa, 0.62).setInteractive({ useHandCursor: true });
    const shine = this.scene.add.arc(0, -radius * 0.27, radius * 0.55, 205, 335, false, 0xffffff, 0.16);
    const buttonLabel = makeText(this.scene, label, radius >= 38 ? 16 : 12);
    const root = this.scene.add.container(x, y, [shadow, rim, face, shine, buttonLabel]);
    const release = () => {
      root.setScale(1);
      onUp?.();
    };
    face.on("pointerdown", () => {
      root.setScale(0.93);
      onDown();
    });
    face.on("pointerup", release);
    face.on("pointerout", release);
    this.controls.add(root);
    return { root, face, label: buttonLabel };
  }
}

function chooseStyleForMock(scene: Runtime): void {
  scene.combatStyle = "chain";
  scene.styleChoosing = false;
  scene.physics.resume();
}

export function installSideMockBattleView(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalCreate = proto.create;
  const originalUpdate = proto.update;
  const originalStyleChoice = proto.chooseCombatStyle;
  const originalVirtualControls = proto.buildVirtualControls;
  if (!originalCreate || !originalUpdate || !originalStyleChoice || !originalVirtualControls || proto.__mockBattleCreate) return;

  proto.__mockBattleStyleChoice = originalStyleChoice;
  proto.chooseCombatStyle = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const visualQa = new URLSearchParams(window.location.search).get("visualqa") === "battle";
    const shortEdge = Math.min(window.innerWidth, window.innerHeight);
    if (visualQa || shortEdge <= 600) {
      chooseStyleForMock(this as Runtime);
      return undefined;
    }
    return originalStyleChoice.apply(this, args);
  };

  proto.__mockBattleVirtualControls = originalVirtualControls;
  proto.buildVirtualControls = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    if (Math.min(window.innerWidth, window.innerHeight) <= 600) return undefined;
    return originalVirtualControls.apply(this, args);
  };

  proto.__mockBattleCreate = originalCreate;
  proto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalCreate.apply(this, args);
    const scene = this as Runtime;
    const view = new SideBattleView(scene);
    views.set(scene, view);
    hideBaseHud(scene);
    bindResponsiveScene(scene, (layout) => view.applyLayout(layout));
    view.refresh();
    return result;
  };

  proto.__mockBattleUpdate = originalUpdate;
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate.apply(this, args);
    views.get(this)?.refresh();
    return result;
  };
}
