import { describe, expect, it } from "vitest";
import {
  KVStore,
  loadAnalytics,
  newAnalytics,
  recordPlaytime,
  recordPrestige,
  recordSessionStart,
  saveAnalytics,
} from "../src/logic/analytics";

function memStore(): KVStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
  };
}

describe("analytics", () => {
  it("初期値はゼロ", () => {
    const a = newAnalytics();
    expect(a.sessionsCount).toBe(0);
    expect(a.totalPlaytimeSec).toBe(0);
  });

  it("セッション開始でカウント・初回時刻が記録される", () => {
    const a = recordSessionStart(newAnalytics(), 1000);
    expect(a.sessionsCount).toBe(1);
    expect(a.firstPlayedAt).toBe(1000);
    expect(a.lastPlayedAt).toBe(1000);
    const a2 = recordSessionStart(a, 2000);
    expect(a2.sessionsCount).toBe(2);
    expect(a2.firstPlayedAt).toBe(1000); // 初回は上書きされない
  });

  it("プレイ時間が積算される", () => {
    const a = recordPlaytime(recordPlaytime(newAnalytics(), 5, 100), 5, 200);
    expect(a.totalPlaytimeSec).toBe(10);
    expect(a.lastPlayedAt).toBe(200);
  });

  it("最大転生回数が記録される", () => {
    const a = recordPrestige(recordPrestige(newAnalytics(), 3), 1);
    expect(a.maxPrestigeCount).toBe(3);
  });

  it("保存して復元できる", () => {
    const store = memStore();
    const a = recordSessionStart(newAnalytics(), 500);
    saveAnalytics(a, store);
    expect(loadAnalytics(store).sessionsCount).toBe(1);
  });

  it("保存が無ければ初期値", () => {
    expect(loadAnalytics(memStore())).toEqual(newAnalytics());
  });
});
