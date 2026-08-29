import { describe, expect, it } from "vitest";
import { enemyPowerForDistance, resolveQuestTap, rollEventType, troopPower } from "../src/logic/quest";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("rollEventType", () => {
  it("低い乱数値は遭遇、中間は宝箱、高い乱数値は戦闘になる", () => {
    expect(rollEventType(sequentialRng([0.1]))).toBe("encounter");
    expect(rollEventType(sequentialRng([0.5]))).toBe("treasure");
    expect(rollEventType(sequentialRng([0.9]))).toBe("battle");
  });
});

describe("troopPower / enemyPowerForDistance", () => {
  it("レベルが上がるほど部隊戦力が上がる", () => {
    expect(troopPower(5)).toBeGreaterThan(troopPower(1));
  });

  it("距離が進むほど敵が強くなる", () => {
    expect(enemyPowerForDistance(50)).toBeGreaterThan(enemyPowerForDistance(1));
  });
});

describe("resolveQuestTap", () => {
  it("遭遇イベントは報酬があるがwonはnull", () => {
    const event = resolveQuestTap(10, 1, sequentialRng([0.1, 0.5]));
    expect(event.type).toBe("encounter");
    expect(event.reward).toBeGreaterThan(0);
    expect(event.won).toBeNull();
  });

  it("宝箱イベントは遭遇より報酬が大きい", () => {
    const encounter = resolveQuestTap(10, 1, sequentialRng([0.1, 0]));
    const treasure = resolveQuestTap(10, 1, sequentialRng([0.5, 0]));
    expect(treasure.reward).toBeGreaterThan(encounter.reward);
  });

  it("圧倒的に強ければ戦闘に勝ちやすく報酬が出る", () => {
    const event = resolveQuestTap(1, 100, sequentialRng([0.99, 0.01]));
    expect(event.type).toBe("battle");
    expect(event.won).toBe(true);
    expect(event.reward).toBeGreaterThan(0);
  });

  it("戦闘に負けると報酬は0", () => {
    const event = resolveQuestTap(500, 1, sequentialRng([0.99, 0.99]));
    expect(event.type).toBe("battle");
    expect(event.won).toBe(false);
    expect(event.reward).toBe(0);
  });

  it("同じrngシードなら再現できる", () => {
    const a = resolveQuestTap(20, 3, sequentialRng([0.3, 0.6]));
    const b = resolveQuestTap(20, 3, sequentialRng([0.3, 0.6]));
    expect(a).toEqual(b);
  });
});
