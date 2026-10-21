import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("does not queue session-only progress behind a failed lock again", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Lock unavailable"));
  const setItem = vi.fn();
  vi.stubGlobal("navigator", { locks: { request } });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem });
  const progress = await import("../src/logic/progress");
  expect(await progress.addTotalEvaluation(80)).toBe(80);
  expect(await progress.addTotalEvaluation(20)).toBe(100);
  await progress.saveBestStage(4);
  expect(progress.loadBestStage()).toBe(4);
  expect(request).toHaveBeenCalledTimes(1);
  expect(setItem).not.toHaveBeenCalled();
});

it("still locks the healthy counter after only evaluation storage fails", async () => {
  const values = new Map<string, string>();
  const request = vi.fn(async (_name: string, _options: unknown, action: () => unknown) => action());
  vi.stubGlobal("navigator", { locks: { request } });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === "karma_quest_total_eval_v1") throw new Error("Quota exceeded");
      values.set(key, value);
    },
  });
  const progress = await import("../src/logic/progress");
  expect(await progress.addTotalEvaluation(80)).toBe(80);
  expect(await progress.addTotalEvaluation(20)).toBe(100);
  await progress.saveBestStage(4);
  expect(request).toHaveBeenCalledTimes(2);
  expect(values.get("karma_quest_best_stage_v1")).toBe("4");
  expect(values.has("karma_quest_total_eval_v1")).toBe(false);
});
