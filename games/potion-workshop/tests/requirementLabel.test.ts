import { describe, expect, it } from "vitest";
import { requirementLabel } from "../src/logic/requirementLabel";
import { newGame, clickUpgradeCost } from "../src/logic/economy";

describe("requirement labels", () => {
  it("shows missing amounts, not total costs", () => {
    expect(requirementLabel(30, 120, "ja", "deliver")).toBe("あと90");
    expect(requirementLabel(30, 120, "en", "deliver")).toBe("90 more");
    expect(requirementLabel(119.99, 120, "ja", "deliver")).toBe("あと1");
  });
  it("marks only affordable actions ready", () => {
    expect(requirementLabel(120, 120, "ja", "deliver")).toBe("納品できる ✓");
    expect(requirementLabel(500, 120, "en", "deliver")).toBe("Deliver now ✓");
    expect(requirementLabel(0, clickUpgradeCost(newGame()), "en", "buy")).toMatch(/more$/);
    expect(requirementLabel(10000, 15, "en", "buy")).toBe("Buy now ✓");
  });
});
