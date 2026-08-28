/**
 * カルマクエストの報告パートのロジック（Phaser非依存の純粋関数）。
 * 企画書の「試合結果すべてを報告しなくても良い、ハイライトシーンを選んで
 * 神様に見せる」というスポーツ中継的なアイデアを単純化した。
 * 良い場面だけを選んで報告するほど評価が上がり、悪い場面まで報告すると評価が下がる。
 */

import { BattleResult } from "./battle";

export interface Highlight {
  id: string;
  label: string;
  /** 神様の評価への寄与。正なら良い場面、負なら悪い場面 */
  quality: number;
}

const GOOD_HIGHLIGHTS: readonly Omit<Highlight, "id">[] = [
  { label: "見事な一撃を決めた", quality: 8 },
  { label: "危機を華麗に切り抜けた", quality: 6 },
  { label: "仲間を守り抜いた", quality: 7 },
];

const BAD_HIGHLIGHTS: readonly Omit<Highlight, "id">[] = [
  { label: "無様に転んだ", quality: -6 },
  { label: "攻撃を外しまくった", quality: -5 },
  { label: "怖気づいて後退した", quality: -7 },
];

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

/**
 * 討伐結果に応じてハイライト候補を生成する。勝利時は良い場面が多く、
 * 敗北時は悪い場面が混じりやすい。rng差し替え可能（テストで決定的に検証するため）。
 */
export function rollHighlights(battle: BattleResult, rng: () => number = Math.random): Highlight[] {
  const goodCount = battle.win ? 3 : 1;
  const badCount = battle.win ? 1 : 3;

  const highlights: Highlight[] = [];
  for (let i = 0; i < goodCount; i++) {
    highlights.push({ id: `good_${i}`, ...pick(GOOD_HIGHLIGHTS, rng) });
  }
  for (let i = 0; i < badCount; i++) {
    highlights.push({ id: `bad_${i}`, ...pick(BAD_HIGHLIGHTS, rng) });
  }
  return highlights;
}

/** 選んだハイライトの合計値。最低0点（大失敗の報告にはしない） */
export function evaluateReport(selected: readonly Highlight[]): number {
  const total = selected.reduce((sum, h) => sum + h.quality, 0);
  return Math.max(0, total);
}
