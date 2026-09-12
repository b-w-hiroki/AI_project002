import Phaser from "phaser";
import {
  FACTIONS,
  FACTION_LABEL,
  deriveStats,
  dominantFaction,
  type Faction,
  type KarmaRequest,
  type KarmaState,
} from "./logic/karma";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type KarmaScene = Phaser.Scene & {
  phase?: "title" | "karma" | "encounter" | "battle" | "report" | "final" | "transition";
  stage?: number;
  runEvaluation?: number;
  karma?: KarmaState;
  mandate?: { label?: string; bonus?: number; threat?: number };
  currentRequest?: KarmaRequest | null;
};

interface JourneyScreen {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  yearText: Phaser.GameObjects.Text;
  evalText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  mandateText: Phaser.GameObjects.Text;
  requestTitle: Phaser.GameObjects.Text;
  requestText: Phaser.GameObjects.Text;
  dominantText: Phaser.GameObjects.Text;
  statsText: Phaser.GameObjects.Text;
  factionLabels: Phaser.GameObjects.Text[];
  acceptImpact: Phaser.GameObjects.Text;
  declineImpact: Phaser.GameObjects.Text;
  hero?: Phaser.GameObjects.Image;
}

const screenByScene = new WeakMap<object, JourneyScreen>();
const FACTION_COLORS: Readonly<Record<Faction, number>> = {
  warrior: 0xb34d3f,
  merchant: 0xc49538,
  outlaw: 0x6f5c91,
  mage: 0x3f79a8,
};
const FACTION_SHORT: Readonly<Record<Faction, string>> = {
  warrior: "戦士",
  merchant: "商人",
  outlaw: "荒くれ",
  mage: "魔術師",
};

function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight = "700",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      align: "center",
    })
    .setOrigin(0.5);
}

function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border: number,
  alpha = 0.97,
  radius = 16,
): void {
  graphics.fillStyle(0x08120e, 0.24).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, radius);
  graphics.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  graphics.fillStyle(0xffffff, 0.13).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.12), radius * 0.7);
  graphics.lineStyle(1.3, border, 0.7).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
}

function ensureJourneyScreen(scene: KarmaScene): JourneyScreen {
  const cached = screenByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics();
  const yearText = uiText(scene, 22, 21, "", 11, "#f5dd9d", "900").setOrigin(0, 0.5);
  const titleText = uiText(scene, 225, 21, "勇者の旅", 13, "#f3ead5", "900");
  const evalText = uiText(scene, 428, 21, "", 11, "#f5dd9d", "900").setOrigin(1, 0.5);
  const mandateText = scene.add
    .text(225, 53, "", {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: "10px",
      fontStyle: "700",
      color: "#cedacb",
      align: "center",
      wordWrap: { width: 350, useAdvancedWrap: true },
    })
    .setOrigin(0.5);
  const requestTitle = uiText(scene, 322, 167, "", 15, "#5d4727", "900");
  const requestText = scene.add
    .text(322, 218, "", {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: "13px",
      fontStyle: "700",
      color: "#3f493f",
      align: "center",
      lineSpacing: 5,
      wordWrap: { width: 172, useAdvancedWrap: true },
    })
    .setOrigin(0.5);
  const dominantText = uiText(scene, 114, 433, "", 11, "#f5e3ad", "900");
  const statsText = scene.add
    .text(114, 455, "", {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: "10px",
      fontStyle: "800",
      color: "#dce7df",
      align: "center",
      lineSpacing: 3,
    })
    .setOrigin(0.5);
  const factionLabels = FACTIONS.map((_, i) =>
    uiText(scene, 276, 318 + i * 30, "", 9, "#526257", "800").setOrigin(0, 0.5),
  );
  const acceptImpact = uiText(scene, 225, 468, "", 9, "#b9d6c3", "800");
  const declineImpact = uiText(scene, 225, 538, "", 9, "#d4c8df", "800");

  const children: Phaser.GameObjects.GameObject[] = [
    frame,
    yearText,
    titleText,
    evalText,
    mandateText,
    requestTitle,
    requestText,
    dominantText,
    statsText,
    ...factionLabels,
    acceptImpact,
    declineImpact,
  ];

  let hero: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("kq-hero-warrior")) {
    hero = scene.add.image(114, 300, "kq-hero-warrior").setDisplaySize(205, 274);
    children.push(hero);
  }

  const root = scene.add.container(0, 0, children).setDepth(1650).setVisible(false);
  const screen = {
    root,
    frame,
    yearText,
    evalText,
    titleText,
    mandateText,
    requestTitle,
    requestText,
    dominantText,
    statsText,
    factionLabels,
    acceptImpact,
    declineImpact,
    hero,
  };
  screenByScene.set(scene, screen);
  return screen;
}

