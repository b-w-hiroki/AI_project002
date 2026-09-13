import Phaser from "phaser";
import { CHALLENGE_MS, nextSwitchAt } from "./logic/challenge";
import { TURBO_ENTRY_STREAK } from "./logic/round";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "playing" | "result";
  sessionRemaining?: number;
  turboStreak?: number;
  turboPoints?: number;
  accepting?: boolean;
};

type Layer = { root: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics };
const layers = new WeakMap<object, Layer>();
const RAINBOW = [0xff5f78, 0xffb53d, 0xffdf52, 0x42d879, 0x48a8ff, 0xb268e8] as const;

function build(scene: Runtime): Layer {
  const cached = layers.get(scene);
  if (cached) return cached;
  const graphics = scene.add.graphics().setScrollFactor(0);
  const root = scene.add.container(0, 0, [graphics]).setDepth(2790).setScrollFactor(0).setVisible(false);
  const layer = { root, graphics };
  layers.set(scene, layer);
  return layer;
}

function star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    points.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(color, alpha).fillPoints(points, true);
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "playing";
  ui.root.setVisible(active);
  if (!active) return;

  const { width, height } = scene.scale.gameSize;
  const portrait = height >= width;
  const remaining = Phaser.Math.Clamp(scene.sessionRemaining ?? CHALLENGE_MS, 0, CHALLENGE_MS);
  const elapsed = CHALLENGE_MS - remaining;
  const untilSwitch = Math.max(0, nextSwitchAt(elapsed) - elapsed);
  const streak = scene.turboStreak ?? 0;
  const g = ui.graphics;
  g.clear();

  const frameAlpha = 0.14 + Math.min(0.18, streak * 0.012);
  RAINBOW.forEach((color, index) => {
    const inset = 4 + index * 2;
    g.lineStyle(2, color, frameAlpha * (1 - index * 0.08)).strokeRoundedRect(inset, inset, width - inset * 2, height - inset * 2, 22);
  });

  const particleCount = Math.min(portrait ? 18 : 24, 8 + Math.floor(streak * 0.8));
  for (let i = 0; i < particleCount; i++) {
    const xBase = (i * 83 + 29) % width;
    const yBase = (i * 61 + 94) % Math.max(160, height - 90);
    const x = xBase + Math.sin(scene.time.now / 490 + i) * 8;
    const y = yBase + Math.cos(scene.time.now / 620 + i * 0.7) * 10;
    const color = RAINBOW[i % RAINBOW.length]!;
    if (i % 3 === 0) star(g, x, y, 6 + (i % 2) * 2, color, 0.22);
    else g.fillStyle(color, 0.2).fillCircle(x, y, i % 2 ? 2.3 : 1.5);
  }

  if (streak >= 2) {
    const origin = portrait ? { x: 225, y: 515 } : { x: 470, y: 270 };
    const target = portrait ? { x: 372, y: 650 } : { x: 720, y: 275 };
    const segments = Math.min(8, 2 + Math.floor(streak / 2));
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 0.7) / segments;
      const sway = Math.sin(scene.time.now / 180 + i) * 12;
      const x0 = Phaser.Math.Linear(origin.x, target.x, t0);
      const y0 = Phaser.Math.Linear(origin.y, target.y, t0) + sway;
      const x1 = Phaser.Math.Linear(origin.x, target.x, Math.min(1, t1));
      const y1 = Phaser.Math.Linear(origin.y, target.y, Math.min(1, t1)) - sway * 0.55;
      g.lineStyle(3 + Math.min(3, streak * 0.1), RAINBOW[i % RAINBOW.length]!, 0.18 + Math.min(0.3, streak * 0.015)).lineBetween(x0, y0, x1, y1);
    }
  }

  if (streak >= TURBO_ENTRY_STREAK) {
    const cx = portrait ? 225 : 465;
    const cy = portrait ? 490 : 260;
    const pulse = 1 + Math.sin(scene.time.now / 150) * 0.05;
    RAINBOW.forEach((color, index) => {
      g.lineStyle(index === 0 ? 4 : 2, color, 0.16 + index * 0.02).strokeCircle(cx, cy, (portrait ? 178 : 190) * pulse - index * 7);
    });
  }

  if (untilSwitch <= 2000 && remaining > 0) {
    const alpha = 0.18 + (0.5 + 0.5 * Math.sin(scene.time.now / 110)) * 0.2;
    g.fillStyle(0xffe56b, alpha).fillRect(0, 0, width, portrait ? 10 : 8);
    for (let i = 0; i < 5; i++) {
      const x = width * (0.2 + i * 0.15);
      star(g, x, portrait ? 92 : 74, 8, RAINBOW[(i + 2) % RAINBOW.length]!, alpha * 1.6);
    }
  }

  if (remaining <= 10000) {
    const alpha = 0.06 + (0.5 + 0.5 * Math.sin(scene.time.now / 115)) * 0.09;
    g.fillStyle(0xff496d, alpha).fillRect(0, 0, 7, height).fillRect(width - 7, 0, 7, height);
    g.fillStyle(0xff496d, alpha * 0.8).fillRect(0, height - 7, width, 7);
  }

  if (scene.accepting === false) {
    const cx = portrait ? 225 : 475;
    const cy = portrait ? 350 : 220;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const r = 28 + Math.sin(scene.time.now / 55) * 6;
      const color = RAINBOW[i % RAINBOW.length]!;
      g.lineStyle(3, color, 0.52).lineBetween(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }
}

export function installColorArtFidelity(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const original = proto.update;
  if (proto.__artFidelityUpdate) return;
  proto.__artFidelityUpdate = original ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
