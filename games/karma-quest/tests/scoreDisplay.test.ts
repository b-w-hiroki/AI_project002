import { describe, expect, it } from "vitest";
import { scoreDisplay } from "../src/logic/scoreDisplay";

describe("compact score display", () => {
  it.each([[0, "0"], [1480, "1480"], [9999, "9999"], [10000, "1万"],
    [19999, "1.9万"], [99999999, "9999.9万"], [1e8, "1億"],
    [1e12, "1兆"], [Number.MAX_SAFE_INTEGER, "9007.1兆"]] as const)("formats %s as %s", (value, expected) => {
    expect(scoreDisplay(value)).toBe(expected);
  });
});
