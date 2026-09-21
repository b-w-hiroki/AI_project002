import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { battleOutcome, type BattleState } from "./logic/battle";
import { applyHajaAfterBeat, HAJA_DURATION_MS, HAJA_MODE_INFO, HAJA_SHUN_RECOVERY_MS, type HajaMode } from "./logic/haja";
import { GameScene } from "./scenes/GameScene";
import { makeButton } from "./ui/theme";

type Sprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
type Method = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type Methods = Record<string, Method | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  battle?: BattleState;
  accepting?: boolean;
  playerSprite?: Sprite;
  enemySprite?: Sprite;
  hajaMode?: HajaMode | null;
  hajaRemainingMs?: number;
  hajaUsed?: boolean;
  refreshBattleVisual?: () => void;
  refreshTell?: () => void;
  finishBattle?: (timeUp: boolean) => void;
};
type Ui = {
  root: Phaser.GameObjects.Container;
  aura: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  buttons: ReturnType<typeof makeButton>[];
  enabled: boolean | null;
};

const MODES: HajaMode[] = ["go", "ju", "shun"];
const uiByScene = new WeakMap<object, Ui>();

function init(scene: Runtime): void {
  scene.hajaMode ??= null;
  scene.hajaRemainingMs ??= 0;
  scene.hajaUsed ??= false;
}

function activate(scene: Runtime, mode: HajaMode): void {
  init(scene);
  if (scene.phase !== "battle" || scene.hajaUsed) return;
  scene.hajaMode = mode;
  scene.hajaRemainingMs = HAJA_DURATION_MS;
  scene.hajaUsed = true;
  const info = HAJA_MODE_INFO[mode];
  scene.cameras.main.flash(120, (info.glow >> 16) & 0xff, (info.glow >> 8) & 0xff, info.glow & 0xff);
  scene.cameras.main.shake(mode === "go" ? 100 : 60, mode === "go" ? 0.005 : 0.0025);
}

function build(scene: Runtime): Ui {
  const cached = uiByScene.get(scene);
  if (cached) return cached;
  const aura = scene.add.graphics();
  const status = scene.add.text(400, 350, "", { fontSize: "14px", fontStyle: "800", color: "#ffe9b0", stroke: "#1d100b", strokeThickness: 4 }).setOrigin(0.5);
  const hint = scene.add.text(400, 368, "", { fontSize: "10px", fontStyle: "800", color: "#d9c7aa", stroke: "#1d100b", strokeThickness: 3 }).setOrigin(0.5);
  const buttons = MODES.map(mode => {
    const info = HAJA_MODE_INFO[mode];
    return makeButton(scene, 0, 0, 68, 32, info.shortLabel, () => activate(scene, mode), {
      fontSize: "14px", fillColor: info.accent, borderColor: info.glow,
    });
  });
  const root = scene.add.container(0, 0, [aura, status, hint, ...buttons.map(button => button.container)]).setDepth(3400).setVisible(false);
  const ui = { root, aura, status, hint, buttons, enabled: null };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  init(scene);
  const ui = build(scene);
  const visible = scene.phase === "battle" && !!scene.battle;
  ui.root.setVisible(visible);
  if (!visible) return;

  const layout = getResponsiveLayout(scene);
  const phone = !!layout && !layout.isTablet;
  const portrait = !!layout?.isPortrait;
  const width = scene.scale.gameSize.width;
  const xs = phone && portrait ? [110, 225, 340] : [330, 400, 470];
  const y = phone && portrait ? 610 : phone ? 337 : 388;
  const statusY = phone && portrait ? 570 : phone ? 300 : 350;
  const hintY = phone && portrait ? 588 : phone ? 317 : 368;
  const scale = phone && !portrait ? 0.92 : phone ? 1.08 : 1;

  ui.status.setPosition(width / 2, statusY);
  ui.hint.setPosition(width / 2, hintY);
  const enabled = !scene.hajaUsed;
  if (ui.enabled !== enabled) {
    ui.buttons.forEach(button => button.setEnabled(enabled));
    ui.enabled = enabled;
  }
  ui.buttons.forEach((button, index) => {
    const mode = MODES[index]!;
    button.container.setPosition(xs[index] ?? width / 2, y).setScale(scale);
    button.container.setAlpha(scene.hajaMode === mode ? 1 : scene.hajaUsed ? 0.34 : 0.88);
  });

  if (scene.hajaMode) {
    const info = HAJA_MODE_INFO[scene.hajaMode];
    ui.status.setText(`${info.label}  ${((scene.hajaRemainingMs ?? 0) / 1000).toFixed(1)}s`).setColor(`#${info.glow.toString(16).padStart(6, "0")}`);
    ui.hint.setText(info.description);
  } else if (scene.hajaUsed) {
    ui.status.setText("覇者モード 使用済").setColor("#a99986");
    ui.hint.setText("次ラウンドで再使用可能");
  } else {
    ui.status.setText("覇者モード 1回 / 5秒").setColor("#ffe9b0");
    ui.hint.setText("剛=威力  柔=軽減  瞬=速攻");
  }

  ui.aura.clear();
  if (!scene.hajaMode || !scene.playerSprite) return;
  const info = HAJA_MODE_INFO[scene.hajaMode];
  const p = scene.playerSprite;
  const pulse = 0.74 + Math.sin(scene.time.now / 115) * 0.12;
  ui.aura.lineStyle(5, info.accent, pulse).strokeEllipse(p.x, p.y + 34, phone && portrait ? 172 : 150, phone && portrait ? 224 : 204);
  ui.aura.lineStyle(2, info.glow, 0.6).strokeEllipse(p.x, p.y + 34, phone && portrait ? 190 : 168, phone && portrait ? 242 : 220);
}

