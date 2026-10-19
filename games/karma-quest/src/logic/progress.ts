/** ベスト到達ステージ・累計評価の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const BEST_STAGE_KEY = "karma_quest_best_stage_v1";
const TOTAL_EVAL_KEY = "karma_quest_total_eval_v1";

const MAX_STAGE = 12;

function validCounter(value: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function loadNumber(key: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  // Invalid records are ignored, not rewritten merely by viewing the home screen.
  return validCounter(n, maximum) ? n : 0;
}

export function loadBestStage(): number {
  return loadNumber(BEST_STAGE_KEY, MAX_STAGE);
}

export function saveBestStage(stage: number): void {
  if (validCounter(stage, MAX_STAGE) && stage > loadBestStage()) {
    localStorage.setItem(BEST_STAGE_KEY, String(stage));
  }
}

export function loadTotalEvaluation(): number {
  return loadNumber(TOTAL_EVAL_KEY);
}

export function addTotalEvaluation(amount: number): number {
  const current = loadTotalEvaluation();
  if (!validCounter(amount)) return current;
  // Saturate before addition so a valid reward cannot write an unsafe integer.
  const next = current + Math.min(amount, Number.MAX_SAFE_INTEGER - current);
  localStorage.setItem(TOTAL_EVAL_KEY, String(next));
  return next;
}
