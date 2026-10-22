import Phaser from "phaser";
import type { BattleOutcome } from "../logic/battle";
import { plannedMove, type Opponent } from "../logic/opponent";
import type { FighterId } from "../logic/team";
import { teamTacticalRead } from "../logic/teamTactics";
import { detectLang, fighterName, moveLabel, tr } from "../logic/i18n";
import { text, button } from "./controls";
import { fitFighter } from "./art";
export type ResultView = {
  resultGroup: Phaser.GameObjects.Container;
  resultBackdrop?: Phaser.GameObjects.Image;
  resultHero?: Phaser.GameObjects.Image;
  resultEnemy?: Phaser.GameObjects.Image;
  resultFinish: Phaser.GameObjects.Text;
  resultHeading: Phaser.GameObjects.Text;
  resultStats: Phaser.GameObjects.Text;
  resultReward: Phaser.GameObjects.Container;
  resultRewardLabel: Phaser.GameObjects.Text;
  resultRewardValue: Phaser.GameObjects.Text;
  resultRewardBalance: Phaser.GameObjects.Text;
  resultRetry: Phaser.GameObjects.Container;
  resultTitle: Phaser.GameObjects.Container;
};
export type ResultModel = {
  lastOutcome?: BattleOutcome | null;
  lastReward?: number;
  lastBalance?: number;
  storyActive?: boolean;
  seriesActive?: boolean;
  storyChapterIndex?: number;
  storyProgress?: number;
  seriesWins?: number;
  seriesIndex?: number;
  opponent?: Opponent;
  selectedTeam?: FighterId[];
  currency: number;
};
export type ResultActions = { primary: () => void; title: () => void };
function buildRewardMedallion(scene: Phaser.Scene): {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  balance: Phaser.GameObjects.Text;
} {
  const plate = scene.add.graphics();
  plate.fillStyle(0x120907, 0.76).fillRoundedRect(-150, -34, 300, 68, 16);
  plate.fillStyle(0x7b271d, 0.42).fillRoundedRect(-146, -30, 292, 18, 12);
  plate.lineStyle(2, 0xd8a84f, 0.92).strokeRoundedRect(-150, -34, 300, 68, 16);
  plate.lineStyle(1, 0xffe2a0, 0.34).strokeRoundedRect(-144, -28, 288, 56, 12);
  plate.lineStyle(2, 0xd8a84f, 0.72).lineBetween(-86, -21, 122, -21);

  const gem = scene.add.graphics({ x: -112, y: 0 }).setName("mobile-result-reward-icon");
  gem.fillStyle(0x180d0a, 0.72).fillCircle(0, 3, 26);
  gem.lineStyle(2, 0xf4cf73, 0.92).strokeCircle(0, 0, 24);
  gem.fillStyle(0xc74835, 1).fillTriangle(0, -17, -16, -3, 0, 18);
  gem.fillStyle(0x8f251f, 1).fillTriangle(0, -17, 16, -3, 0, 18);
  gem.fillStyle(0xf17b52, 0.95).fillTriangle(0, -17, -7, -3, 0, 3);
  gem.lineStyle(1.5, 0xffd88b, 0.84);
  gem.strokeTriangle(0, -17, -16, -3, 0, 18);
  gem.strokeTriangle(0, -17, 16, -3, 0, 18);

  const label = text(scene, -66, -10, "", 12, "#e7c985").setOrigin(0, 0.5);
  const value = text(scene, -66, 10, "", 24, "#fff0bd").setOrigin(0, 0.5).setStroke("#3a1710", 3);
  const balance = text(scene, 132, 11, "", 11, "#d6bea0").setOrigin(1, 0.5);
  const container = scene.add
    .container(225, 345, [plate, gem, label, value, balance])
    .setSize(300, 68)
    .setName("mobile-result-reward");
  return { container, label, value, balance };
}


