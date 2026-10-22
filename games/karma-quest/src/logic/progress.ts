import { withSaveLock } from "./saveLock";
import { claimStorage } from "./claimStorage";
/** ベスト到達ステージ・累計評価の永続化（localStorage）。Phaser非依存の保存ロジック */

const BEST_STAGE_KEY = "karma_quest_best_stage_v1";
const TOTAL_EVAL_KEY = "karma_quest_total_eval_v1";

const MAX_STAGE = 12;

function validCounter(value: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function createProgressStorage(getStore: () => Pick<Storage, "getItem" | "setItem"> = () => claimStorage) {
  const session = new Map<string, number>();
  const unavailable = new Set<string>();

  function loadNumber(key: string, maximum = Number.MAX_SAFE_INTEGER): number {
    if (unavailable.has(key)) return session.get(key) ?? 0;
    let raw: string | null;
    try {
      raw = getStore().getItem(key);
    } catch {
      unavailable.add(key);
      return session.get(key) ?? 0;
    }
    if (!raw) {
      session.set(key, 0);
      return 0;
    }
    const n = Number(raw);
    // Invalid records are ignored, not rewritten merely by viewing the home screen.
    const value = validCounter(n, maximum) ? n : 0;
    session.set(key, value);
    return value;
  }

  function saveNumber(key: string, value: number): void {
    session.set(key, value);
    if (unavailable.has(key)) return;
    try {
      getStore().setItem(key, String(value));
    } catch {
      // Keep this counter session-only until reload. Retrying against stale data
      // could discard rewards or overwrite progress from another tab.
      unavailable.add(key);
    }
  }

  function loadBestStage(): number {
    return loadNumber(BEST_STAGE_KEY, MAX_STAGE);
  }

  function saveBestStage(stage: number): void {
    if (validCounter(stage, MAX_STAGE) && stage > loadBestStage()) {
      saveNumber(BEST_STAGE_KEY, stage);
    }
  }

  function loadTotalEvaluation(): number {
    return loadNumber(TOTAL_EVAL_KEY);
  }

  function addTotalEvaluation(amount: number): number {
    const current = loadTotalEvaluation();
    if (!validCounter(amount)) return current;
    // Saturate before addition so a valid reward cannot write an unsafe integer.
    const next = current + Math.min(amount, Number.MAX_SAFE_INTEGER - current);
    saveNumber(TOTAL_EVAL_KEY, next);
    return next;
  }

  function useSessionOnly(): void {
    loadBestStage();
    loadTotalEvaluation();
    unavailable.add(BEST_STAGE_KEY);
    unavailable.add(TOTAL_EVAL_KEY);
  }
  return {
    loadBestStage, saveBestStage, loadTotalEvaluation, addTotalEvaluation, useSessionOnly,
    hasUnavailableProgress: () => unavailable.size > 0,
    isSessionOnly: (counter: "best" | "total") => unavailable.has(counter === "best" ? BEST_STAGE_KEY : TOTAL_EVAL_KEY),
  };
}

const progress = createProgressStorage();
export const { loadBestStage, loadTotalEvaluation, hasUnavailableProgress } = progress;
export async function saveBestStage(stage: number): Promise<void> {
  if (progress.isSessionOnly("best")) { progress.saveBestStage(stage); return; }
  try { await withSaveLock(() => progress.saveBestStage(stage)); }
  catch { progress.useSessionOnly(); progress.saveBestStage(stage); }
}
export async function addTotalEvaluation(amount: number): Promise<number> {
  // Once this counter is memory-only, no shared storage can be touched. Avoid
  // repeating a lock timeout on every report; other healthy counters still lock.
  if (progress.isSessionOnly("total")) return progress.addTotalEvaluation(amount);
  // The action itself absorbs storage failures. A lock failure instead opts the
  // tab into session-only progress, never an unprotected persistent write.
  try { return await withSaveLock(() => progress.addTotalEvaluation(amount)); }
  catch { progress.useSessionOnly(); return progress.addTotalEvaluation(amount); }
}
