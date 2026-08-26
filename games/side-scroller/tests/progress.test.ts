import { describe, expect, it } from "vitest";
import type { KVStore } from "../src/logic/loadout";
import { loadBestWave, saveBestWave } from "../src/logic/progress";

function memoryStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("loadBestWave / saveBestWave", () => {
  it("未保存なら0を返す", () => {
    expect(loadBestWave(memoryStore())).toBe(0);
  });

  it("保存した値を読み込める", () => {
    const store = memoryStore();
    saveBestWave(store, 5);
    expect(loadBestWave(store)).toBe(5);
  });

  it("記録を更新した時だけ保存する", () => {
    const store = memoryStore();
    saveBestWave(store, 5);
    saveBestWave(store, 3);
    expect(loadBestWave(store)).toBe(5);
    saveBestWave(store, 8);
    expect(loadBestWave(store)).toBe(8);
  });
});
