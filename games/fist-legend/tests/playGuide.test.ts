import { describe, expect, it } from "vitest";
import { exchangeGuide, finishReason } from "../src/logic/playGuide";

describe("first battle guidance", () => {
  it("coaches the first three exchanges and then leaves the rule visible", () => {
    expect(exchangeGuide("ja", "punch", 0)).toBe("蹴で有利を取ろう");
    expect(exchangeGuide("ja", "kick", 1)).toBe("気で有利を取ろう");
    expect(exchangeGuide("ja", "ki", 2)).toBe("拳で有利を取ろう");
    expect(exchangeGuide("ja", "ki", 3)).toBe("有利: 拳>気>蹴>拳");
    expect(exchangeGuide("en", "punch", 0)).toContain("Counter with");
    expect(exchangeGuide("en", "punch", 3)).toBe("Beats: Punch>Ki>Kick>Punch");
  });
  it("distinguishes knockout, simultaneous knockout, and HP decisions", () => {
    expect(finishReason("ja", { playerHp: 75, enemyHp: 0 })).toBe("相手のHPを0にした");
    expect(finishReason("ja", { playerHp: 0, enemyHp: 75 })).toBe("自分のHPが0になった");
    expect(finishReason("ja", { playerHp: 0, enemyHp: 0 })).toBe("両者のHPが0に");
    for (const [playerHp, enemyHp] of [[75, 25], [25, 75], [50, 50]] as const) {
      expect(finishReason("ja", { playerHp, enemyHp })).toBe(`時間切れ · 残りHP ${playerHp} 対 ${enemyHp}`);
      expect(finishReason("en", { playerHp, enemyHp })).toContain("Time up");
    }
  });
});
