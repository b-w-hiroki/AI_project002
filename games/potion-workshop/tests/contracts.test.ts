import { describe, it, expect } from "vitest";
import {
  newGame,
  productionPerSec,
  tick,
  applyOfflineProgress,
} from "../src/logic/economy";
import { parseSaveJson } from "../src/logic/save";
import { contractReward, fulfillContract } from "../src/logic/contracts";
describe("需要と納品", () => {
  it("旧セーブを評判0で補完する", () => {
    const s = parseSaveJson(
      JSON.stringify({ state: { potions: 100 }, savedAt: 0 }),
    );
    expect(s?.state.reputation).toBe(0);
    expect(s?.state.completedContracts).toEqual([]);
  });
  it("資金不足・二重納品を拒否し、資金を消費する", () => {
    expect(fulfillContract(newGame(), 0)).toBeNull();
    const s = fulfillContract({ ...newGame(), potions: 1000 }, 0)!;
    expect(s.potions).toBe(880);
    expect(s.reputation).toBe(1);
    expect(fulfillContract(s, 0)).toBeNull();
  });
  it("街需要・評判がオンラインとオフラインへ同じ倍率で反映", () => {
    const s = {
      ...newGame(),
      prestigeCount: 1,
      townIndex: 1,
      reputation: 2,
      counts: { garden: 1 },
    };
    expect(productionPerSec(s)).toBe(45);
    expect(tick(s, 10).potions).toBe(applyOfflineProgress(s, 10).state.potions);
  });
  it("街ごとに注文の評判報酬が変わる", () => {
    const normal = { ...newGame(), potions: 10_000, townIndex: 0 };
    const premium = { ...newGame(), potions: 10_000, townIndex: 4, prestigeCount: 1 };
    expect(contractReward(normal, 1)).toBe(3);
    expect(contractReward(premium, 1)).toBe(5);
    expect(fulfillContract(premium, 1)!.reputation).toBe(5);
  });
});
