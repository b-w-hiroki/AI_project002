import Phaser from "phaser";
import { type PlayerState } from "./logic/combat";
import { bossPhase } from "./logic/style";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type EnemyView = {
  boss?: boolean;
  bornAt?: number;
  sprite?: Phaser.Physics.Arcade.Sprite;
};
type Runtime = Phaser.Scene & {
  status?: string;
  player?: Phaser.Physics.Arcade.Sprite;
  playerState?: PlayerState;
  enemies?: EnemyView[];
  wave?: number;
};

type Layer = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  bossArt?: Phaser.GameObjects.Image;
};
const layers = new WeakMap<object, Layer>();
const BOSS_ART_KEY = "sf-boss-forest-guardian";

function build(scene: Runtime): Layer {
  const cached = layers.get(scene);
  if (cached) return cached;
  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setScrollFactor(0).setDepth(1770).setVisible(false);
  let bossArt: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists(BOSS_ART_KEY)) {
    bossArt = scene.add.image(0, 0, BOSS_ART_KEY).setScrollFactor(0).setVisible(false);
    root.add(bossArt);
  }
  const layer = { root, graphics, bossArt };
  layers.set(scene, layer);
  return layer;
}

function screenPoint(scene: Phaser.Scene, sprite: Phaser.GameObjects.Components.Transform): { x: number; y: number } {
  return { x: sprite.x - scene.cameras.main.scrollX, y: sprite.y - scene.cameras.main.scrollY };
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.status === "playing" && !!scene.player;
  ui.root.setVisible(active);
  if (!active || !scene.player) return;

  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  const g = ui.graphics;
  g.clear();

  // 森を額縁化する薄い前景。操作領域を暗くしすぎない強度に抑える。
  g.fillStyle(0x0c2330, 0.12).fillRect(0, 0, width, portrait ? 92 : 72);
  g.fillStyle(0x07150d, portrait ? 0.2 : 0.14).fillRect(0, height - (portrait ? 205 : 82), width, portrait ? 205 : 82);

  // 風で流れる葉を前景に。背景画像とキャラの間に奥行きを作る。
  const leafCount = portrait ? 8 : 12;
  for (let i = 0; i < leafCount; i++) {
    const baseX = (i * 97 + 33) % width;
    const baseY = (i * 53 + 116) % Math.max(160, height - 120);
    const drift = (scene.time.now / (20 + i * 2)) % (width + 80);
    const x = (baseX + drift) % (width + 60) - 30;
    const y = baseY + Math.sin(scene.time.now / 560 + i) * 11;
    const color = i % 3 === 0 ? 0xd8f090 : i % 2 ? 0x70b85d : 0xa4d66f;
    g.fillStyle(color, 0.25).fillEllipse(x, y, i % 2 ? 9 : 12, i % 2 ? 4 : 5);
  }

  const playerPos = screenPoint(scene, scene.player);
  const combo = scene.playerState?.comboStreak ?? 0;
  const ougi = scene.playerState?.ougiGauge ?? 0;

  // 主人公の剣気。コンボが続くほど線を増やす。
  if (combo > 0) {
    const arcs = Math.min(4, 1 + Math.floor(combo / 3));
    for (let i = 0; i < arcs; i++) {
      const spread = 24 + i * 12;
      const alpha = 0.22 + Math.min(0.38, combo * 0.018) - i * 0.035;
      g.lineStyle(5 - i * 0.6, i % 2 ? 0x8ae8ff : 0xd9f8ff, alpha)
        .beginPath()
        .moveTo(playerPos.x - 42, playerPos.y - 22 + i * 7)
        .lineTo(playerPos.x + spread, playerPos.y - 52 - i * 6)
        .lineTo(playerPos.x + 68 + i * 9, playerPos.y - 10 + i * 4)
        .strokePath();
    }
  }

  // 奥義が溜まるほど足元へ青白いオーラを出す。
  const ougiRatio = Phaser.Math.Clamp(ougi / 100, 0, 1);
  if (ougiRatio > 0.12) {
    const pulse = 1 + Math.sin(scene.time.now / 220) * 0.06;
    g.fillStyle(0x4bb9ff, 0.06 + ougiRatio * 0.12).fillEllipse(playerPos.x, playerPos.y + 30, 108 * pulse, 32 * pulse);
    g.lineStyle(2, 0xb9efff, 0.12 + ougiRatio * 0.34).strokeEllipse(playerPos.x, playerPos.y + 30, 92 * pulse, 26 * pulse);
  }

  // BOSSは専用キーアートを物理スプライトへ追従させる。判定は元スプライトのままなのでゲーム性は変えない。
  const boss = scene.enemies?.find((enemy) => enemy.boss && enemy.sprite);
  if (boss?.sprite) {
    const pos = screenPoint(scene, boss.sprite);
    const phase = bossPhase(scene.time.now - (boss.bornAt ?? scene.time.now));
    const danger = phase === "charge" ? 0xff3f35 : phase === "tell" ? 0xffb34f : 0x6ee3ff;
    const radius = phase === "charge" ? 88 : 76;
    const pulse = 1 + Math.sin(scene.time.now / (phase === "charge" ? 90 : 180)) * 0.08;

    if (ui.bossArt) {
      boss.sprite.setAlpha(0);
      const size = portrait ? 154 : 176;
      ui.bossArt
        .setVisible(true)
        .setPosition(pos.x, pos.y - (portrait ? 25 : 30))
        .setDisplaySize(size * pulse, size * pulse)
        .setAlpha(phase === "charge" ? 1 : 0.96);
    } else {
      boss.sprite.setAlpha(1);
    }

    g.fillStyle(danger, phase === "charge" ? 0.14 : 0.075).fillCircle(pos.x, pos.y - 22, radius * pulse);
    g.lineStyle(phase === "charge" ? 5 : 3, danger, phase === "charge" ? 0.76 : 0.48).strokeCircle(pos.x, pos.y - 22, (radius - 8) * pulse);
    if (phase === "tell" || phase === "charge") {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + scene.time.now / 700;
        g.lineStyle(2, danger, 0.52).lineBetween(
          pos.x + Math.cos(a) * 94,
          pos.y - 22 + Math.sin(a) * 94,
          pos.x + Math.cos(a) * 118,
          pos.y - 22 + Math.sin(a) * 118,
        );
      }
    }
  } else if (ui.bossArt) {
    ui.bossArt.setVisible(false);
  }

  // 高コンボ時だけ地面に速度線を追加。常時派手にしない。
  if (combo >= 5) {
    const lineCount = Math.min(8, combo);
    for (let i = 0; i < lineCount; i++) {
      const y = height * 0.55 + ((i * 31) % Math.max(70, height * 0.25));
      const x = ((i * 109 + scene.time.now / 5) % (width + 120)) - 120;
      g.lineStyle(2, 0xe8fbff, 0.14).lineBetween(x, y, x + 68, y - 8);
    }
  }
}

export function installSideArtFidelity(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalPreload = proto.preload;
  if (!proto.__bossKeyArtPreload) {
    proto.__bossKeyArtPreload = originalPreload ?? (() => undefined);
    proto.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload?.apply(this, args);
      this.load.svg(BOSS_ART_KEY, `images/${BOSS_ART_KEY}.svg`);
      return result;
    };
  }

  const original = proto.update;
  if (proto.__artFidelityUpdate) return;
  proto.__artFidelityUpdate = original ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