export function createResultView(scene: Phaser.Scene, actions: ResultActions): ResultView {
  const lang = detectLang();
  const resultGroup = scene.add.container(0, 0);
  const resultBackdrop = scene.textures.exists("fl-bg-arena")
    ? scene.add.image(225, 400, "fl-bg-arena").setAlpha(0.34)
    : undefined;
  const resultHero = scene.textures.exists("fl-hero-fighter")
    ? scene.add.image(118, 430, "fl-hero-fighter").setDisplaySize(150, 200).setAlpha(0.72).setName("mobile-result-hero")
    : undefined;
  const resultEnemy = scene.textures.exists("fl-enemy-fighter")
    ? scene.add.image(332, 430, "fl-enemy-fighter").setDisplaySize(150, 200).setFlipX(true).setAlpha(0.42).setName("mobile-result-enemy")
    : undefined;
  resultGroup.add([
    ...(resultBackdrop ? [resultBackdrop] : []),
    ...(resultHero ? [resultHero] : []),
    ...(resultEnemy ? [resultEnemy] : []),
  ]);

  const resultFinish = text(scene, 225, 195, "", 56, "#ffe3a8")
    .setFontFamily('"Arial Black", "Arial", "Segoe UI", sans-serif')
    .setStroke("#3a1a12", 7)
    .setPadding(14)
    .setName("mobile-result-finish");
  const resultHeading = text(scene, 225, 285, "", 42, "#ffe3a8").setName("mobile-result-heading");
  const reward = buildRewardMedallion(scene);
  const resultStats = text(scene, 225, 402, "", 15, "#e5d0bc").setName("mobile-result-next");
  resultGroup.add([resultFinish, resultHeading, reward.container, resultStats]);
  const resultRetry = button(scene, resultGroup, 225, 430, 330, 58, tr(lang, "もう一度", "Play Again"), 0xa9402d, actions.primary);
  const resultTitle = button(scene, resultGroup, 225, 500, 330, 48, tr(lang, "タイトルへ", "Title"), 0x334c70, actions.title);

  resultRetry.setName("mobile-result-primary");


  return {
    resultGroup,
    resultBackdrop,
    resultHero,
    resultEnemy,
    resultFinish,
    resultHeading,
    resultStats,
    resultReward: reward.container,
    resultRewardLabel: reward.label,
    resultRewardValue: reward.value,
    resultRewardBalance: reward.balance,
    resultRetry,
    resultTitle,
  };
}
export function renderResultView(ui: ResultView, model: ResultModel, viewport: { portrait: boolean; width: number; height: number }, chrome: Phaser.GameObjects.Graphics): void {
  const lang = detectLang();
  const { portrait, width, height } = viewport;
  const extra = portrait ? height - 800 : 0;
  chrome.fillStyle(0x120907, 0.58).fillRect(0, 0, width, height);
  if (ui.resultBackdrop) {
    const backdrop = ui.resultBackdrop;
    backdrop.setPosition(width / 2, height / 2)
      .setScale(Math.max(width / backdrop.width, height / backdrop.height)).setAlpha(0.34);
  }
  if (portrait) {
    const fighterHeight = Phaser.Math.Clamp(120 + extra * 0.12, 120, 150);
    const fighterY = 510 + extra * 0.12;
    if (ui.resultHero) {
      ui.resultHero.setPosition(120, fighterY);
      fitFighter(ui.resultHero, fighterHeight);
    }
    if (ui.resultEnemy) {
      ui.resultEnemy.setPosition(330, fighterY);
      fitFighter(ui.resultEnemy, fighterHeight);
    }
  } else {
    if (ui.resultHero) {
      ui.resultHero.setPosition(160, 255);
      fitFighter(ui.resultHero, 214);
    }
    if (ui.resultEnemy) {
      ui.resultEnemy.setPosition(640, 255);
      fitFighter(ui.resultEnemy, 214);
    }
  }
  const outcome = model.lastOutcome;
  if (ui.resultHero) {
    ui.resultHero.clearTint().setAlpha(outcome === "playerWin" ? 0.92 : 0.28);
    if (outcome === "enemyWin") ui.resultHero.setTint(0x777777);
  }
  if (ui.resultEnemy) {
    ui.resultEnemy.clearTint().setAlpha(outcome === "enemyWin" ? 0.88 : 0.24);
    if (outcome === "playerWin") ui.resultEnemy.setTint(0x777777);
  }
  ui.resultFinish
    .setPosition(width / 2, portrait ? 195 : 92)
    .setText(outcome === "playerWin" ? "K.O." : outcome === "enemyWin" ? "DOWN" : "DRAW")
    .setColor(outcome === "playerWin" ? "#ffe3a8" : outcome === "enemyWin" ? "#cad6eb" : "#e4d6ff")
    .setScale(portrait ? 1 : 0.72);
  ui.resultHeading.setPosition(width / 2, portrait ? 285 : 150).setText(outcome === "playerWin" ? tr(lang, "勝利", "Victory") : outcome === "enemyWin" ? tr(lang, "敗北", "Defeat") : tr(lang, "引き分け", "Draw"));
  ui.resultReward.setPosition(width / 2, portrait ? 355 + extra * 0.16 : 212).setScale(portrait ? 1 : 0.82);
  ui.resultRewardLabel.setText(tr(lang, "獲得報酬", "REWARD"));
  ui.resultRewardValue.setText(`${tr(lang, "豪拳石", "Fist Gems")} +${model.lastReward ?? 0}`);
  ui.resultRewardBalance.setText(`${tr(lang, "所持", "Held")} ${model.lastBalance ?? model.currency}`);
  const modeText = model.storyActive
    ? `${tr(lang, "物語", "Story")} ${Math.min(3, (model.storyChapterIndex ?? 0) + 1)}/3 · ${tr(lang, "進行", "Progress")} ${model.storyProgress ?? 0}/3`
    : model.seriesActive
      ? `${tr(lang, "3連戦", "Gauntlet")} ${model.seriesWins ?? 0}/3 ${tr(lang, "勝", "wins")} · ${Math.min(3, (model.seriesIndex ?? 0) + 1)}/3`
      : "";
  const firstMove = plannedMove(model.opponent ?? "rush", 0, null);
  const retryRead = teamTacticalRead(model.selectedTeam ?? ["ryuga"], firstMove);
  const tacticalNext = retryRead.specialist
    ? `${tr(lang, "再挑戦", "Retry")}: ${fighterName(lang, retryRead.specialist)} → ${moveLabel(lang, retryRead.counterMove)} (+18%)`
    : `${tr(lang, "編成変更", "Team Change")}: ${moveLabel(lang, retryRead.counterMove)} ${tr(lang, "得意の拳士を追加", "specialist needed") }`;
  const nextLine = outcome === "playerWin"
    ? modeText || tr(lang, "同じ相手へ再挑戦", "Retry the same rival")
    : `${modeText ? `${modeText}\n` : ""}${tacticalNext}`;
  ui.resultStats
    .setPosition(width / 2, portrait ? 338 : 202)
    .setText(`${tr(lang, "豪拳石", "Fist Gems")} ${model.currency}\n${nextLine}`);
  ui.resultStats.setPosition(width / 2, portrait ? 414 + extra * 0.20 : 253).setText(nextLine);
  const retryLabel = ui.resultRetry.list.find(node => node.type === "Text") as Phaser.GameObjects.Text | undefined;
  if (retryLabel) {
    retryLabel.setText(
      model.storyActive
        ? model.lastOutcome === "playerWin" && (model.storyChapterIndex ?? 0) < 2
          ? `${tr(lang, "次章へ", "Next Chapter")} (${(model.storyChapterIndex ?? 0) + 2}/3)`
          : model.lastOutcome === "playerWin"
            ? tr(lang, "物語を再演", "Replay Story")
            : tr(lang, "この章を再挑戦", "Retry Chapter")
        : model.seriesActive
          ? model.lastOutcome === "playerWin" && (model.seriesIndex ?? 0) < 2
            ? `${tr(lang, "次の相手へ", "Next Rival")} (${(model.seriesIndex ?? 0) + 2}/3)`
            : model.lastOutcome === "playerWin"
              ? tr(lang, "もう一度3連戦", "Replay Gauntlet")
              : tr(lang, "3連戦を再挑戦", "Retry Gauntlet")
          : tr(lang, "もう一度", "Play Again"),
    );
  }
  ui.resultRetry.setPosition(width / 2, portrait ? height - 245 : 292).setScale(portrait ? 1 : 0.86);
  ui.resultTitle.setPosition(width / 2, portrait ? height - 175 : 352).setScale(portrait ? 1 : 0.86);
  if (portrait && ui.resultHero && ui.resultEnemy) {
    const bandTop = ui.resultStats.getBounds().bottom + 8;
    const bandBottom = ui.resultRetry.getBounds().top - 8;
    const available = Math.max(96, bandBottom - bandTop);
    const fighterHeight = Phaser.Math.Clamp(available, 96, 150);
    const breathingRoom = Math.min(24, Math.max(0, (available - fighterHeight) / 2));
    const fighterY = bandTop + fighterHeight / 2 + breathingRoom;
    ui.resultHero.setPosition(120, fighterY);
    fitFighter(ui.resultHero, fighterHeight);
    ui.resultEnemy.setPosition(330, fighterY);
    fitFighter(ui.resultEnemy, fighterHeight);
  }
}
