/**
 * 転生（プレステージ）と連動した「街」の切り替え。
 * ユーザーから「ポーションの売り先とか街とか、何かが切り替わる感じにしよう」との要望を受けて追加した。
 * 無限に転生できる放置ゲームの性質はそのままに、転生するたびに販売先の街が変わる
 * ことで「ステージ感」を出す。街のリストを一巡したら周回数を付けて名前を継続させる。
 */

export interface Town {
  name: string;
  desc: string;
  /** 街ごとの差別化用アクセントカラー（背景の淡いグローに使う） */
  accent: number;
}

export const TOWNS: readonly Town[] = [
  { name: "始まりの村", desc: "旅の起点となるのどかな村", accent: 0x4ecca3 },
  { name: "水辺の街オルシャ", desc: "運河沿いに市場が並ぶ街", accent: 0x2f8fd1 },
  { name: "灯火の都カレニカ", desc: "夜通し明かりが灯る商業都市", accent: 0xffd166 },
  { name: "霧の高原レイン", desc: "薬草が豊富に採れる高原", accent: 0x8a4fd1 },
  { name: "竜脈の谷ドラコニア", desc: "古い遺跡が眠る秘境", accent: 0xe0447a },
  { name: "星詠みの塔アストラ", desc: "星の力を借りた秘術が伝わる塔", accent: 0x1f8a63 },
  { name: "終焉の砂海ネクロス", desc: "禁忌の錬成術が囁かれる砂漠", accent: 0x6a7a95 },
  { name: "楽園の島エデンリア", desc: "最果てにあるとされる伝説の島", accent: 0xc98a12 },
] as const;

export interface CurrentTown extends Town {
  index: number;
  /** TOWNS を一巡した回数（0始まり） */
  cycle: number;
}

/** 転生回数から現在の街を求める。TOWNS を一巡したら周回数を名前に付ける */
export function townForPrestige(prestigeCount: number): CurrentTown {
  const index = prestigeCount % TOWNS.length;
  const cycle = Math.floor(prestigeCount / TOWNS.length);
  const base = TOWNS[index]!;
  const name = cycle > 0 ? `${base.name}（${cycle + 1}周目）` : base.name;
  return { ...base, name, index, cycle };
}
