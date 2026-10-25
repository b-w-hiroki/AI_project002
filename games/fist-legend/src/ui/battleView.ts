import Phaser from "phaser";
import { MAX_HP, OUGI_GAUGE_MAX, type BattleState, type MoveType } from "../logic/battle";
import type { Opponent } from "../logic/opponent";
import { fighterById, type FighterId } from "../logic/team";
import { detectLang, fighterName, moveLabel, moveTell, opponentName as localizedOpponentName, opponentType, tr } from "../logic/i18n";
import { text, button } from "./controls";
import { exchangeGuide } from "../logic/playGuide";
import { teamTacticalRead } from "../logic/teamTactics";

export type BattleView = {
  battleGroup: Phaser.GameObjects.Container;
  battleStatus: Phaser.GameObjects.Text;
  battleTell: Phaser.GameObjects.Text;
  battleGauge: Phaser.GameObjects.Text;
  counterRing: Phaser.GameObjects.Graphics;
};
export type BattleModel = {
  battle: Readonly<Pick<BattleState, "playerHp" | "enemyHp" | "playerGauge">>;
  opponent?: Opponent;
  selectedTeam?: readonly FighterId[];
  activeFighterIndex?: number;
  nextEnemyMove?: MoveType;
  beat?: number;
  timeRemainingSec?: number;
};
export type BattleActions = {
  move: (move: MoveType) => void;
  ougi: () => void;
  switchFighter: () => void;
};
const OPPONENT_ACCENT: Readonly<Record<Opponent, { accent: number; glow: number }>> = {
  rush: { accent: 0xe6533f, glow: 0xffad66 },
  counter: { accent: 0x4ca67a, glow: 0x8ce6bd },
  charge: { accent: 0x576ccf, glow: 0xaebaff },
};


export function createBattleView(scene: Phaser.Scene, actions: BattleActions): BattleView {
  const lang = detectLang();
  const battleGroup = scene.add.container(0, 0);
  const battleStatus = text(scene, 18, 18, "", 13, "#fff1d5").setOrigin(0, 0).setName("mobile-battle-status");
  const battleTell = text(scene, 225, 104, "", 20, "#ffe2a8");
  const battleGauge = text(scene, 225, 151, "", 12, "#fff0a0");
  const counterRing = scene.add.graphics().setName("mobile-counter-ring").setVisible(false);
  battleGroup.add([battleStatus, battleTell, battleGauge, counterRing]);

  const moveButtons: Array<{ move: MoveType; label: string; color: number }> = [
    { move: "punch", label: moveLabel(lang, "punch"), color: 0xb8412f },
    { move: "kick", label: moveLabel(lang, "kick"), color: 0x2f7d58 },
    { move: "ki", label: moveLabel(lang, "ki"), color: 0x315d91 },
  ];
  moveButtons.forEach(({ move, label, color }, index) => {
    const b = button(scene, battleGroup, 92 + index * 133, 684, 112, 66, label, color, () => actions.move(move), false, 72);
    b.setName(`mobile-move-${move}`);
  });
  const ougi = button(scene, battleGroup, 225, 760, 360, 60, tr(lang, "奥義", "SPECIAL"), 0x9b7119, actions.ougi);
  ougi.setName("mobile-ougi");
  const landscapeOugi = button(scene, battleGroup, 735, 402, 110, 52, tr(lang, "奥義", "SPECIAL"), 0x9b7119, actions.ougi);
  landscapeOugi.setName("mobile-ougi-landscape").setVisible(false);
  const switchButton = button(scene, battleGroup, 225, 715, 76, 44, tr(lang, "交代", "SWITCH"), 0x505385, actions.switchFighter);
  switchButton.setName("mobile-switch").setVisible(false);
  const landscapeSwitch = button(scene, battleGroup, 300, 402, 88, 46, tr(lang, "交代", "SWITCH"), 0x505385, actions.switchFighter);
  landscapeSwitch.setName("mobile-switch-landscape").setVisible(false);


  return { battleGroup, battleStatus, battleTell, battleGauge, counterRing };
}

