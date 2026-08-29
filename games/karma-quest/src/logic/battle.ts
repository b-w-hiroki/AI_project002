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

/** おうえん1回あたりの勝率上乗せ量。上限を設けて連打が支配的にならないようにする */
const CHEER_BONUS_PER_TAP = 0.015;
const CHEER_BONUS_CAP = 0.15;

/** おうえん回数から勝率への上乗せ量を算出する（純粋関数、Vitestで境界値を検証） */
export function cheerBonus(cheerCount: number): number {
  return Math.min(CHEER_BONUS_CAP, Math.max(0, cheerCount) * CHEER_BONUS_PER_TAP);
}

/**
 * オートバトルを解決する。勇者の力と魔物の力の比に応じて勝率を決め、
 * 勝敗と残りHP割合を返す。企画書にあった「応援して力を貸す」要素を、
 * 討伐中にタップした回数（cheerCount）による勝率の微小な上乗せとして実装。
 * rng差し替え可能（テストで決定的に検証するため）。
 */
export function autoBattle(
  stats: HeroStats,
  stage: number,
  rng: () => number = Math.random,
  cheerCount = 0,
): BattleResult {
  const power = heroPower(stats);
  const monsterPower = monsterPowerForStage(stage);
  const ratio = power / monsterPower;
  const winProbability = Math.max(0.05, Math.min(0.95, ratio - 0.3 + cheerBonus(cheerCount)));
  const win = rng() < winProbability;

  const hpRatioRemaining = win
    ? Math.max(0.1, Math.min(1, ratio - 0.5 + rng() * 0.2))
    : Math.max(0, ratio * 0.3 - rng() * 0.1);

  return { win, hpRatioRemaining };
}
