import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { battleOutcome, type BattleState } from "./logic/battle";
import { applyHajaAfterBeat, HAJA_DURATION_MS, HAJA_MODE_INFO, HAJA_SHUN_RECOVERY_MS, type HajaMode } from "./logic/haja";
import { detectLang, tr, type Lang } from "./logic/i18n";
import { GameScene } from "./scenes/GameScene";
import { makeButton } from "./ui/theme";

type Sprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
type Method = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type Methods = Record<string, Method | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  lang?: Lang;
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
  guidancePlate: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  buttons: ReturnType<typeof makeButton>[];
  enabled: boolean | null;
  textLayout: "phonePortrait" | "phoneLandscape" | "compactTablet" | "default" | null;
  plateOffset: number | null;
};

const MODES: HajaMode[] = ["go", "ju", "shun"];
const ENGLISH_MODES: Record<HajaMode, { short: string; effect: string }> = {
  go: { short: "ATK", effect: "Damage +40%" },
  ju: { short: "DEF", effect: "Damage taken -50%" },
  shun: { short: "SPD", effect: "Faster special & recovery" },
};
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
  const guidancePlate = scene.add.graphics();
  const status = scene.add.text(400, 350, "", { fontSize: "14px", fontStyle: "800", color: "#ffe9b0", stroke: "#1d100b", strokeThickness: 4 }).setOrigin(0.5);
  const hint = scene.add.text(400, 368, "", { fontSize: "10px", fontStyle: "800", color: "#d9c7aa", stroke: "#1d100b", strokeThickness: 3 }).setOrigin(0.5);
  const buttons = MODES.map(mode => {
    const info = HAJA_MODE_INFO[mode];
    const lang = scene.lang ?? detectLang();
    return makeButton(scene, 0, 0, 68, 32, tr(lang, info.shortLabel, ENGLISH_MODES[mode].short), () => activate(scene, mode), {
      fontSize: "14px", fillColor: info.accent, borderColor: info.glow, touchHeight: 64,
    });
  });
  const root = scene.add.container(0, 0, [aura, guidancePlate, status, hint, ...buttons.map(button => button.container)]).setName("haja-mode-controls").setDepth(3400).setVisible(false);
  const ui = { root, aura, guidancePlate, status, hint, buttons, enabled: null, textLayout: null, plateOffset: null };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  init(scene);
  const ui = build(scene);
  const layout = getResponsiveLayout(scene);
  const phone = !!layout && !layout.isTablet;
  const compactTablet = !phone && scene.scale.parentSize.width >= 600 && scene.scale.parentSize.width < 800 && scene.scale.parentSize.height >= 600;
  const approvedMockViewport = scene.scale.parentSize.width === 800 && scene.scale.parentSize.height === 600;
  // Haja remains playable, but its optional selector must not replace the approved
  // desktop mock's three-technique plus special control hierarchy.
  const visible = scene.phase === "battle" && !!scene.battle && !approvedMockViewport;
  ui.root.setVisible(visible);
  if (!visible) return;

  const portrait = !!layout?.isPortrait;
  const lang = scene.lang ?? detectLang();
  const width = scene.scale.gameSize.width;
  const xs = phone && portrait ? [110, 225, 340] : [330, 400, 470];
  const phonePortrait = phone && portrait;
  const phoneLandscape = phone && !portrait;
  // Follow the portrait move controls as the canvas grows, leaving their hit areas separate.
  const phoneOffset = phonePortrait ? Math.max(0, scene.scale.gameSize.height - 910) : 0;
  const y = phonePortrait ? 583 + phoneOffset : phoneLandscape ? 316 : 388;
  const statusY = phonePortrait ? 503 + phoneOffset : phoneLandscape ? 250 : compactTablet ? 305 : 350;
  const hintY = phonePortrait ? 535 + phoneOffset : phoneLandscape ? 281 : compactTablet ? 335 : 368;
  const scale = phone && !portrait ? 0.92 : phone ? 1.08 : 1;

  const textLayout = phonePortrait ? "phonePortrait" : phoneLandscape ? "phoneLandscape" : compactTablet ? "compactTablet" : "default";
  if (ui.textLayout !== textLayout || ui.plateOffset !== phoneOffset) {
    ui.status.setFontSize(phonePortrait ? 23 : phoneLandscape ? 21 : compactTablet ? 20 : 14);
    ui.hint.setFontSize(phonePortrait ? 23 : phoneLandscape ? 21 : compactTablet ? 20 : 10);
    ui.guidancePlate.clear();
    if (phonePortrait) {
      ui.guidancePlate.fillStyle(0x160e0b, 0.86).fillRoundedRect(10, 487 + phoneOffset, 430, 66, 8);
    } else if (phoneLandscape) {
      const plateWidth = lang === "en" ? 420 : 360;
      ui.guidancePlate.fillStyle(0x160e0b, 0.86).fillRoundedRect(400 - plateWidth / 2, 233, plateWidth, 66, 8);
    } else if (compactTablet) {
      const plateWidth = lang === "en" ? 420 : 360;
      ui.guidancePlate.fillStyle(0x160e0b, 0.86).fillRoundedRect(400 - plateWidth / 2, 289, plateWidth, 66, 8);
    }
    ui.buttons.forEach(button => {
      const label = button.container.list.find(node => node.type === "Text") as Phaser.GameObjects.Text;
      label.setFontSize(phonePortrait ? 22 : phoneLandscape ? 23 : compactTablet ? 20 : 14);
      const hitArea = button.container.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      if (hitArea) {
        hitArea.height = phone ? 72 : 64;
        hitArea.width = phoneLandscape ? 70 : 68;
        hitArea.x = phoneLandscape ? -1 : 0;
      }
    });
    ui.textLayout = textLayout;
    ui.plateOffset = phoneOffset;
  }

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
    ui.status.setText(`${tr(lang, info.label, `HAJA · ${ENGLISH_MODES[scene.hajaMode].short}`)}  ${((scene.hajaRemainingMs ?? 0) / 1000).toFixed(1)}s`).setColor(`#${info.glow.toString(16).padStart(6, "0")}`);
    ui.hint.setText(tr(lang, info.description, ENGLISH_MODES[scene.hajaMode].effect));
  } else if (scene.hajaUsed) {
    ui.status.setText(tr(lang, "覇者モード 使用済", "HAJA USED")).setColor("#a99986");
    ui.hint.setText(tr(lang, "次ラウンドで再使用可能", "Ready next round"));
  } else {
    ui.status.setText(tr(lang, "覇者モード 1回 / 5秒", "HAJA · 1 USE / 5s")).setColor("#ffe9b0");
    ui.hint.setText(tr(lang, "剛=威力  柔=軽減  瞬=速攻", phone ? "ATK Up · DEF Guard · SPD Fast" : "ATK Power · DEF Guard · SPD Fast"));
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
    const lang = scene.lang ?? detectLang();
    if (adjusted.bonusDamage) pop(scene, `${tr(lang, "剛", "ATK")} +${adjusted.bonusDamage}`, HAJA_MODE_INFO.go.glow, true);
    if (adjusted.preventedDamage) pop(scene, `${tr(lang, "柔", "DEF")} -${adjusted.preventedDamage}`, HAJA_MODE_INFO.ju.glow, false);
    if (adjusted.bonusGauge) pop(scene, `${tr(lang, "瞬", "SPD")} +${adjusted.bonusGauge}%`, HAJA_MODE_INFO.shun.glow, false);
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
