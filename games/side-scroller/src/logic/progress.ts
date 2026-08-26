/**
 * ウェーブ式サバイバルの「ベスト到達ウェーブ」永続化。
 * ロードアウトのセーブとは別キーで localStorage（KVStore経由）に保存する。
 */

import type { KVStore } from "./loadout";

const BEST_WAVE_KEY = "ai_project002_sideScroller_bestWave_v1";

export function loadBestWave(store: KVStore): number {
  const raw = store.getItem(BEST_WAVE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 記録を更新した時だけ保存する */
export function saveBestWave(store: KVStore, wave: number): void {
  if (wave > loadBestWave(store)) {
    store.setItem(BEST_WAVE_KEY, String(wave));
  }
}
