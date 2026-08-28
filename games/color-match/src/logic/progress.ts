/** ベストスコア・ベストターボボーナス・表記モード設定の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

import { WRITING_MODES, WritingMode } from "./round";

const BEST_SCORE_KEY = "color_match_best_score_v1";
const BEST_TURBO_KEY = "color_match_best_turbo_v1";
const WRITING_MODE_KEY = "color_match_writing_mode_v1";

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

export function loadWritingMode(): WritingMode {
  const raw = localStorage.getItem(WRITING_MODE_KEY);
  return (WRITING_MODES as readonly string[]).includes(raw ?? "") ? (raw as WritingMode) : "hiragana";
}

export function saveWritingMode(mode: WritingMode): void {
  localStorage.setItem(WRITING_MODE_KEY, mode);
}
