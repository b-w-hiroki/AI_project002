import Phaser from "phaser";
import { FACTION_LABEL, dominantFaction, type KarmaState } from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type KarmaScene = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  stage?: number;
  runEvaluation?: number;
  karma?: KarmaState;
  mandate?: { label?: string };
};

interface JourneyHud {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  yearText: Phaser.GameObjects.Text;
  phaseText: Phaser.GameObjects.Text;
  evalText: Phaser.GameObjects.Text;
  factionText: Phaser.GameObjects.Text;
  mandateText: Phaser.GameObjects.Text;
}

const hudByScene = new WeakMap<object, JourneyHud>();
const PHASE_LABEL: Record<string, string> = {
  karma: "盟約",
  encounter: "出来事",
  battle: "討伐",
  report: "報告",
};

function ensureJourneyHud(scene: KarmaScene): JourneyHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics();
  const yearText = scene.add
    .text(22, 22, "", {
      fontSize: "12px",
      fontStyle: "900",
      color: "#f4dd9d",
      letterSpacing: 1,
    })
    .setOrigin(0, 0.5);
  const phaseText = scene.add
    .text(225, 22, "", {
      fontSize: "13px",
      fontStyle: "900",
      color: "#f3ead5",
    })
    .setOrigin(0.5);
  const evalText = scene.add
    .text(428, 22, "", {
      fontSize: "12px",
      fontStyle: "900",
      color: "#f4dd9d",
    })
    .setOrigin(1, 0.5);
  const factionText = scene.add
    .text(22, 49, "", {
      fontSize: "11px",
      fontStyle: "700",
      color: "#bad0c0",
    })
    .setOrigin(0, 0.5);
  const mandateText = scene.add
    .text(428, 49, "", {
      fontSize: "11px",
      fontStyle: "700",
      color: "#d9cfba",
      align: "right",
    })
    .setOrigin(1, 0.5)
    .setMaxLines(1);

  const root = scene.add
    .container(0, 0, [frame, yearText, phaseText, evalText, factionText, mandateText])
    .setDepth(1700)
    .setVisible(false);
  const hud = { root, frame, yearText, phaseText, evalText, factionText, mandateText };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshJourneyHud(scene: KarmaScene): void {
  const hud = ensureJourneyHud(scene);
  const phase = scene.phase ?? "title";
  const active = phase !== "title" && phase !== "final" && phase !== "transition";
  hud.root.setVisible(active);
  if (!active) return;

  const stage = Phaser.Math.Clamp(scene.stage ?? 1, 1, 12);
  const evaluation = scene.runEvaluation ?? 0;
  const karma = scene.karma;
  const dominant = karma ? dominantFaction(karma) : null;
  const factionLabel = dominant ? FACTION_LABEL[dominant] : "未定";
  const mandate = scene.mandate?.label ?? "神託を待つ";
  const shortMandate = mandate.length > 24 ? `${mandate.slice(0, 24)}…` : mandate;

  hud.frame.clear();
  hud.frame.fillStyle(0x0b1612, 0.94);
  hud.frame.fillRoundedRect(10, 8, 430, 56, 14);
  hud.frame.lineStyle(1.5, 0xd9b45a, 0.55);
  hud.frame.strokeRoundedRect(10, 8, 430, 56, 14);
  hud.frame.lineStyle(1, 0x8ba394, 0.28);
  hud.frame.lineBetween(20, 35, 430, 35);

  hud.yearText.setText(`YEAR ${stage}/12`);
  hud.phaseText.setText(`CURRENT  ${PHASE_LABEL[phase] ?? "旅"}`);
  hud.evalText.setText(`評価 ${evaluation >= 0 ? "+" : ""}${evaluation}`);
  hud.factionText.setText(`傾向  ${factionLabel}`);
  hud.mandateText.setText(`神託  ${shortMandate}`);
}

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

  const originalUpdate = proto.update;
  if (!proto.__hudPassUpdate) {
    proto.__hudPassUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      refreshJourneyHud(this as KarmaScene);
      return result;
    };
  }
}
