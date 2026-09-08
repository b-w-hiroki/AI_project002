import { describe, it, expect } from "vitest";
import { styleMultiplier, bossPhase } from "../src/logic/style";
describe("流派とボス", () => {
  it("居合の準備と連撃の上限", () => {
    expect(styleMultiplier("draw", 0, 1199)).toBe(1);
    expect(styleMultiplier("draw", 0, 1200)).toBe(1.9);
    expect(styleMultiplier("chain", 100, 0)).toBe(1.6);
  });
  it("予兆・突進・隙の順に繰り返す", () =>
    expect([0, 999, 1000, 1599, 1600, 2999, 3000].map(bossPhase)).toEqual([
      "tell",
      "tell",
      "charge",
      "charge",
      "recover",
      "recover",
      "tell",
    ]));
});
