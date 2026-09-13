import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

const PORTRAIT_KEY = "cm-bg-fantasy-portrait";
const LANDSCAPE_KEY = "cm-bg-fantasy-landscape";
const PORTRAIT_DEPTH = 1800;
const LANDSCAPE_DEPTH = 4200;

function addBackground(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  key: string,
  width: number,
  height: number,
): void {
  const marker = `fantasy-bg:${key}`;
  if (container.getData(marker)) return;
  if (!scene.textures.exists(key)) return;

  const image = scene.add
    .image(width / 2, height / 2, key)
    .setDisplaySize(width, height)
    .setOrigin(0.5)
    .setName(marker);

  // Existing fallback sky is child 0. Keep it for load-failure safety and place
  // the dedicated art directly above it, below all live gameplay UI.
  container.addAt(image, Math.min(1, container.length));
  container.setData(marker, true);
}

function ensureBackgrounds(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    if (child.depth === PORTRAIT_DEPTH) {
      addBackground(scene, child, PORTRAIT_KEY, 450, 800);
    } else if (child.depth === LANDSCAPE_DEPTH) {
      addBackground(scene, child, LANDSCAPE_KEY, 800, 450);
    }
  }
}

export function installColorFantasyBackground(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalPreload = proto.preload;
  if (!proto.__fantasyBackgroundPreload) {
    proto.__fantasyBackgroundPreload = originalPreload ?? (() => undefined);
    proto.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload?.apply(this, args);
      this.load.svg(PORTRAIT_KEY, `images/${PORTRAIT_KEY}.svg`);
      this.load.svg(LANDSCAPE_KEY, `images/${LANDSCAPE_KEY}.svg`);
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__fantasyBackgroundUpdate) {
    proto.__fantasyBackgroundUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      ensureBackgrounds(this);
      return result;
    };
  }
}
