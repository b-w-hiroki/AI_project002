import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

type Runtime = Phaser.Scene & {
  styleText?: Phaser.GameObjects.Text;
  statusPanel?: Phaser.GameObjects.Graphics;
};

function isPhone(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) <= 600;
}

function restylePrototypePlatforms(scene: Phaser.Scene): void {
  // The physics platforms are separate invisible bodies. These Rectangles are only their
  // visual placeholders, so they can be restyled without touching collision or jump tuning.
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Rectangle)) continue;

    if (Math.abs(child.displayWidth - 140) <= 2 && child.displayHeight <= 22 && child.depth === 1) {
      child.setFillStyle(0x5b4633, 0.98).setStrokeStyle(2, 0x315a31, 0.95);
      scene.add
        .rectangle(child.x, child.y - 8, child.displayWidth - 4, 5, 0x6b9c4c, 0.98)
        .setDepth(1.1);
      continue;
    }

    if (child.displayWidth >= 1200 && child.displayHeight >= 60) {
      child.setFillStyle(0x4a3829, 1);
    }
  }
}

function suppressLegacyPhoneChrome(scene: Runtime): void {
  if (!isPhone()) return;

  // The old style readout is useful on desktop, but competes with the dedicated mobile HUD.
  scene.styleText?.setVisible(false);

  // buildHud() creates fixed Graphics at depth 20. Keep the game-over/status panel, but
  // suppress the obsolete top HUD panels now replaced by mobileLayout.ts.
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Graphics)) continue;
    if (child === scene.statusPanel) continue;
    if (child.depth === 20 && child.scrollFactorX === 0 && child.scrollFactorY === 0) {
      child.setVisible(false);
    }
  }
}

export function installSideMobileScenePolish(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalCreate = proto.create;
  const originalUpdate = proto.update;
  if (!originalCreate || !originalUpdate || proto.__mobileScenePolishCreate) return;

  proto.__mobileScenePolishCreate = originalCreate;
  proto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalCreate.apply(this, args);
    restylePrototypePlatforms(this);
    suppressLegacyPhoneChrome(this as Runtime);
    return result;
  };

  proto.__mobileScenePolishUpdate = originalUpdate;
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate.apply(this, args);
    suppressLegacyPhoneChrome(this as Runtime);
    return result;
  };
}
