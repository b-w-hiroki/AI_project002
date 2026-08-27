import { describe, expect, it } from "vitest";
import {
  choiceCountForLevel,
  generateRound,
  scoreRound,
  summarizeSession,
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

describe("choiceCountForLevel", () => {
  it("レベルが上がるほど選択肢が増え、6で頭打ちになる", () => {
    expect(choiceCountForLevel(0)).toBe(3);
    expect(choiceCountForLevel(3)).toBe(4);
    expect(choiceCountForLevel(30)).toBe(6);
  });
});

describe("generateRound", () => {
  it("choices の中に正解の属性を持つカードがちょうど1枚だけある", () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = sequentialRng([seed / 20, (seed + 3) / 23, (seed + 7) / 29, 0.4, 0.6, 0.1, 0.9]);
      const round = generateRound(5, rng);
      const target = round.judgeMode === "content" ? round.promptWord : round.promptInk;
      const matches = round.choices.filter((c) =>
        round.judgeMode === "content" ? c.word === target : c.ink === target,
      );
      expect(matches).toHaveLength(1);
      expect(round.correctIndex).toBeGreaterThanOrEqual(0);
      const correctCard = round.choices[round.correctIndex]!;
      expect(round.judgeMode === "content" ? correctCard.word : correctCard.ink).toBe(target);
    }
  });

  it("choices の枚数はレベルに応じたcount通りになる", () => {
    const round = generateRound(3, sequentialRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(round.choices).toHaveLength(4);
  });

  it("同じrngシードなら再現できる", () => {
    const a = generateRound(5, sequentialRng([0.3, 0.6, 0.9, 0.1]));
    const b = generateRound(5, sequentialRng([0.3, 0.6, 0.9, 0.1]));
    expect(a).toEqual(b);
  });
});

describe("scoreRound", () => {
  it("不正解は0点", () => {
    expect(scoreRound({ correct: false, reactionMs: 300 })).toBe(0);
  });

  it("速く正解するほど高得点になる", () => {
    const fast = scoreRound({ correct: true, reactionMs: 300 });
    const slow = scoreRound({ correct: true, reactionMs: 2000 });
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("summarizeSession", () => {
  it("結果が空なら全て0", () => {
    expect(summarizeSession([])).toEqual({ accuracy: 0, avgReactionMs: 0, score: 0 });
  });

  it("正答率と反応速度からスコアを算出する", () => {
    const summary = summarizeSession([
      { correct: true, reactionMs: 400 },
      { correct: true, reactionMs: 600 },
      { correct: false, reactionMs: 900 },
    ]);
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.avgReactionMs).toBe(500);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.score).toBeLessThanOrEqual(100);
  });

  it("全問正解・高速なら高スコアになる", () => {
    const summary = summarizeSession([
      { correct: true, reactionMs: 250 },
      { correct: true, reactionMs: 300 },
    ]);
    expect(summary.score).toBeGreaterThan(80);
  });
});
