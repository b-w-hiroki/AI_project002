import { describe, expect, it } from "vitest";
import {
  FACTIONS,
  applyKarmaChoice,
  deriveStats,
  dominantFaction,
  initialKarma,
  rollRequest,
} from "../src/logic/karma";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("initialKarma", () => {
  it("全派閥が0から始まる", () => {
    const karma = initialKarma();
    for (const faction of FACTIONS) {
      expect(karma[faction]).toBe(0);
    }
  });
});

describe("applyKarmaChoice", () => {
  it("要望に応じるとその派閥のカルマが上がる", () => {
    const karma = initialKarma();
    const request = rollRequest(sequentialRng([0]));
    const next = applyKarmaChoice(karma, request, true);
    expect(next[request.faction]).toBeGreaterThan(karma[request.faction]);
  });

  it("断ると他派閥のカルマが僅かに上がる（要望した派閥は変化しない）", () => {
    const karma = initialKarma();
    const request = rollRequest(sequentialRng([0]));
    const next = applyKarmaChoice(karma, request, false);
    expect(next[request.faction]).toBe(karma[request.faction]);
    for (const faction of FACTIONS) {
      if (faction !== request.faction) expect(next[faction]).toBeGreaterThan(karma[faction]);
    }
  });
});

describe("deriveStats", () => {
  it("戦士カルマが高いほどATKが伸びる", () => {
    const low = deriveStats({ warrior: 0, merchant: 0, outlaw: 0, mage: 0 });
    const high = deriveStats({ warrior: 20, merchant: 0, outlaw: 0, mage: 0 });
    expect(high.atk).toBeGreaterThan(low.atk);
  });

  it("魔術師カルマが高いほどMAGICが伸びる", () => {
    const low = deriveStats({ warrior: 0, merchant: 0, outlaw: 0, mage: 0 });
    const high = deriveStats({ warrior: 0, merchant: 0, outlaw: 0, mage: 20 });
    expect(high.magic).toBeGreaterThan(low.magic);
  });
});

describe("dominantFaction", () => {
  it("最もカルマが高い派閥を返す", () => {
    const karma = { warrior: 5, merchant: 20, outlaw: 3, mage: 1 };
    expect(dominantFaction(karma)).toBe("merchant");
  });
});
