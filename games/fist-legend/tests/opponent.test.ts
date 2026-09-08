import { describe, it, expect } from "vitest";
import { plannedMove } from "../src/logic/opponent";
import { applyBeat, initialBattleState } from "../src/logic/battle";
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
});
