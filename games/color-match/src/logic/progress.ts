/** ベストスコア・ベストターボボーナスの永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const BEST_SCORE_KEY = "color_match_best_score_v1";
const BEST_TURBO_KEY = "color_match_best_turbo_v1";

function loadNumber(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function saveIfHigher(key: string, value: number): void {
  if (value > loadNumber(key)) {
    localStorage.setItem(key, String(value));
  }
}

export function loadBestScore(): number {
  return loadNumber(BEST_SCORE_KEY);
}

export function saveBestScore(score: number): void {
  saveIfHigher(BEST_SCORE_KEY, score);
}

export function loadBestTurbo(): number {
  return loadNumber(BEST_TURBO_KEY);
}

export function saveBestTurbo(points: number): void {
  saveIfHigher(BEST_TURBO_KEY, points);
}
