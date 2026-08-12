/**
 * 自前の軽量アナリティクス。外部送信は一切せず localStorage に集計するのみ。
 * 将来のバランス調整の参考データ用（プレイ時間、転生回数の推移など）。
 */

const ANALYTICS_KEY = "ai_project002_analytics_v1";

export interface AnalyticsData {
  sessionsCount: number;
  totalPlaytimeSec: number;
  maxPrestigeCount: number;
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;
}

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function newAnalytics(): AnalyticsData {
  return {
    sessionsCount: 0,
    totalPlaytimeSec: 0,
    maxPrestigeCount: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
  };
}

export function loadAnalytics(store: KVStore): AnalyticsData {
  const raw = store.getItem(ANALYTICS_KEY);
  if (!raw) return newAnalytics();
  try {
    const data = JSON.parse(raw) as Partial<AnalyticsData>;
    return { ...newAnalytics(), ...data };
  } catch {
    return newAnalytics();
  }
}

export function saveAnalytics(data: AnalyticsData, store: KVStore): void {
  store.setItem(ANALYTICS_KEY, JSON.stringify(data));
}

/** セッション開始時に1回呼ぶ */
export function recordSessionStart(data: AnalyticsData, now: number): AnalyticsData {
  return {
    ...data,
    sessionsCount: data.sessionsCount + 1,
    firstPlayedAt: data.firstPlayedAt ?? now,
    lastPlayedAt: now,
  };
}

/** 定期的（例: 5秒ごと）にプレイ時間を積算 */
export function recordPlaytime(data: AnalyticsData, deltaSec: number, now: number): AnalyticsData {
  return {
    ...data,
    totalPlaytimeSec: data.totalPlaytimeSec + deltaSec,
    lastPlayedAt: now,
  };
}

export function recordPrestige(data: AnalyticsData, prestigeCount: number): AnalyticsData {
  return { ...data, maxPrestigeCount: Math.max(data.maxPrestigeCount, prestigeCount) };
}
