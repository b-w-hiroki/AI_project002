import { describe, expect, it } from "vitest";
import { GACHA_COST, canAffordGacha, drawGacha } from "../src/logic/gacha";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("drawGacha", () => {
  it("低い乱数値ほど高レアリティが出る", () => {
    const ssr = drawGacha(sequentialRng([0.001, 0.5]));
    expect(ssr.rarity).toBe("SSR");
  });

  it("高い乱数値はNレアリティになる", () => {
    const n = drawGacha(sequentialRng([0.999, 0.5]));
    expect(n.rarity).toBe("N");
  });

  it("同じrngシードなら再現できる", () => {
    const a = drawGacha(sequentialRng([0.3, 0.6]));
    const b = drawGacha(sequentialRng([0.3, 0.6]));
    expect(a).toEqual(b);
  });
});

describe("canAffordGacha", () => {
  it("コスト未満なら引けない", () => {
    expect(canAffordGacha(GACHA_COST - 1)).toBe(false);
    expect(canAffordGacha(GACHA_COST)).toBe(true);
  });
});
