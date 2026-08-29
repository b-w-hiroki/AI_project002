/**
 * カルマクエストの育成ロジック（Phaser非依存の純粋関数）。
 * 2015年の育成RPG企画書にあった「派閥ごとの要望に応えるとカルマ傾向が変化し、
 * 勇者のパラメータや外見に影響する」というカルマシステムを踏襲する。
 */

export type Faction = "warrior" | "merchant" | "outlaw" | "mage";

export const FACTIONS: readonly Faction[] = ["warrior", "merchant", "outlaw", "mage"] as const;

export const FACTION_LABEL: Readonly<Record<Faction, string>> = {
  warrior: "戦士の派閥",
  merchant: "商人の派閥",
  outlaw: "荒くれ者の派閥",
  mage: "魔術師の派閥",
};

export type KarmaState = Readonly<Record<Faction, number>>;

export function initialKarma(): KarmaState {
  return { warrior: 0, merchant: 0, outlaw: 0, mage: 0 };
}

export interface KarmaRequest {
  id: string;
  faction: Faction;
  text: string;
  /** 応じた時にそのカルマへ加算される量 */
  karmaDelta: number;
}

export const KARMA_REQUESTS: readonly KarmaRequest[] = [
  { id: "warrior_iron", faction: "warrior", text: "鉄が足りなくて剣が作れない…", karmaDelta: 5 },
  { id: "warrior_train", faction: "warrior", text: "実戦で腕試しがしたい…", karmaDelta: 4 },
  { id: "merchant_monster", faction: "merchant", text: "魔物が恐ろしくて行商できない…", karmaDelta: 5 },
  { id: "merchant_toll", faction: "merchant", text: "関所の通行料をまけてほしい…", karmaDelta: 3 },
  { id: "outlaw_gold", faction: "outlaw", text: "金が足りなくて酒が飲めないぜ…", karmaDelta: 5 },
  { id: "outlaw_fight", faction: "outlaw", text: "退屈だ、暴れさせてくれ…", karmaDelta: 4 },
  { id: "mage_stone", faction: "mage", text: "魔法の研究に魔石がほしいのです…", karmaDelta: 5 },
  { id: "mage_book", faction: "mage", text: "禁書を読む許可がほしい…", karmaDelta: 4 },
] as const;

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

export function rollRequest(rng: () => number = Math.random): KarmaRequest {
  return pick(KARMA_REQUESTS, rng);
}

/** 要望に応じるとそのカルマが上がり、断ると他派閥が相対的に目立つよう他カルマが僅かに上がる */
export function applyKarmaChoice(state: KarmaState, request: KarmaRequest, accepted: boolean): KarmaState {
  if (accepted) {
    return { ...state, [request.faction]: state[request.faction] + request.karmaDelta };
  }
  const next: Record<Faction, number> = { ...state };
  for (const faction of FACTIONS) {
    if (faction !== request.faction) next[faction] += 1;
  }
  return next;
}

export interface HeroStats {
  atk: number;
  def: number;
  hp: number;
  magic: number;
}

const BASE_STATS: HeroStats = { atk: 10, def: 8, hp: 40, magic: 5 };

/** カルマの傾向からステータスを算出する。派閥ごとに伸びるパラメータが異なる */
export function deriveStats(karma: KarmaState): HeroStats {
  return {
    atk: BASE_STATS.atk + Math.floor(karma.warrior * 0.8) + Math.floor(karma.outlaw * 0.4),
    def: BASE_STATS.def + Math.floor(karma.merchant * 0.6) + Math.floor(karma.warrior * 0.2),
    hp: BASE_STATS.hp + Math.floor(karma.merchant * 1.2) + Math.floor(karma.warrior * 0.6),
    magic: BASE_STATS.magic + Math.floor(karma.mage * 0.9) + Math.floor(karma.outlaw * 0.1),
  };
}

/** 最もカルマが高い派閥。外見の変化演出に使う */
export function dominantFaction(karma: KarmaState): Faction {
  let best: Faction = "warrior";
  for (const faction of FACTIONS) {
    if (karma[faction] > karma[best]) best = faction;
  }
  return best;
}
