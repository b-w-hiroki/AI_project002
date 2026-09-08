import { describe, it, expect } from "vitest";
import {
  scoreDeeds,
  nextMandate,
  legendTitle,
  type Deed,
} from "../src/logic/legend";
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
  it("報告先の積み重ねが称号になる", () =>
    expect(
      new Set([legendTitle(10, 2), legendTitle(2, 10), legendTitle(6, 6)]).size,
    ).toBe(3));
});
