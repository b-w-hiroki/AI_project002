import { describe, expect, it } from "vitest";
import { improvementFocus } from "../src/logic/resultInsight";
import type { ChallengeResult } from "../src/logic/challenge";

const result = (
  mode: "content" | "color",
  correct: boolean,
  reactionMs = 700,
  switched = false,
): ChallengeResult => ({ mode, correct, reactionMs, switched, timedOut: false });

describe("result improvement focus", () => {
  it("prioritizes weak rule-switch accuracy", () => {
    expect(improvementFocus([
      result("content", true),
      result("color", false, 800, true),
      result("content", false, 780, true),
      result("color", true),
    ])).toBe("switch");
  });

  it("points to the weaker judgment type when switch accuracy is stable", () => {
    expect(improvementFocus([
      result("content", false),
      result("content", false),
      result("color", true),
      result("color", true),
    ])).toBe("content");
  });

  it("moves from accuracy to speed and then FLOW building", () => {
    expect(improvementFocus([
      result("content", true, 1250),
      result("color", true, 1150),
    ])).toBe("speed");
    expect(improvementFocus([
      result("content", true, 650),
      result("color", true, 700),
    ])).toBe("flow");
  });
});
