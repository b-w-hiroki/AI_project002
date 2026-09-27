import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function installStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  });
  return map;
}

beforeEach(() => installStorage());
afterEach(() => vi.unstubAllGlobals());

import { emptyPerformanceStats, loadBestScore, loadBestTurbo, loadPerformanceStats, loadWritingMode } from "../src/logic/progress";

describe("progress durability", () => {
  it("negative/NaN numeric saves fall back to zero", () => {
    installStorage({
      color_match_60s_best_score_v1: "-99",
      color_match_60s_best_turbo_v1: "NaN",
    });
    expect(loadBestScore()).toBe(0);
    expect(loadBestTurbo()).toBe(0);
  });

  it("invalid writing mode falls back safely", () => {
    installStorage({ color_match_writing_mode_v1: "broken" });
    expect(loadWritingMode()).toBe("hiragana");
  });

  it("corrupt performance JSON returns an empty shape", () => {
    installStorage({ color_match_performance_v1: "{broken" });
    expect(loadPerformanceStats()).toEqual(emptyPerformanceStats());
  });

  it("performance fields are normalized", () => {
    installStorage({
      color_match_performance_v1: JSON.stringify({
        content: { correct: -2, total: 3.9, reactionTotalMs: -12, reactionSamples: 2.8 },
      }),
    });
    expect(loadPerformanceStats().content).toEqual({
      correct: 0,
      total: 3,
      reactionTotalMs: 0,
      reactionSamples: 2,
    });
  });
});
