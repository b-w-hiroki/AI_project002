/**
 * 三国ポチポチの武将ガチャロジック（Phaser非依存の純粋関数）。
 * 企画書の「武将ガチャ」を踏襲しつつ、オリジナル/クローンの二層構造や
 * NFT/WEC要素は持たず、ゲーム内通貨だけで引けるガチャ演出として実装する。
 */

export type Rarity = "SSR" | "SR" | "R" | "N";

export interface General {
  id: string;
  name: string;
  rarity: Rarity;
  atk: number;
}

export const GENERAL_POOL: readonly General[] = [
  { id: "gen_hakuen", name: "白炎", rarity: "SSR", atk: 90 },
  { id: "gen_soujin", name: "蒼刃", rarity: "SR", atk: 60 },
  { id: "gen_guren", name: "紅蓮", rarity: "SR", atk: 58 },
  { id: "gen_genbu", name: "玄武", rarity: "R", atk: 38 },
  { id: "gen_suzaku", name: "朱雀", rarity: "R", atk: 36 },
  { id: "gen_seiryu", name: "青龍", rarity: "R", atk: 37 },
  { id: "gen_kohei", name: "小兵", rarity: "N", atk: 20 },
  { id: "gen_ashigaru", name: "足軽", rarity: "N", atk: 18 },
] as const;

const RARITY_RATE: Readonly<Record<Rarity, number>> = {
  SSR: 3,
  SR: 12,
  R: 35,
  N: 50,
};

export const GACHA_COST = 80;

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

function rollRarity(rng: () => number): Rarity {
  const r = rng() * 100;
  let acc = 0;
  for (const rarity of ["SSR", "SR", "R", "N"] as const) {
    acc += RARITY_RATE[rarity];
    if (r < acc) return rarity;
  }
  return "N";
}

/** 武将ガチャを1回引く。rng差し替え可能（テストで決定的に検証するため） */
export function drawGeneral(rng: () => number = Math.random): General {
  const rarity = rollRarity(rng);
  const pool = GENERAL_POOL.filter((g) => g.rarity === rarity);
  return pick(pool, rng);
}

export function canAffordGacha(balance: number): boolean {
  return balance >= GACHA_COST;
}
