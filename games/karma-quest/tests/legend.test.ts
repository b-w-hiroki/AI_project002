import { describe, it, expect } from "vitest";
import {
  scoreDeeds,
  nextMandate,
  legendTitle,
  type Deed,
} from "../src/logic/legend";
import { battleWinProbability } from "../src/logic/battle";
import { deriveStats } from "../src/logic/karma";
const deeds: Deed[] = [
  { id: "a", label: "討伐した", tag: "valor", quality: 4 },
  { id: "b", label: "声援を送った", tag: "mercy", quality: 4 },
  { id: "c", label: "交渉した", tag: "wisdom", quality: 4 },
];
describe("伝説の報告", () => {
  it("同じ場面でも神様で評価が違う", () =>
    expect(scoreDeeds([deeds[0]!], "valor")).toBeGreaterThan(
      scoreDeeds([deeds[0]!], "mercy"),
    ));
  it("重複と3枚目は加点しない", () => {
    expect(scoreDeeds([deeds[0]!, deeds[0]!], "valor")).toBe(12);
    expect(scoreDeeds(deeds, "valor")).toBe(
      scoreDeeds(deeds.slice(0, 2), "valor"),
    );
  });
  it("軍神には高い加護と追加の課題がある", () => {
    const a = nextMandate(deeds, "valor"),
      b = nextMandate(deeds, "mercy");
    expect(a.bonus).toBeGreaterThan(b.bonus);
    expect(a.threat).toBe(1);
    expect(b.threat).toBe(0);
  });
  it("軍神と慈愛神は12年進行で極端な有利不利にならない", () => {
    const stats = deriveStats({ warrior: 6, merchant: 6, outlaw: 6, mage: 6 });
    const valorDeeds = [deeds[0]!, deeds[2]!];
    const mercyDeeds = [deeds[1]!, deeds[2]!];
    for (const stage of [3, 6, 9, 12]) {
      const valor = nextMandate(valorDeeds, "valor");
      const mercy = nextMandate(mercyDeeds, "mercy");
      const valorP = battleWinProbability(stats, stage + valor.threat, 10, valor.bonus);
      const mercyP = battleWinProbability(stats, stage + mercy.threat, 10, mercy.bonus);
      expect(Math.abs(valorP - mercyP)).toBeLessThanOrEqual(0.08);
      if (stage === 12) {
        expect(valorP).toBeGreaterThanOrEqual(0.5);
        expect(mercyP).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it("報告先の積み重ねが称号になる", () =>
    expect(
      new Set([legendTitle(10, 2), legendTitle(2, 10), legendTitle(6, 6)]).size,
    ).toBe(3));
});
