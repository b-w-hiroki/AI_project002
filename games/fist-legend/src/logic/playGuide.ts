import type { BattleState, MoveType } from "./battle";
import { moveLabel, tr, type Lang } from "./i18n";
import { teamTacticalRead } from "./teamTactics";

export function exchangeGuide(lang: Lang, enemyMove: MoveType, beat: number): string {
  if (beat < 3) {
    const counter = moveLabel(lang, teamTacticalRead(["ryuga"], enemyMove).counterMove);
    return tr(lang, `${counter}で有利を取ろう`, `Counter with ${counter}`);
  }
  return tr(lang, "有利: 拳>気>蹴>拳", "Beats: Punch>Ki>Kick>Punch");
}

export function finishReason(lang: Lang, battle: Pick<BattleState, "playerHp" | "enemyHp">): string {
  if (battle.playerHp <= 0 && battle.enemyHp <= 0) return tr(lang, "両者のHPが0に", "Both fighters reached 0 HP");
  if (battle.enemyHp <= 0) return tr(lang, "相手のHPを0にした", "Rival defeated at 0 HP");
  if (battle.playerHp <= 0) return tr(lang, "自分のHPが0になった", "Your fighter reached 0 HP");
  return tr(lang, `時間切れ · 残りHP ${battle.playerHp} 対 ${battle.enemyHp}`, `Time up · HP ${battle.playerHp} vs ${battle.enemyHp}`);
}