export function renderBattleView(ui: BattleView, model: BattleModel, viewport: { portrait: boolean; width: number; height: number }, chrome: Phaser.GameObjects.Graphics): void {
  const lang = detectLang();
  const { portrait, width, height } = viewport;
  const extra = portrait ? height - 800 : 0;
  const battle = model.battle;
  const opponentVisual = OPPONENT_ACCENT[model.opponent ?? "rush"];
  const opponentName = localizedOpponentName(lang, model.opponent ?? "rush");
  const playerRatio = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
  const enemyRatio = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
  const gaugeRatio = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);

  const hudTop = portrait ? 8 : 44;
  const hpY = portrait ? 54 : 78;
  chrome.fillStyle(0x100806, 0.9).fillRoundedRect(8, hudTop, width - 16, portrait ? 90 : 62, 16);
  chrome.fillStyle(0x37130f, 1).fillRoundedRect(18, hpY, width * 0.38, 12, 6);
  chrome.fillStyle(0xe74d30, 1).fillRoundedRect(18, hpY, width * 0.38 * playerRatio, 12, 6);
  const enemyX = width - 18 - width * 0.38;
  chrome.fillStyle(0x12233c, 1).fillRoundedRect(enemyX, hpY, width * 0.38, 12, 6);
  chrome.fillStyle(opponentVisual.accent, 1).fillRoundedRect(enemyX + width * 0.38 * (1 - enemyRatio), hpY, width * 0.38 * enemyRatio, 12, 6);
  chrome.lineStyle(2, opponentVisual.glow, 0.45).strokeRoundedRect(enemyX - 3, hpY - 4, width * 0.38 + 6, 20, 9);
  chrome.fillStyle(opponentVisual.glow, portrait ? 0.055 : 0.04).fillCircle(portrait ? 225 : 615, portrait ? 270 : 245, portrait ? 116 : 132);
  if (portrait) {
    const controlsTop = Math.max(610, height - 300);
    chrome.fillStyle(0x2a160f, 0.98).fillRect(0, 600, 450, Math.max(0, controlsTop - 600));
    chrome.fillStyle(0x1b0d09, 0.98).fillRect(0, controlsTop, 450, height - controlsTop);
    chrome.lineStyle(1, 0xffd68a, 0.28).lineBetween(0, 600, 450, 600);
    chrome.lineStyle(1, 0xffd68a, 0.36).lineBetween(0, controlsTop, 450, controlsTop);
    chrome.lineStyle(1, 0x7b3f2b, 0.24).lineBetween(20, controlsTop - 22, 430, controlsTop - 22);
    chrome.fillStyle(0x100806, 0.86).fillRoundedRect(55, 365 + extra * 0.18, 340, 58, 14);
    chrome.lineStyle(1, 0xffcf82, 0.45).strokeRoundedRect(55, 365 + extra * 0.18, 340, 58, 14);
    ui.battleTell.setPosition(225, 394 + extra * 0.18);
    ui.battleGauge.setPosition(225, 90);
    const canSwitch = (model.selectedTeam?.length ?? 1) > 1;
    (ui.battleGroup.getByName("mobile-switch") as Phaser.GameObjects.Container | null)
      ?.setPosition(225, controlsTop + 205).setScale(1).setVisible(canSwitch).setAlpha(canSwitch ? 1 : 0.4);
    (ui.battleGroup.getByName("mobile-switch-landscape") as Phaser.GameObjects.Container | null)?.setVisible(false);
    const movePositions = [{ x: 120, y: controlsTop + 70 }, { x: 330, y: controlsTop + 70 }, { x: 120, y: controlsTop + 145 }];
    (["punch", "kick", "ki"] as const).forEach((move, index) => {
      const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
      b?.setPosition(movePositions[index]!.x, movePositions[index]!.y).setScale(1).setVisible(true);
    });
    (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setVisible(false);
    (ui.battleGroup.getByName("mobile-ougi-landscape") as Phaser.GameObjects.Container | null)?.setPosition(330, controlsTop + 145).setScale(1).setVisible(true);
  } else {
    chrome.fillStyle(0x100806, 0.84).fillRoundedRect(270, 101, 260, 58, 14);
    chrome.lineStyle(1, 0xffcf82, 0.45).strokeRoundedRect(270, 101, 260, 58, 14);
    chrome.fillStyle(0x100806, 0.9).fillRoundedRect(18, 372, 330, 60, 14);
    chrome.lineStyle(1, 0xffcf82, 0.4).strokeRoundedRect(18, 372, 330, 60, 14);
    ui.battleTell.setPosition(400, 124);
    ui.battleGauge.setPosition(130, 404);
    const canSwitch = (model.selectedTeam?.length ?? 1) > 1;
    (ui.battleGroup.getByName("mobile-switch") as Phaser.GameObjects.Container | null)?.setVisible(false);
    (ui.battleGroup.getByName("mobile-switch-landscape") as Phaser.GameObjects.Container | null)
      ?.setPosition(300, 402).setScale(0.86).setVisible(canSwitch).setAlpha(canSwitch ? 1 : 0.4);
    const moveXs = [410, 520, 630];
    (["punch", "kick", "ki"] as const).forEach((move, index) => {
      const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
      b?.setPosition(moveXs[index]!, 402).setScale(0.82).setVisible(true);
    });
    (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setVisible(false);
    (ui.battleGroup.getByName("mobile-ougi-landscape") as Phaser.GameObjects.Container | null)?.setPosition(735, 402).setScale(1).setVisible(true);
  }

  const remaining = Math.max(0, Math.ceil(model.timeRemainingSec ?? 0));
  const team = model.selectedTeam?.length ? model.selectedTeam : (["ryuga"] as FighterId[]);
  const activeIndex = Phaser.Math.Clamp(model.activeFighterIndex ?? 0, 0, Math.max(0, team.length - 1));
  const leader = fighterById(team[activeIndex] ?? "ryuga");
  ui.battleStatus
    .setPosition(18, portrait ? 18 : 50)
    .setFontSize(portrait ? 23 : 13)
    .setColor(portrait ? "#fff1d5" : `#${opponentVisual.glow.toString(16).padStart(6, "0")}`)
    .setText(portrait
      ? tr(lang,
        `自分 ${battle.playerHp}/${MAX_HP} · 残${remaining}秒 · 相手 ${battle.enemyHp}/${MAX_HP}`,
        `YOU ${battle.playerHp}/${MAX_HP} · ${remaining}s · CPU ${battle.enemyHp}/${MAX_HP}`)
      : `${fighterName(lang, leader.id)} [${activeIndex + 1}/${team.length}] ${battle.playerHp}/${MAX_HP}   TIME ${remaining}   ${opponentType(lang, model.opponent ?? "rush")} · ${opponentName} ${battle.enemyHp}/${MAX_HP}`);
  ui.battleTell.setText(`${moveTell(lang, model.nextEnemyMove ?? "punch")}\n${exchangeGuide(lang, model.nextEnemyMove ?? "punch", model.beat ?? 0)}`);
  ui.battleGauge.setText(gaugeRatio >= 1
    ? `${tr(lang, "奥義", "SPECIAL")} READY · TEAM ${activeIndex + 1}/${team.length}`
    : `${tr(lang, "奥義", "SPECIAL")} ${Math.round(gaugeRatio * 100)}% · TEAM ${activeIndex + 1}/${team.length} · EXCHANGE ${(model.beat ?? 0) + 1}`);

  const guidedMove = (model.beat ?? 0) < 3
    ? teamTacticalRead(team, model.nextEnemyMove ?? "punch").counterMove : null;
  const guidedButton = guidedMove
    ? ui.battleGroup.getByName(`mobile-move-${guidedMove}`) as Phaser.GameObjects.Container | null : null;
  ui.counterRing.clear().setVisible(Boolean(guidedButton));
  if (guidedButton) {
    const ringWidth = portrait ? 132 : 104;
    const ringHeight = portrait ? 84 : 72;
    ui.counterRing.setPosition(guidedButton.x, guidedButton.y)
      .lineStyle(4, 0xffdd8a, 0.95)
      .strokeRoundedRect(-ringWidth / 2, -ringHeight / 2, ringWidth, ringHeight, 9);
  }

}
