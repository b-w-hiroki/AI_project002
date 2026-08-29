/**
 * カルマクエストの討伐ロジック（Phaser非依存の純粋関数）。
 * 企画書の「オートバトルで魔王討伐」を単純化し、勇者の総合力と魔物の強さを比較して
 * 勝敗と被ダメージを算出する。
 */

import { HeroStats } from "./karma";

export function heroPower(stats: HeroStats): number {
  return stats.atk + stats.magic + stats.def * 0.5 + stats.hp * 0.1;
}

/** ステージが進むほど魔物が強くなる */
export function monsterPowerForStage(stage: number): number {
  return 18 + stage * 3.5;
}

export interface BattleResult {
  win: boolean;
  /** 0〜1。勇者がどれだけ余裕を持って（またはギリギリで）勝敗したかの割合 */
  hpRatioRemaining: number;
}

/**
 * オートバトルを解決する。勇者の力と魔物の力の比に応じて勝率を決め、
 * 勝敗と残りHP割合を返す。rng差し替え可能（テストで決定的に検証するため）。
 */
export function autoBattle(stats: HeroStats, stage: number, rng: () => number = Math.random): BattleResult {
  const power = heroPower(stats);
  const monsterPower = monsterPowerForStage(stage);
  const ratio = power / monsterPower;
  const winProbability = Math.max(0.05, Math.min(0.95, ratio - 0.3));
  const win = rng() < winProbability;

  const hpRatioRemaining = win
    ? Math.max(0.1, Math.min(1, ratio - 0.5 + rng() * 0.2))
    : Math.max(0, ratio * 0.3 - rng() * 0.1);

  return { win, hpRatioRemaining };
}
