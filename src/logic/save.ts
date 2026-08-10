import { GameState, newGame } from "./economy";

const SAVE_KEY = "ai_project002_save_v1";

export interface SaveData {
  state: GameState;
  savedAt: number; // epoch ms
}

/** localStorage 互換のインターフェース（テストではメモリ実装を注入） */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function save(state: GameState, store: KVStore, now: number): void {
  const data: SaveData = { state, savedAt: now };
  store.setItem(SAVE_KEY, JSON.stringify(data));
}

export function load(store: KVStore): SaveData | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    if (typeof data?.state?.potions !== "number") return null;
    // 旧セーブに新フィールドが無くても壊れないようマージ
    return { state: { ...newGame(), ...data.state }, savedAt: data.savedAt ?? 0 };
  } catch {
    return null;
  }
}
