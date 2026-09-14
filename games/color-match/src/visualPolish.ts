import Phaser from "phaser";
import { TURBO_ENTRY_STREAK, type Round } from "./logic/round";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  phase?: "title" | "playing" | "result";
  currentRound?: Round | null;
  turboStreak?: number;
};

type PolishUi = {
  root: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  cheer: Phaser.GameObjects.Text;
};

const uiByScene = new WeakMap<object, PolishUi>();

function build(scene: Runtime): PolishUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const graphics = scene.add.graphics();
  const cheer = scene.add
    .text(318, 631, "", {
      fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: "14px",
      fontStyle: "900",
      color: "#24538b",
      align: "center",
      lineSpacing: 3,
    })
    .setOrigin(0.5);
  const root = scene.add.container(0, 0, [graphics, cheer]).setDepth(1801).setVisible(false);
  const ui = { root, graphics, cheer };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  const ui = build(scene);
  const active = scene.phase === "playing" && !!scene.currentRound;
  ui.root.setVisible(active);
  if (!active) return;

  const streak = scene.turboStreak ?? 0;
  ui.graphics.clear();

  // Crown and tiny sparkle language around the score area.
  ui.graphics.fillStyle(0xffd64f, 1).fillTriangle(286, 22, 293, 35, 300, 22);
  ui.graphics.fillTriangle(299, 22, 306, 35, 313, 22);
  ui.graphics.fillRect(291, 34, 17, 5);
  const stars = [
    [18, 114, 0xffef74],
    [427, 106, 0xff9fcb],
    [28, 602, 0x91edff],
    [417, 565, 0xc0f58d],
    [208, 746, 0xffd96a],
  ] as const;
  stars.forEach(([x, y, color], i) => {
    ui.graphics.fillStyle(color, 0.75).fillCircle(x, y, i % 2 === 0 ? 5 : 4);
  });

  // Colored rule dots echo the concept art and make the current task readable at a glance.
  [0xe0447a, 0x2f8fd1, 0x1f8a63, 0xd6a71a].forEach((color, i) => {
    ui.graphics.fillStyle(color, 1).fillCircle(238 + i * 24, 181, 6);
    ui.graphics.lineStyle(1.5, 0xffffff, 0.8).strokeCircle(238 + i * 24, 181, 6);
  });

  // Keep the guide inside the dedicated gap between answer cards and NEXT.
  ui.graphics.fillStyle(0xffffff, 0.94).fillRoundedRect(258, 602, 112, 58, 15);
  ui.graphics.lineStyle(2, 0x70b9f3, 0.8).strokeRoundedRect(258, 602, 112, 58, 15);
  ui.graphics.fillStyle(0xffffff, 0.94).fillTriangle(367, 622, 380, 631, 367, 641);

  ui.cheer.setText(
    streak >= TURBO_ENTRY_STREAK
      ? `すごい！\nFLOW継続中！`
      : streak >= 2
        ? `${streak} CHAIN!\nその調子！`
        : "見て、考えて、\nタップ！",
  );
}

export function installColorVisualPolish(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__conceptArtVisualQaUpdate) return;
  proto.__conceptArtVisualQaUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}
