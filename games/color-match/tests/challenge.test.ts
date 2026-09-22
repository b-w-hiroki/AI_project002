import { describe, it, expect } from "vitest";
import {
  judgeAt,
  challengeRound,
  nextSwitchAt,
  accuracyFor,
  congruentRateAt,
} from "../src/logic/challenge";
describe("60秒の段階出題", () => {
  it("境界で段階が変わる", () => {
    expect(judgeAt(14999)).toBe("content");
    expect(judgeAt(15000)).toBe("color");
    expect(judgeAt(30000)).toBe("content");
    expect(judgeAt(35000)).toBe("color");
    expect(judgeAt(48000)).toBe("color");
  });
  it("次の境界を正しく予告", () => {
    expect(nextSwitchAt(29999)).toBe(30000);
    expect(nextSwitchAt(44000)).toBe(45000);
    expect(nextSwitchAt(59999)).toBe(60000);
  });
  it("判定と正解が一致する", () => {
    for (const ms of [0, 16000]) {
      const r = challengeRound(ms, () => 0.5);
      expect(r.correctColorId).toBe(
        r.judgeMode === "content" ? r.promptWord : r.promptInk,
      );
    }
  });

  it("後半ほど同色率が下がり、ストループ矛盾が増える", () => {
    expect(congruentRateAt(0)).toBe(0.45);
    expect(congruentRateAt(15000)).toBe(0.32);
    expect(congruentRateAt(30000)).toBe(0.24);
    expect(congruentRateAt(45000)).toBe(0.16);
  });
  it("出題なしを0%としない", () =>
    expect(accuracyFor([], "switch")).toBe("— (出題なし)"));
});
