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

beforeEach(() => {
  installStorage();
  ({ addTotalEvaluation, loadBestStage, loadTotalEvaluation, saveBestStage } = createProgressStorage());
});
afterEach(() => vi.unstubAllGlobals());

import { createProgressStorage } from "../src/logic/progress";
let { addTotalEvaluation, loadBestStage, loadTotalEvaluation, saveBestStage } = createProgressStorage();

describe("progress durability", () => {
  it.each(["13", "99", "1.5", "Infinity", "9007199254740992"])("rejects impossible saved year %s without rewriting storage", raw => {
    const storage = installStorage({ karma_quest_best_stage_v1: raw });
    expect(loadBestStage()).toBe(0);
    expect(storage.get("karma_quest_best_stage_v1")).toBe(raw);
    saveBestStage(1);
    expect(loadBestStage()).toBe(1);
  });
  it.each(["1.5", "Infinity", "9007199254740992"])("rejects invalid saved evaluation %s and allows the next reward", raw => {
    installStorage({ karma_quest_total_eval_v1: raw });
    expect(loadTotalEvaluation()).toBe(0);
    expect(addTotalEvaluation(80)).toBe(80);
    expect(loadTotalEvaluation()).toBe(80);
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("ignores invalid reward %s without losing existing progress", amount => {
    const storage = installStorage({ karma_quest_total_eval_v1: "500" });
    expect(addTotalEvaluation(amount)).toBe(500);
    expect(storage.get("karma_quest_total_eval_v1")).toBe("500");
  });
  it.each([-1, 1.5, 13, NaN, Infinity])("ignores invalid reached year %s", stage => {
    installStorage({ karma_quest_best_stage_v1: "7" });
    saveBestStage(stage);
    expect(loadBestStage()).toBe(7);
  });
  it("saturates evaluation at the safe integer boundary", () => {
    installStorage({ karma_quest_total_eval_v1: String(Number.MAX_SAFE_INTEGER - 10) });
    expect(addTotalEvaluation(80)).toBe(Number.MAX_SAFE_INTEGER);
    expect(loadTotalEvaluation()).toBe(Number.MAX_SAFE_INTEGER);
    expect(addTotalEvaluation(1)).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("keeps the furthest year when another journey starts", () => {
    saveBestStage(1);
    saveBestStage(2);
    saveBestStage(1);
    expect(loadBestStage()).toBe(2);
    saveBestStage(12);
    saveBestStage(2);
    expect(loadBestStage()).toBe(12);
  });
  it("negative/invalid numeric saves fall back safely", () => {
    installStorage({
      karma_quest_best_stage_v1: "-4",
      karma_quest_total_eval_v1: "NaN",
    });
    expect(loadBestStage()).toBe(0);
    expect(loadTotalEvaluation()).toBe(0);
  });
});


describe("unavailable progress storage", () => {
  it("survives a denied localStorage getter and accumulates session progress", () => {
    const progress = createProgressStorage(() => { throw new Error("SecurityError"); });
    expect(progress.loadBestStage()).toBe(0);
    progress.saveBestStage(4);
    progress.saveBestStage(2);
    expect(progress.loadBestStage()).toBe(4);
    expect(progress.addTotalEvaluation(80)).toBe(80);
    expect(progress.addTotalEvaluation(20)).toBe(100);
    expect(progress.loadTotalEvaluation()).toBe(100);
  });

  it("keeps loaded values after quota failure without rereading stale counters", () => {
    const map = new Map([["karma_quest_total_eval_v1", "500"], ["karma_quest_best_stage_v1", "7"]]);
    const setItem = vi.fn(() => { throw new Error("QuotaExceededError"); });
    const store = { getItem: (key: string) => map.get(key) ?? null, setItem };
    const progress = createProgressStorage(() => store);
    expect(progress.addTotalEvaluation(80)).toBe(580);
    expect(progress.addTotalEvaluation(20)).toBe(600);
    progress.saveBestStage(8);
    progress.saveBestStage(2);
    expect(progress.loadBestStage()).toBe(8);
    expect(setItem).toHaveBeenCalledTimes(2);
    // A reload restores only the data actually saved on the device.
    expect(createProgressStorage(() => store).loadTotalEvaluation()).toBe(500);
    expect(map.get("karma_quest_best_stage_v1")).toBe("7");
  });

  it("retains the last readable value when reads become unavailable", () => {
    let denied = false;
    const setItem = vi.fn();
    const progress = createProgressStorage(() => ({
      getItem: () => { if (denied) throw new Error("SecurityError"); return "100"; },
      setItem,
    }));
    expect(progress.loadTotalEvaluation()).toBe(100);
    denied = true;
    expect(progress.addTotalEvaluation(20)).toBe(120);
    denied = false;
    expect(progress.loadTotalEvaluation()).toBe(120);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not resurrect a removed counter if a later read fails", () => {
    let value: string | null = "100";
    let denied = false;
    const progress = createProgressStorage(() => ({
      getItem: () => { if (denied) throw new Error("SecurityError"); return value; },
      setItem: () => undefined,
    }));
    expect(progress.loadTotalEvaluation()).toBe(100);
    value = null;
    expect(progress.loadTotalEvaluation()).toBe(0);
    denied = true;
    expect(progress.loadTotalEvaluation()).toBe(0);
  });
});
