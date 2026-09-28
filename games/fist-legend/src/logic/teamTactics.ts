import { type MoveType } from "./battle";
import { fighterById, normalizeTeam, type FighterId } from "./team";

const COUNTER_MOVE: Readonly<Record<MoveType, MoveType>> = {
  punch: "kick",
  kick: "ki",
  ki: "punch",
};

export interface TeamTacticalRead {
  enemyMove: MoveType;
  counterMove: MoveType;
  specialist: FighterId | null;
}

/** 三すくみ自体は変えず、敵の予兆に対して編成内で誰の得意技が噛み合うかだけを読む。 */
export function teamTacticalRead(
  team: readonly FighterId[],
  enemyMove: MoveType,
): TeamTacticalRead {
  const counterMove = COUNTER_MOVE[enemyMove];
  const specialist =
    normalizeTeam(team).find(id => fighterById(id).specialty === counterMove) ?? null;
  return { enemyMove, counterMove, specialist };
}