function refreshJourneyScreen(scene: KarmaScene): void {
  const ui = ensureJourneyScreen(scene);
  const phase = scene.phase ?? "title";
  const active = phase === "karma";
  ui.root.setVisible(active);
  if (!active || !scene.karma) return;

  const karma = scene.karma;
  const stats = deriveStats(karma);
  const dominant = dominantFaction(karma);
  const request = scene.currentRequest;
  const stage = Phaser.Math.Clamp(scene.stage ?? 1, 1, 12);
  const evaluation = scene.runEvaluation ?? 0;
  const mandate = scene.mandate?.label ?? "神託を待つ";
  const maxKarma = Math.max(10, ...FACTIONS.map((faction) => karma[faction]));

  ui.frame.clear();
  // Top status parchment / dark-green game HUD.
  ui.frame.fillStyle(0x0b1712, 0.97).fillRoundedRect(8, 7, 434, 70, 14);
  ui.frame.lineStyle(1.4, 0xd2ad57, 0.62).strokeRoundedRect(8, 7, 434, 70, 14);
  ui.frame.lineStyle(1, 0x879b8e, 0.22).lineBetween(18, 36, 432, 36);

  // Left: hero/world stage. A brighter window makes the protagonist the visual anchor.
  drawPanel(ui.frame, 114, 300, 210, 354, 0x264b38, 0xc8a85f, 0.9, 20);
  ui.frame.fillStyle(0x85b68e, 0.16).fillCircle(114, 268, 106);
  ui.frame.fillStyle(0xf2d18b, 0.12).fillCircle(74, 218, 62);
  ui.frame.fillStyle(0x182a22, 0.82).fillRoundedRect(30, 420, 168, 76, 13);

  // Right: request + faction influence book page.
  drawPanel(ui.frame, 326, 300, 216, 354, 0xf2ead2, 0xc09c54, 0.985, 18);
  ui.frame.lineStyle(1, 0xb2945a, 0.32).lineBetween(236, 286, 416, 286);
  ui.frame.fillStyle(0xe0d4b5, 1).fillRoundedRect(301, 304, 105, 4, 2);

  FACTIONS.forEach((faction, i) => {
    const y = 318 + i * 30;
    const ratio = Phaser.Math.Clamp(karma[faction] / maxKarma, 0, 1);
    const activeFaction = request?.faction === faction;
    ui.frame.fillStyle(0xcfc6ae, 0.9).fillRoundedRect(326, y - 4, 78, 8, 4);
    ui.frame.fillStyle(FACTION_COLORS[faction], activeFaction ? 1 : 0.78).fillRoundedRect(326, y - 4, 78 * ratio, 8, 4);
    if (activeFaction) {
      ui.frame.lineStyle(1.6, FACTION_COLORS[faction], 0.9).strokeRoundedRect(245, y - 13, 166, 26, 8);
    }
    ui.factionLabels[i]?.setText(`${FACTION_SHORT[faction]}  ${karma[faction]}`);
  });

  // Choice-impact connectors point toward the existing interactive buttons below this overlay.
  ui.frame.lineStyle(1.4, 0x73a784, 0.52).lineBetween(322, 447, 322, 468);
  ui.frame.lineStyle(1.4, 0x8e7aa0, 0.45).lineBetween(322, 447, 322, 538);

  ui.yearText.setText(`YEAR ${stage}/12`);
  ui.evalText.setText(`評価 ${evaluation >= 0 ? "+" : ""}${evaluation}`);
  ui.titleText.setText("HERO JOURNEY");
  ui.mandateText.setText(`神託  ${mandate.length > 36 ? `${mandate.slice(0, 36)}…` : mandate}`);
  ui.requestTitle.setText(request ? `【${FACTION_LABEL[request.faction]}】` : "旅人からの依頼");
  ui.requestText.setText(request?.text ?? "次の依頼を待っています");
  ui.dominantText.setText(`現在の傾向  ${FACTION_LABEL[dominant]}`);
  ui.statsText.setText(`ATK ${stats.atk}   DEF ${stats.def}\nHP ${stats.hp}   MAGIC ${stats.magic}`);
  ui.acceptImpact.setText(
    request ? `力を貸す → ${FACTION_SHORT[request.faction]} +${request.karmaDelta}  /  勇者が成長` : "",
  );
  ui.declineImpact.setText(request ? "断る → 他派閥 +1  /  別の伝説へ" : "");

  if (ui.hero) {
    const tint = FACTION_COLORS[dominant];
    ui.hero.setTint(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(0xffffff),
      Phaser.Display.Color.IntegerToColor(tint),
      100,
      12,
    ).color);
  }
}

