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

import { loadBestStage, loadTotalEvaluation } from "../src/logic/progress";

describe("progress durability", () => {
  it("negative/invalid numeric saves fall back safely", () => {
    installStorage({
      karma_quest_best_stage_v1: "-4",
      karma_quest_total_eval_v1: "NaN",
    });
    expect(loadBestStage()).toBe(0);
    expect(loadTotalEvaluation()).toBe(0);
  });
});
