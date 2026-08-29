import { describe, expect, it } from "vitest";
import { autoBattle, heroPower, monsterPowerForStage } from "../src/logic/battle";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("monsterPowerForStage", () => {
  it("ステージが進むほど魔物が強くなる", () => {
    expect(monsterPowerForStage(5)).toBeGreaterThan(monsterPowerForStage(1));
  });
});

describe("heroPower", () => {
  it("ステータスが高いほど総合力も高い", () => {
    const low = heroPower({ atk: 10, def: 8, hp: 40, magic: 5 });
    const high = heroPower({ atk: 30, def: 20, hp: 80, magic: 20 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("autoBattle", () => {
  it("圧倒的に強ければ低い乱数値でも勝てる", () => {
    const strong = { atk: 200, def: 100, hp: 300, magic: 100 };
    const result = autoBattle(strong, 1, sequentialRng([0.01, 0.5]));
    expect(result.win).toBe(true);
    expect(result.hpRatioRemaining).toBeGreaterThan(0);
  });

  it("圧倒的に弱ければ高い乱数値でも負ける", () => {
    const weak = { atk: 1, def: 1, hp: 1, magic: 1 };
    const result = autoBattle(weak, 20, sequentialRng([0.99, 0.5]));
    expect(result.win).toBe(false);
  });

  it("hpRatioRemainingは0〜1の範囲に収まる", () => {
    const stats = { atk: 15, def: 10, hp: 50, magic: 8 };
    for (let seed = 0; seed < 10; seed++) {
      const result = autoBattle(stats, 3, sequentialRng([seed / 10, 0.5]));
      expect(result.hpRatioRemaining).toBeGreaterThanOrEqual(0);
      expect(result.hpRatioRemaining).toBeLessThanOrEqual(1);
    }
  });

  it("同じrngシードなら再現できる", () => {
    const stats = { atk: 12, def: 9, hp: 45, magic: 6 };
    const a = autoBattle(stats, 4, sequentialRng([0.3, 0.6]));
    const b = autoBattle(stats, 4, sequentialRng([0.3, 0.6]));
    expect(a).toEqual(b);
  });
});