function showChapterCard(scene: KarmaScene): void {
  const stage = scene.stage ?? 1;
  const mandate = scene.mandate?.label ?? "新たな旅が始まる";
  const veil = scene.add.graphics().setDepth(2000).setAlpha(0);
  veil.fillStyle(0x0b1612, 0.78).fillRect(0, 0, 450, 800);
  const crest = scene.add.graphics().setDepth(2001).setAlpha(0);
  crest.lineStyle(2, 0xd9b45a, 0.8).strokeCircle(225, 286, 42);
  crest.lineBetween(190, 286, 260, 286).lineBetween(225, 251, 225, 321);
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
  scene.tweens.add({ targets: [crest, year, subtitle, kicker], alpha: 1, duration: 180, delay: 80 });
  scene.tweens.add({ targets: year, scale: 1, duration: 240, delay: 80, ease: "Back.Out" });
  scene.time.delayedCall(760, () => {
    scene.tweens.add({ targets: [veil, crest, year, subtitle, kicker], alpha: 0, duration: 260, onComplete: () => {
      veil.destroy(); crest.destroy(); year.destroy(); subtitle.destroy(); kicker.destroy();
    } });
  });
}

function showChoiceDelta(scene: KarmaScene, before: KarmaState, after: KarmaState, accepted: boolean): void {
  const beforeStats = deriveStats(before);
  const afterStats = deriveStats(after);
  const factionDelta = FACTIONS
    .filter((faction) => after[faction] !== before[faction])
    .map((faction) => `${FACTION_SHORT[faction]} +${after[faction] - before[faction]}`)
    .join("  ");
  const statDelta = [
    ["ATK", afterStats.atk - beforeStats.atk],
    ["DEF", afterStats.def - beforeStats.def],
    ["HP", afterStats.hp - beforeStats.hp],
    ["MAG", afterStats.magic - beforeStats.magic],
  ]
    .filter(([, delta]) => (delta as number) > 0)
    .map(([label, delta]) => `${label}+${delta}`)
    .join("  ");
  const label = scene.add
    .text(225, 615, `${accepted ? "選択が世界を動かした" : "別の道を選んだ"}\n${factionDelta}${statDelta ? `  ·  ${statDelta}` : ""}`, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: "13px",
      fontStyle: "800",
      color: accepted ? "#f5dda0" : "#d9cae8",
      stroke: "#14201c",
      strokeThickness: 5,
      align: "center",
      lineSpacing: 4,
    })
    .setOrigin(0.5)
    .setDepth(1950)
    .setAlpha(0)
    .setY(630);
  scene.tweens.add({ targets: label, alpha: 1, y: 600, duration: 180, ease: "Sine.easeOut", yoyo: true, hold: 420, onComplete: () => label.destroy() });
}

export function installKarmaQuestPresentation(): void {
  const proto = GameScene.prototype as unknown as MethodTable;

  const originalShowKarma = proto.showKarmaPhase;
  if (originalShowKarma && !proto.__conceptChoiceShowKarma) {
    proto.__conceptChoiceShowKarma = originalShowKarma;
    proto.showKarmaPhase = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalShowKarma.apply(this, args);
      showChapterCard(this as KarmaScene);
      refreshJourneyScreen(this as KarmaScene);
      return result;
    };
  }

  const originalChoice = proto.onKarmaChoice;
  if (originalChoice && !proto.__conceptChoiceKarma) {
    proto.__conceptChoiceKarma = originalChoice;
    proto.onKarmaChoice = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const runtime = this as KarmaScene;
      const before = runtime.karma ? { ...runtime.karma } : null;
      const accepted = args[0] === true;
      const result = originalChoice.apply(this, args);
      if (before && runtime.karma) showChoiceDelta(runtime, before, runtime.karma, accepted);
      return result;
    };
  }

  const originalUpdate = proto.update;
  if (!proto.__conceptChoiceUpdate) {
    proto.__conceptChoiceUpdate = originalUpdate ?? (() => undefined);
    proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalUpdate?.apply(this, args);
      refreshJourneyScreen(this as KarmaScene);
      return result;
    };
  }
}
