/**
 * 三国ポチポチの装備合成（ブリーディング）ロジック（Phaser非依存の純粋関数）。
 * 企画書のスライド「合成をうまく活用して最強装備をGETしよう！」にあった
 * 「親装備2つのレアリティ組み合わせで、生まれる装備のレア度が決まる」表を
 * そのまま数値化した。NFT/Mint要素は持たず、ゲーム内通貨のみで合成できる。
 */

export type EquipRarity = "Common" | "Rare" | "Epic";

export const BREED_COST = 40;

/** 企画書の表通り: [親装備A, 親装備B] -> 生まれる装備のレアリティ排出率(%) */
const BREED_TABLE: Readonly<Record<string, Readonly<Record<EquipRarity, number>>>> = {
  "Common,Common": { Common: 100, Rare: 0, Epic: 0 },
  "Common,Rare": { Common: 79, Rare: 20, Epic: 1 },
  "Common,Epic": { Common: 50, Rare: 40, Epic: 10 },
  "Rare,Rare": { Common: 0, Rare: 95, Epic: 5 },
  "Rare,Epic": { Common: 0, Rare: 50, Epic: 50 },
  "Epic,Epic": { Common: 0, Rare: 0, Epic: 100 },
};

const RARITY_ORDER: readonly EquipRarity[] = ["Common", "Rare", "Epic"] as const;

function tableKey(a: EquipRarity, b: EquipRarity): string {
  const [lo, hi] = RARITY_ORDER.indexOf(a) <= RARITY_ORDER.indexOf(b) ? [a, b] : [b, a];
  return `${lo},${hi}`;
}

/** 親2つのレアリティから、生まれる装備のレアリティ排出率(%)を返す */
export function breedRateTable(a: EquipRarity, b: EquipRarity): Readonly<Record<EquipRarity, number>> {
  const entry = BREED_TABLE[tableKey(a, b)];
  if (!entry) throw new Error(`unknown breed pair: ${a}, ${b}`);
  return entry;
}

/** 装備を1つ合成する。rng差し替え可能（テストで決定的に検証するため） */
export function breedEquipment(a: EquipRarity, b: EquipRarity, rng: () => number = Math.random): EquipRarity {
  const rates = breedRateTable(a, b);
  const r = rng() * 100;
  let acc = 0;
  for (const rarity of RARITY_ORDER) {
    acc += rates[rarity];
    if (r < acc) return rarity;
  }
  return "Epic";
}
