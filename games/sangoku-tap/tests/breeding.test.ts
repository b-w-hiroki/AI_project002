import { describe, expect, it } from "vitest";
import { breedEquipment, breedRateTable } from "../src/logic/breeding";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("breedRateTable", () => {
  it("企画書の表通りの排出率を返す（Common×Rare）", () => {
    expect(breedRateTable("Common", "Rare")).toEqual({ Common: 79, Rare: 20, Epic: 1 });
  });

  it("引数の順序に関わらず同じ結果になる", () => {
    expect(breedRateTable("Rare", "Common")).toEqual(breedRateTable("Common", "Rare"));
  });

  it("Common×Commonは常にCommon", () => {
    expect(breedRateTable("Common", "Common")).toEqual({ Common: 100, Rare: 0, Epic: 0 });
  });

  it("Epic×Epicは常にEpic", () => {
    expect(breedRateTable("Epic", "Epic")).toEqual({ Common: 0, Rare: 0, Epic: 100 });
  });

  it("Rare×Rareより高レアな親の組み合わせほどEpicの排出率が高い", () => {
    const rareRare = breedRateTable("Rare", "Rare");
    const rareEpic = breedRateTable("Rare", "Epic");
    expect(rareEpic.Epic).toBeGreaterThan(rareRare.Epic);
  });
});

describe("breedEquipment", () => {
  it("Common×Commonは必ずCommonになる", () => {
    expect(breedEquipment("Common", "Common", sequentialRng([0.99]))).toBe("Common");
  });

  it("低い乱数値ほど排出率の高いレアリティ（先頭側）になる", () => {
    expect(breedEquipment("Rare", "Epic", sequentialRng([0.1]))).toBe("Rare");
  });

  it("高い乱数値ではより高レアになりうる", () => {
    expect(breedEquipment("Rare", "Epic", sequentialRng([0.9]))).toBe("Epic");
  });

  it("同じrngシードなら再現できる", () => {
    const a = breedEquipment("Common", "Epic", sequentialRng([0.5]));
    const b = breedEquipment("Common", "Epic", sequentialRng([0.5]));
    expect(a).toBe(b);
  });
});
