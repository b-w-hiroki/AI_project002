import { describe, expect, it } from "vitest";
import {
  generateRound,
  scoreRound,
  summarizeSession,
  timeLimitMsForLevel,
} from "../src/logic/round";

/** テストを決定的にするための疑似乱数（呼び出しごとに巡回する） */
function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("timeLimitMsForLevel", () => {
  it("レベルが上がるほど制限時間が短くなり、下限で頭打ちになる", () => {
    expect(timeLimitMsForLevel(0)).toBe(4200);
    expect(timeLimitMsForLevel(4)).toBe(3600);
    expect(timeLimitMsForLevel(100)).toBe(1800);
  });
});

describe("generateRound", () => {
  it("judgeMode=contentなら正解の枠はpromptWordと一致する", () => {
    const round = generateRound(sequentialRng([0.1, 0.9, 0.1]));
    expect(round.judgeMode).toBe("content");
    expect(round.correctColorId).toBe(round.promptWord);
  });

  it("judgeMode=colorなら正解の枠はpromptInkと一致する", () => {
    const round = generateRound(sequentialRng([0.1, 0.9, 0.9, 0.9]));
    expect(round.judgeMode).toBe("color");
    expect(round.correctColorId).toBe(round.promptInk);
  });

  it("同じrngシードなら再現できる", () => {
    const a = generateRound(sequentialRng([0.3, 0.6, 0.9, 0.1]));
    const b = generateRound(sequentialRng([0.3, 0.6, 0.9, 0.1]));
    expect(a).toEqual(b);
  });
});

describe("scoreRound", () => {
  it("不正解・タイムアウトは0点", () => {
    expect(scoreRound({ correct: false, timedOut: false, reactionMs: 300 })).toBe(0);
    expect(scoreRound({ correct: false, timedOut: true, reactionMs: 4200 })).toBe(0);
  });

  it("速く正解するほど高得点になる", () => {
    const fast = scoreRound({ correct: true, timedOut: false, reactionMs: 300 });
    const slow = scoreRound({ correct: true, timedOut: false, reactionMs: 2000 });
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("summarizeSession", () => {
  it("結果が空なら全て0", () => {
    expect(summarizeSession([])).toEqual({ accuracy: 0, avgReactionMs: 0, score: 0 });
  });

  it("正答率と反応速度からスコアを算出する", () => {
    const summary = summarizeSession([
      { correct: true, timedOut: false, reactionMs: 400 },
      { correct: true, timedOut: false, reactionMs: 600 },
      { correct: false, timedOut: true, reactionMs: 4200 },
    ]);
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.avgReactionMs).toBe(500);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.score).toBeLessThanOrEqual(100);
  });

  it("全問正解・高速なら高スコアになる", () => {
    const summary = summarizeSession([
      { correct: true, timedOut: false, reactionMs: 250 },
      { correct: true, timedOut: false, reactionMs: 300 },
    ]);
    expect(summary.score).toBeGreaterThan(80);
  });
});
