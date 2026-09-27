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

import { loadCurrency, loadStoryProgress, loadTeam, loadWinCount } from "../src/logic/progress";

describe("progress durability", () => {
  it("negative/invalid numeric saves fall back safely", () => {
    installStorage({
      fist_legend_currency_v1: "-10",
      fist_legend_win_count_v1: "Infinity",
      fist_legend_story_progress_v1: "-3",
    });
    expect(loadCurrency()).toBe(0);
    expect(loadWinCount()).toBe(0);
    expect(loadStoryProgress()).toBe(0);
  });

  it("corrupt team JSON falls back to Ryuga", () => {
    installStorage({ fist_legend_team_v1: "{broken" });
    expect(loadTeam()).toEqual(["ryuga"]);
  });
});
