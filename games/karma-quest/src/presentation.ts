import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type KarmaScene = Phaser.Scene & {
  stage?: number;
  mandate?: { label?: string };
};

function showChapterCard(scene: KarmaScene): void {
  const stage = scene.stage ?? 1;
  const mandate = scene.mandate?.label ?? "新たな旅が始まる";

  const veil = scene.add.graphics().setDepth(2000).setAlpha(0);
  veil.fillStyle(0x0b1612, 0.78);
  veil.fillRect(0, 0, 450, 800);
  const crest = scene.add.graphics().setDepth(2001).setAlpha(0);
  crest.lineStyle(2, 0xd9b45a, 0.8);
  crest.strokeCircle(225, 286, 42);
  crest.lineBetween(190, 286, 260, 286);
  crest.lineBetween(225, 251, 225, 321);

  const year = scene.add
    .text(225, 365, `第 ${stage} 年`, {
      fontSize: "42px",
      fontStyle: "800",
      color: "#f4dd9d",
      stroke: "#14201c",
      strokeThickness: 7,
    })
    .setOrigin(0.5)
    .setDepth(2002)
    .setAlpha(0)
    .setScale(0.88);
  const subtitle = scene.add
    .text(225, 425, mandate, {
      fontSize: "15px",
      fontStyle: "700",
      color: "#e9e0ca",
      align: "center",
      wordWrap: { width: 350, useAdvancedWrap: true },
      stroke: "#14201c",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(2002)
    .setAlpha(0);
  const kicker = scene.add
    .text(225, 500, stage === 1 ? "勇者の伝説が始まる" : "前の選択が、次の旅を変える", {
      fontSize: "13px",
      color: "#b9c9bd",
      fontStyle: "700",
    })
    .setOrigin(0.5)
    .setDepth(2002)
    .setAlpha(0);

  scene.tweens.add({ targets: veil, alpha: 1, duration: 120 });
  scene.tweens.add({
    targets: [crest, year, subtitle, kicker],
    alpha: 1,
    duration: 180,
    delay: 80,
  });
  scene.tweens.add({
    targets: year,
    scale: 1,
    duration: 240,
    delay: 80,
    ease: "Back.Out",
  });
  scene.time.delayedCall(760, () => {
    scene.tweens.add({
      targets: [veil, crest, year, subtitle, kicker],
      alpha: 0,
      duration: 260,
      onComplete: () => {
        veil.destroy();
        crest.destroy();
        year.destroy();
        subtitle.destroy();
        kicker.destroy();
      },
    });
  });
}

function showChoiceEcho(scene: Phaser.Scene, accepted: boolean): void {
  const label = scene.add
    .text(225, 610, accepted ? "この盟約も、伝説に刻まれる" : "断った選択も、伝説になる", {
      fontSize: "16px",
      fontStyle: "800",
      color: accepted ? "#f4dd9d" : "#d7c7ef",
      stroke: "#14201c",
      strokeThickness: 5,
      align: "center",
    })
    .setOrigin(0.5)
    .setDepth(1900)
    .setAlpha(0)
    .setY(624);
  scene.tweens.add({
    targets: label,
    alpha: 1,
    y: 600,
    duration: 180,
    ease: "Sine.easeOut",
    yoyo: true,
    hold: 260,
    onComplete: () => label.destroy(),
  });
}

/**
 * 年次の切り替わりと選択の余韻だけを強化する。
 * カルマ値・評価・神託生成などゲームロジックは既存Sceneへ完全に委ねる。
 */
export function installKarmaQuestPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalShowKarma = proto.showKarmaPhase;
  if (originalShowKarma && !proto.__momentPassShowKarma) {
    proto.__momentPassShowKarma = originalShowKarma;
    proto.showKarmaPhase = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalShowKarma.apply(this, args);
      showChapterCard(this as KarmaScene);
      return result;
    };
  }

  const originalChoice = proto.onKarmaChoice;
  if (originalChoice && !proto.__momentPassKarmaChoice) {
    proto.__momentPassKarmaChoice = originalChoice;
    proto.onKarmaChoice = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const accepted = args[0] === true;
      const result = originalChoice.apply(this, args);
      showChoiceEcho(this, accepted);
      return result;
    };
  }
}
