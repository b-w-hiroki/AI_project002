/**
 * 転生（プレステージ）と連動した街システム。
 * 現在地に加えて、次の転生先を2候補から選べる。
 */
export interface Town {
  name: string;
  desc: string;
  accent: number;
  /** この街で需要が高い設備ID。該当設備の生産が1.5倍になる。 */
  demandGeneratorId: string | null;
  /** 街の依頼を達成した時の評判倍率。 */
  contractRewardMultiplier: number;
}

export const TOWNS: readonly Town[] = [
  { name: "始まりの村", desc: "旅の起点となるのどかな村", accent: 0x4ecca3, demandGeneratorId: null, contractRewardMultiplier: 1 },
  { name: "水辺の街オルシャ", desc: "運河沿いに市場が並ぶ街", accent: 0x2f8fd1, demandGeneratorId: "garden", contractRewardMultiplier: 1.25 },
  { name: "灯火の都カレニカ", desc: "夜通し明かりが灯る商業都市", accent: 0xffd166, demandGeneratorId: "cauldron", contractRewardMultiplier: 1.5 },
  { name: "霧の高原レイン", desc: "薬草が豊富に採れる高原", accent: 0x8a4fd1, demandGeneratorId: "garden", contractRewardMultiplier: 1.5 },
  { name: "竜脈の谷ドラコニア", desc: "古い遺跡が眠る秘境", accent: 0xe0447a, demandGeneratorId: "cauldron", contractRewardMultiplier: 1.75 },
  { name: "星詠みの塔アストラ", desc: "星の力を借りた秘術が伝わる塔", accent: 0x1f8a63, demandGeneratorId: "apprentice", contractRewardMultiplier: 1.75 },
  { name: "終焉の砂海ネクロス", desc: "禁忌の錬成術が囁かれる砂漠", accent: 0x6a7a95, demandGeneratorId: "cauldron", contractRewardMultiplier: 2 },
  { name: "楽園の島エデンリア", desc: "最果てにあるとされる伝説の島", accent: 0xc98a12, demandGeneratorId: "garden", contractRewardMultiplier: 2 },
] as const;

export interface CurrentTown extends Town {
  index: number;
  cycle: number;
}

export interface TownProgress {
  townIndex: number;
  prestigeCount: number;
}

function normalizeIndex(index: number): number {
  const size = TOWNS.length;
  return ((Math.floor(index) % size) + size) % size;
}

export function townAt(index: number, prestigeCount = 0): CurrentTown {
  const normalized = normalizeIndex(index);
  const cycle = Math.floor(Math.max(0, prestigeCount) / TOWNS.length);
  const base = TOWNS[normalized]!;
  const name = cycle > 0 ? `${base.name}（${cycle + 1}周目）` : base.name;
  return { ...base, name, index: normalized, cycle };
}

export function townForState(state: TownProgress): CurrentTown {
  return townAt(state.townIndex, state.prestigeCount);
}

/** 旧仕様との互換用。自動巡回する場合は転生回数をそのまま街indexへ使う。 */
export function townForPrestige(prestigeCount: number): CurrentTown {
  return townAt(prestigeCount, prestigeCount);
}

/** 現在地から見て次の2都市を分岐候補として返す。 */
export function nextTownChoices(state: TownProgress): readonly [CurrentTown, CurrentTown] {
  const nextPrestige = state.prestigeCount + 1;
  return [
    townAt(state.townIndex + 1, nextPrestige),
    townAt(state.townIndex + 2, nextPrestige),
  ] as const;
}
