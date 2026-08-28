/**
 * ガチャ演出のロジック（Phaser非依存の純粋関数）。
 * 元企画にあった「ガチャでキャラ/奥義/覇者カードを入手する」手触りを踏襲しつつ、
 * このリポジトリの他2作と同様に実際の課金要素は一切持たない。
 * 対価は戦闘で稼ぐゲーム内通貨（豪拳石、仮）のみ。
 */

export type Rarity = "N" | "R" | "SR" | "SSR";

export interface GachaItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: "character" | "ougi" | "hasha";
}

export const GACHA_POOL: readonly GachaItem[] = [
  { id: "char_ryu", name: "竜牙", rarity: "SSR", kind: "character" },
  { id: "char_ren", name: "蓮花", rarity: "SR", kind: "character" },
  { id: "char_gaku", name: "岳", rarity: "R", kind: "character" },
  { id: "char_mei", name: "冥", rarity: "N", kind: "character" },
  { id: "ougi_hyakuretsu", name: "百裂拳", rarity: "SSR", kind: "ougi" },
  { id: "ougi_shousan", name: "昇山脚", rarity: "SR", kind: "ougi" },
  { id: "ougi_rekku", name: "裂空掌", rarity: "R", kind: "ougi" },
  { id: "ougi_kihou", name: "気砲", rarity: "N", kind: "ougi" },
  { id: "hasha_gou", name: "覇者の剛", rarity: "SR", kind: "hasha" },
  { id: "hasha_jun", name: "覇者の柔", rarity: "R", kind: "hasha" },
  { id: "hasha_shun", name: "覇者の瞬", rarity: "R", kind: "hasha" },
] as const;

/** レアリティごとの排出率（%）。合計100 */
const RARITY_RATE: Readonly<Record<Rarity, number>> = {
  SSR: 3,
  SR: 12,
  R: 35,
  N: 50,
};

export const GACHA_COST = 100;

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

/** ガチャを1回引く。rng差し替え可能（テストで決定的に検証するため） */
export function drawGacha(rng: () => number = Math.random): GachaItem {
  const rarity = rollRarity(rng);
  const pool = GACHA_POOL.filter((item) => item.rarity === rarity);
  return pick(pool, rng);
}

export function canAffordGacha(balance: number): boolean {
  return balance >= GACHA_COST;
}
