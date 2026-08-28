/** ベスト到達ステージ・累計評価の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const BEST_STAGE_KEY = "karma_quest_best_stage_v1";
const TOTAL_EVAL_KEY = "karma_quest_total_eval_v1";

function loadNumber(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function loadBestStage(): number {
  return loadNumber(BEST_STAGE_KEY);
}

export function saveBestStage(stage: number): void {
  if (stage > loadBestStage()) {
    localStorage.setItem(BEST_STAGE_KEY, String(stage));
  }
}

export function loadTotalEvaluation(): number {
  return loadNumber(TOTAL_EVAL_KEY);
}

export function addTotalEvaluation(amount: number): number {
  const next = loadTotalEvaluation() + amount;
  localStorage.setItem(TOTAL_EVAL_KEY, String(next));
  return next;
}
