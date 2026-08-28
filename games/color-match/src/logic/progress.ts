/** ベストスコアの永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const BEST_SCORE_KEY = "color_match_best_score_v1";

export function loadBestScore(): number {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function saveBestScore(score: number): void {
  const current = loadBestScore();
  if (score > current) {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  }
}
