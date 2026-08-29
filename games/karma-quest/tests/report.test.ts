import { describe, expect, it } from "vitest";
import { evaluateReport, rollHighlights } from "../src/logic/report";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("rollHighlights", () => {
  it("勝利時は良い場面の方が多い", () => {
    const highlights = rollHighlights({ win: true, hpRatioRemaining: 0.8 }, sequentialRng([0.1]));
    const good = highlights.filter((h) => h.quality > 0).length;
    const bad = highlights.filter((h) => h.quality < 0).length;
    expect(good).toBeGreaterThan(bad);
  });

  it("敗北時は悪い場面の方が多い", () => {
    const highlights = rollHighlights({ win: false, hpRatioRemaining: 0 }, sequentialRng([0.1]));
    const good = highlights.filter((h) => h.quality > 0).length;
    const bad = highlights.filter((h) => h.quality < 0).length;
    expect(bad).toBeGreaterThan(good);
  });
});

describe("evaluateReport", () => {
  it("良い場面だけを選ぶと高評価になる", () => {
    const good = [
      { id: "1", label: "a", quality: 8 },
      { id: "2", label: "b", quality: 6 },
    ];
    expect(evaluateReport(good)).toBe(14);
  });

  it("悪い場面まで含めると評価が下がる", () => {
    const mixed = [
      { id: "1", label: "a", quality: 8 },
      { id: "2", label: "b", quality: -6 },
    ];
    expect(evaluateReport(mixed)).toBe(2);
  });

  it("合計がマイナスでも0点未満にはならない", () => {
    const allBad = [
      { id: "1", label: "a", quality: -8 },
      { id: "2", label: "b", quality: -6 },
    ];
    expect(evaluateReport(allBad)).toBe(0);
  });

  it("何も選ばなければ0点", () => {
    expect(evaluateReport([])).toBe(0);
  });
});
