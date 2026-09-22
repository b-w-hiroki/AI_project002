import { describe, expect, it } from "vitest";
import { plannedMove, type Opponent } from "../src/logic/opponent";
import { applyBeat, initialBattleState, type MoveType } from "../src/logic/battle";

describe("読み合い", () => {
  it("猛攻の手が周期で予告できる", () =>
    expect([0, 1, 2, 3].map((i) => plannedMove("rush", i, null))).toEqual([
      "punch",
      "punch",
      "ki",
      "punch",
    ]));

  it("反撃は前の入力だけを使う", () => {
    expect(plannedMove("counter", 0, null)).toBe("kick");
    expect(plannedMove("counter", 1, "punch")).toBe("kick");
    expect(plannedMove("counter", 2, "kick")).toBe("ki");
  });

  it("読み勝ちで奥義を早く使える", () => {
    const s = initialBattleState();
    expect(
      applyBeat(s, "kick", "punch", () => 0.5).state.playerGauge,
    ).toBeGreaterThan(applyBeat(s, "ki", "punch", () => 0.5).state.playerGauge);
  });

  it("3タイプとも予告を読んだ最適手で6ビート戦うとHP優位を作れる", () => {
    const counter: Record<MoveType, MoveType> = {
      punch: "kick",
      kick: "ki",
      ki: "punch",
    };
    for (const opponent of ["rush", "counter", "charge"] as Opponent[]) {
      let state = initialBattleState();
      let previous: MoveType | null = null;
      for (let beat = 0; beat < 6; beat++) {
        const enemy = plannedMove(opponent, beat, previous);
        const player = counter[enemy];
        state = applyBeat(state, player, enemy, () => 0.5).state;
        previous = player;
      }
      expect(state.playerHp).toBeGreaterThan(state.enemyHp);
    }
  });
});
