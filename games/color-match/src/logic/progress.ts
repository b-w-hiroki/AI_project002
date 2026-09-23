/** ベストスコア・ベストターボボーナス・表記モード設定の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

import { WRITING_MODES, WritingMode } from "./round";
import type { ChallengeResult } from "./challenge";

const BEST_SCORE_KEY = "color_match_60s_best_score_v1";
const BEST_TURBO_KEY = "color_match_60s_best_turbo_v1";
const WRITING_MODE_KEY = "color_match_writing_mode_v1";
const PERFORMANCE_KEY = "color_match_performance_v1";

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

export function loadWritingMode(defaultMode: WritingMode = "hiragana"): WritingMode {
  const raw = localStorage.getItem(WRITING_MODE_KEY);
  return (WRITING_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as WritingMode)
    : defaultMode;
}

export function saveWritingMode(mode: WritingMode): void {
  localStorage.setItem(WRITING_MODE_KEY, mode);
}


export type PerformanceGroup = "content" | "color" | "switch";

export interface PerformanceMetric {
  correct: number;
  total: number;
  reactionTotalMs: number;
  reactionSamples: number;
}

export type PerformanceStats = Record<PerformanceGroup, PerformanceMetric>;

function emptyMetric(): PerformanceMetric {
  return { correct: 0, total: 0, reactionTotalMs: 0, reactionSamples: 0 };
}

export function emptyPerformanceStats(): PerformanceStats {
  return {
    content: emptyMetric(),
    color: emptyMetric(),
    switch: emptyMetric(),
  };
}

export function loadPerformanceStats(): PerformanceStats {
  const raw = localStorage.getItem(PERFORMANCE_KEY);
  if (!raw) return emptyPerformanceStats();
  try {
    const parsed = JSON.parse(raw) as Partial<PerformanceStats>;
    const normalize = (value?: Partial<PerformanceMetric>): PerformanceMetric => ({
      correct: Number.isFinite(value?.correct) ? Math.max(0, Number(value?.correct)) : 0,
      total: Number.isFinite(value?.total) ? Math.max(0, Number(value?.total)) : 0,
      reactionTotalMs: Number.isFinite(value?.reactionTotalMs) ? Math.max(0, Number(value?.reactionTotalMs)) : 0,
      reactionSamples: Number.isFinite(value?.reactionSamples) ? Math.max(0, Number(value?.reactionSamples)) : 0,
    });
    return {
      content: normalize(parsed.content),
      color: normalize(parsed.color),
      switch: normalize(parsed.switch),
    };
  } catch {
    return emptyPerformanceStats();
  }
}

export function recordPerformance(results: readonly ChallengeResult[]): PerformanceStats {
  const stats = loadPerformanceStats();
  const apply = (group: PerformanceGroup, result: ChallengeResult) => {
    const metric = stats[group];
    metric.total += 1;
    if (result.correct) {
      metric.correct += 1;
      metric.reactionTotalMs += result.reactionMs;
      metric.reactionSamples += 1;
    }
  };
  for (const result of results) {
    apply(result.mode, result);
    if (result.switched) apply("switch", result);
  }
  localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(stats));
  return stats;
}

export function metricAccuracy(metric: PerformanceMetric): number {
  return metric.total > 0 ? metric.correct / metric.total : 0;
}

export function metricAvgReaction(metric: PerformanceMetric): number {
  return metric.reactionSamples > 0 ? metric.reactionTotalMs / metric.reactionSamples : 0;
}

/** 履歴が少ない群を優先し、十分な履歴があれば正答率→反応速度の順で弱点を決める。 */
export function weakestJudgeMode(stats: PerformanceStats = loadPerformanceStats()): "content" | "color" {
  const content = stats.content;
  const color = stats.color;
  if (content.total < 5 || color.total < 5) return content.total <= color.total ? "content" : "color";
  const contentAcc = metricAccuracy(content);
  const colorAcc = metricAccuracy(color);
  if (Math.abs(contentAcc - colorAcc) >= 0.03) return contentAcc < colorAcc ? "content" : "color";
  return metricAvgReaction(content) >= metricAvgReaction(color) ? "content" : "color";
}
