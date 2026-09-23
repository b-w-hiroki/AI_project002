import { describe, expect, it } from "vitest";
import { autoBattle, battleWinProbability, cheerBonus, heroPower, monsterPowerForStage } from "../src/logic/battle";
import { deriveStats } from "../src/logic/karma";

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

  it("おうえん回数が多いほど勝率が上がる（ギリギリの戦況で有意に効く）", () => {
    const stats = { atk: 12, def: 8, hp: 40, magic: 2 };
    const withoutCheer = autoBattle(stats, 3, sequentialRng([0.55, 0.5]), 0);
    const withCheer = autoBattle(stats, 3, sequentialRng([0.55, 0.5]), 10);
    expect(withoutCheer.win).toBe(false);
    expect(withCheer.win).toBe(true);
  });
});

describe("autoBattle encounterBonus", () => {
  it("正のencounterBonusは勝率を押し上げる", () => {
    const stats = { atk: 12, def: 8, hp: 40, magic: 2 };
    const withoutBonus = autoBattle(stats, 3, sequentialRng([0.55, 0.5]), 0, 0);
    const withBonus = autoBattle(stats, 3, sequentialRng([0.55, 0.5]), 0, 0.15);
    expect(withoutBonus.win).toBe(false);
    expect(withBonus.win).toBe(true);
  });

  it("負のencounterBonusは勝率を押し下げる", () => {
    const stats = { atk: 12, def: 8, hp: 40, magic: 2 };
    const withoutBonus = autoBattle(stats, 3, sequentialRng([0.45, 0.5]), 0, 0);
    const withPenalty = autoBattle(stats, 3, sequentialRng([0.45, 0.5]), 0, -0.15);
    expect(withoutBonus.win).toBe(true);
    expect(withPenalty.win).toBe(false);
  });
});

describe("cheerBonus", () => {
  it("0回なら上乗せ0", () => {
    expect(cheerBonus(0)).toBe(0);
  });

  it("回数が増えるほど上乗せも増える", () => {
    expect(cheerBonus(5)).toBeGreaterThan(cheerBonus(1));
  });

  it("上限でクランプされる", () => {
    expect(cheerBonus(1000)).toBe(cheerBonus(20));
  });

  it("負の回数は0として扱う", () => {
    expect(cheerBonus(-5)).toBe(0);
  });
});


describe("12-year balance curve", () => {
  it("初年度は素の勇者でも勝率65%前後を確保する", () => {
    const p = battleWinProbability(deriveStats({ warrior: 0, merchant: 0, outlaw: 0, mage: 0 }), 1);
    expect(p).toBeGreaterThanOrEqual(0.6);
    expect(p).toBeLessThanOrEqual(0.75);
  });

  it("中盤の均等育成+応援は80%前後で安定する", () => {
    const stats = deriveStats({ warrior: 6, merchant: 6, outlaw: 6, mage: 6 });
    const p = battleWinProbability(stats, 6, 10);
    expect(p).toBeGreaterThanOrEqual(0.75);
    expect(p).toBeLessThanOrEqual(0.85);
  });

  it("12年目はどの派閥特化でも応援込み70%以上を維持する", () => {
    const builds = [
      { warrior: 48, merchant: 0, outlaw: 0, mage: 0 },
      { warrior: 0, merchant: 48, outlaw: 0, mage: 0 },
      { warrior: 0, merchant: 0, outlaw: 48, mage: 0 },
      { warrior: 0, merchant: 0, outlaw: 0, mage: 48 },
    ] as const;
    const probabilities = builds.map(karma =>
      battleWinProbability(deriveStats(karma), 12, 10),
    );
    expect(Math.min(...probabilities)).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(...probabilities) - Math.min(...probabilities)).toBeLessThanOrEqual(0.15);
  });

  it("9年目以降は追加成長し、終盤だけ難度が一段上がる", () => {
    const before = monsterPowerForStage(8) - monsterPowerForStage(7);
    const after = monsterPowerForStage(9) - monsterPowerForStage(8);
    expect(after).toBeGreaterThan(before);
  });
});
