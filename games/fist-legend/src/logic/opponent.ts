import { type MoveType } from "./battle";
export type Opponent = "rush" | "counter" | "charge";
export const OPPONENTS: readonly {
  id: Opponent;
  name: string;
  hint: string;
}[] = [
  { id: "rush", name: "猛攻の岳", hint: "拳 → 拳 → 気。連係の最後を読もう" },
  {
    id: "counter",
    name: "反撃の蓮花",
    hint: "直前のあなたの手に対抗する。初手は蹴",
  },
  {
    id: "charge",
    name: "気功の冥",
    hint: "蹴 → 気 → 気。溜めた気を拳で崩そう",
  },
];
export const MOVE_TELL: Record<MoveType, string> = {
  punch: "拳を引いている",
  kick: "脚へ重心を移した",
  ki: "掌に気が集まる",
};
export function plannedMove(
  opponent: Opponent,
  beat: number,
  previous: MoveType | null,
): MoveType {
  if (opponent === "counter")
    return previous === null
      ? "kick"
      : ({ punch: "kick", kick: "ki", ki: "punch" } as const)[previous];
  const pattern: MoveType[] =
    opponent === "rush" ? ["punch", "punch", "ki"] : ["kick", "ki", "ki"];
  return pattern[beat % pattern.length]!;
}
