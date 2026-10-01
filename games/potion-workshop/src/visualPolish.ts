import Phaser from "phaser";
import type { GameState } from "./logic/economy";
import { IdleScene } from "./scenes/IdleScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & { state?: GameState };

type PolishUi = {
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Graphics;
};

const uiByScene = new WeakMap<object, PolishUi>();

function build(scene: Runtime): PolishUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const root = scene.add.container(0, 0).setDepth(111);
  const tint = scene.add.graphics();
  // Shift the pale card treatment toward the warm wood/parchment direction of the concept art.
  tint.fillStyle(0x7a4a24, 0.055).fillRect(0, 0, 800, 760);
  tint.fillStyle(0x6a3e20, 0.075).fillRoundedRect(18, 96, 386, 508, 24);
  tint.fillStyle(0x6a3e20, 0.11).fillRoundedRect(420, 96, 368, 508, 22);
  tint.fillStyle(0x6a3e20, 0.085).fillRoundedRect(15, 620, 770, 126, 18);
  root.add(tint);

  const ornaments = scene.add.graphics();
  ornaments.lineStyle(2, 0xc99a52, 0.5).strokeRoundedRect(18, 96, 386, 508, 24);
  ornaments.lineStyle(2, 0xc99a52, 0.52).strokeRoundedRect(420, 96, 368, 508, 22);
  ornaments.lineStyle(2, 0xc99a52, 0.48).strokeRoundedRect(15, 620, 770, 126, 18);
  ornaments.lineStyle(1, 0xf0d28f, 0.3).lineBetween(434, 124, 774, 124);
  ornaments.lineStyle(1, 0xf0d28f, 0.28).lineBetween(32, 646, 768, 646);
  root.add(ornaments);

  const glow = scene.add.graphics();
  root.add(glow);
  const ui = { root, glow };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);

  // Give the character and cauldron the visual dominance seen in the standalone concept.
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Image)) continue;
    if (child.texture.key === "pw-hero-alchemist") {
      child.setPosition(183, 266).setDisplaySize(354, 354);
    }
    if (child.texture.key === "pw-cauldron-icon") {
      child.setPosition(206, 456).setDisplaySize(238, 238);
    }
  }

  const potions = scene.state?.potions ?? 0;
  const pulse = 0.12 + Math.min(0.12, Math.log10(Math.max(1, potions + 1)) * 0.012);
  ui.glow.clear();
  ui.glow.fillStyle(0x6ef5ad, pulse).fillEllipse(206, 452, 246, 138);
  ui.glow.lineStyle(2, 0xffd978, 0.34).strokeEllipse(206, 452, 250, 142);
  ui.glow.fillStyle(0xffe8a8, 0.34).fillCircle(110, 173, 4);
  ui.glow.fillStyle(0x9ff2cf, 0.4).fillCircle(322, 190, 5);
  ui.glow.fillStyle(0xffd978, 0.38).fillCircle(340, 495, 4);
}

export function installPotionVisualPolish(): void {
  const proto = IdleScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtVisualQaUpdate) return;
  proto.__conceptArtVisualQaUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