function pop(scene: Runtime, text: string, color: number, enemy: boolean): void {
  const sprite = enemy ? scene.enemySprite : scene.playerSprite;
  if (!sprite) return;
  const label = scene.add.text(sprite.x, sprite.y - 92, text, {
    fontSize: "18px", fontStyle: "800", color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#1d100b", strokeThickness: 4,
  }).setOrigin(0.5).setDepth(3500);
  scene.tweens.add({ targets: label, y: label.y - 34, alpha: 0, duration: 520, onComplete: () => label.destroy() });
}

export function installFistHajaMode(): void {
  const proto = GameScene.prototype as unknown as Methods;
  if (proto.__hajaModeInstalled) return;
  proto.__hajaModeInstalled = proto.update ?? (() => undefined);
  proto.activateHajaMode = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const mode = args[0];
    if (mode === "go" || mode === "ju" || mode === "shun") activate(this as Runtime, mode);
    return undefined;
  };

  const originalCreate = proto.create;
  if (originalCreate) proto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalCreate.apply(this, args);
    init(this as Runtime); build(this as Runtime); refresh(this as Runtime);
    return result;
  };

  const originalStart = proto.startBattle;
  if (originalStart) proto.startBattle = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalStart.apply(this, args);
    const scene = this as Runtime;
    scene.hajaMode = null; scene.hajaRemainingMs = 0; scene.hajaUsed = false; refresh(scene);
    return result;
  };

  const originalMove = proto.onPlayerMove;
  if (originalMove) proto.onPlayerMove = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const scene = this as Runtime;
    const before = scene.phase === "battle" && scene.accepting && scene.battle ? { ...scene.battle } : null;
    const mode = before ? (scene.hajaMode ?? null) : null;
    const result = originalMove.apply(this, args);
    if (!before || !mode || !scene.battle) return result;
    const resolved = { ...scene.battle };
    const baseOutcome = battleOutcome(resolved, false);
    const adjusted = applyHajaAfterBeat(before, resolved, mode);
    scene.battle = adjusted.state;
    scene.refreshBattleVisual?.call(scene);
    if (adjusted.bonusDamage) pop(scene, `剛 +${adjusted.bonusDamage}`, HAJA_MODE_INFO.go.glow, true);
    if (adjusted.preventedDamage) pop(scene, `柔 -${adjusted.preventedDamage}`, HAJA_MODE_INFO.ju.glow, false);
    if (adjusted.bonusGauge) pop(scene, `瞬 +${adjusted.bonusGauge}%`, HAJA_MODE_INFO.shun.glow, false);
    const outcome = battleOutcome(adjusted.state, false);
    if (!baseOutcome && outcome) {
      scene.accepting = false;
      scene.time.delayedCall(400, () => scene.finishBattle?.call(scene, false));
    } else if (mode === "shun" && !outcome) {
      scene.time.delayedCall(HAJA_SHUN_RECOVERY_MS, () => {
        if (scene.phase !== "battle") return;
        scene.refreshTell?.call(scene);
        scene.accepting = true;
      });
    }
    return result;
  };

  const originalKey = proto.handleKeydown;
  if (originalKey) proto.handleKeydown = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const key = (args[0] as { key?: string } | undefined)?.key?.toLowerCase();
    const mode = key === "q" ? "go" : key === "w" ? "ju" : key === "e" ? "shun" : null;
    if (mode) { activate(this as Runtime, mode); return undefined; }
    return originalKey.apply(this, args);
  };

  const originalUpdate = proto.update;
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    const scene = this as Runtime;
    const delta = typeof args[1] === "number" ? args[1] : 0;
    if (scene.phase === "battle" && scene.hajaMode) {
      scene.hajaRemainingMs = Math.max(0, (scene.hajaRemainingMs ?? 0) - delta);
      if (!scene.hajaRemainingMs) scene.hajaMode = null;
    }
    refresh(scene);
    return result;
  };
}
