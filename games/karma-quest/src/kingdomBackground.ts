import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

const PORTRAIT_KEY = "kq-bg-kingdom-portrait-v2";
const PORTRAIT_FALLBACK_KEY = "kq-bg-kingdom-portrait";
const LANDSCAPE_KEY = "kq-bg-kingdom-landscape";
const PORTRAIT_DEPTH = 1800;
const LANDSCAPE_DEPTH = 5200;

function installIntoContainer(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  key: string,
  width: number,
  height: number,
): void {
  const marker = `kingdom-bg:${key}`;
  if (container.getData(marker)) return;
  if (!scene.textures.exists(key)) return;

  const background = scene.add
    .image(width / 2, height / 2, key)
    .setOrigin(0.5)
    .setName(marker);

  // Cover the design canvas while preserving the source aspect ratio. The
  // generated art is never stretched; only the small horizontal overflow is cropped.
  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  background.setScale(Math.max(width / source.width, height / source.height));

  // index 0 is the existing code-drawn fallback world. Insert directly above it,
  // but keep every live UI / hero / parchment child above the new art.
  container.addAt(background, Math.min(1, container.length));
  container.setData(marker, true);
}

function ensureKingdomBackgrounds(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    if (child.depth === PORTRAIT_DEPTH) {
      const key = scene.textures.exists(PORTRAIT_KEY) ? PORTRAIT_KEY : PORTRAIT_FALLBACK_KEY;
      installIntoContainer(scene, child, key, 450, 800);
    } else if (child.depth === LANDSCAPE_DEPTH) {
      installIntoContainer(scene, child, LANDSCAPE_KEY, 800, 450);
    }
  }
}

export function installKarmaKingdomBackground(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalPreload = proto.preload;
  if (!proto.__kingdomBackgroundPreload) {
    proto.__kingdomBackgroundPreload = originalPreload ?? (() => undefined);
    proto.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload?.apply(this, args);
      this.load.image(PORTRAIT_KEY, `images/${PORTRAIT_KEY}.png`);
      this.load.svg(PORTRAIT_FALLBACK_KEY, `images/${PORTRAIT_FALLBACK_KEY}.svg`);
      this.load.svg(LANDSCAPE_KEY, `images/${LANDSCAPE_KEY}.svg`);
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__kingdomBackgroundUpdate) {
    proto.__kingdomBackgroundUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      ensureKingdomBackgrounds(this);
      return result;
    };
  }
}
