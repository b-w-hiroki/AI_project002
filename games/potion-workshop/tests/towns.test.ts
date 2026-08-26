import { describe, expect, it } from "vitest";
import { TOWNS, townForPrestige } from "../src/logic/towns";

describe("townForPrestige", () => {
  it("転生0回目は最初の街", () => {
    expect(townForPrestige(0).name).toBe(TOWNS[0]!.name);
    expect(townForPrestige(0).cycle).toBe(0);
  });

  it("転生するたびに次の街へ切り替わる", () => {
    expect(townForPrestige(1).name).toBe(TOWNS[1]!.name);
    expect(townForPrestige(2).name).toBe(TOWNS[2]!.name);
  });

  it("街のリストを一巡すると周回数が付く", () => {
    const wrapped = townForPrestige(TOWNS.length);
    expect(wrapped.index).toBe(0);
    expect(wrapped.cycle).toBe(1);
    expect(wrapped.name).toContain(TOWNS[0]!.name);
    expect(wrapped.name).toContain("2周目");
  });

  it("2周目以降も無限に続く", () => {
    const farFuture = townForPrestige(TOWNS.length * 5 + 3);
    expect(farFuture.cycle).toBe(5);
    expect(farFuture.index).toBe(3);
  });
});
