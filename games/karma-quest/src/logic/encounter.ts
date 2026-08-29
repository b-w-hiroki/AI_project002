/**
 * 討伐パートの遭遇イベント（Phaser非依存の純粋関数）。
 * 企画書にあった「行く先々で遭遇するイベントで選択によりカルマ・魔物への影響が変わる」を、
 * 育成フェーズの要望とは別の、討伐直前に挟まる二択イベントとして実装する。
 */

import { Faction, KarmaState } from "./karma";

export interface EncounterChoice {
  label: string;
  /** 選んだ時に加算されるカルマ（対象派閥のみ） */
  karmaFaction: Faction;
  karmaDelta: number;
  /** この討伐限りの勝率への上乗せ（マイナスもありうる） */
  powerBonus: number;
}

export interface Encounter {
  id: string;
  text: string;
  choiceA: EncounterChoice;
  choiceB: EncounterChoice;
}

export const ENCOUNTERS: readonly Encounter[] = [
  {
    id: "wounded_traveler",
    text: "傷ついた旅人が倒れている。介抱するか、先を急ぐか…",
    choiceA: { label: "介抱する", karmaFaction: "merchant", karmaDelta: 3, powerBonus: -0.05 },
    choiceB: { label: "先を急ぐ", karmaFaction: "outlaw", karmaDelta: 2, powerBonus: 0.05 },
  },
  {
    id: "mysterious_shrine",
    text: "苔むした祠を見つけた。祈りを捧げるか、素通りするか…",
    choiceA: { label: "祈りを捧げる", karmaFaction: "mage", karmaDelta: 3, powerBonus: 0.03 },
    choiceB: { label: "素通りする", karmaFaction: "warrior", karmaDelta: 1, powerBonus: 0 },
  },
  {
    id: "bandit_camp",
    text: "野盗の野営地を見つけた。討ち払うか、見逃すか…",
    choiceA: { label: "討ち払う", karmaFaction: "warrior", karmaDelta: 3, powerBonus: -0.03 },
    choiceB: { label: "見逃す", karmaFaction: "outlaw", karmaDelta: 3, powerBonus: 0 },
  },
  {
    id: "hidden_stash",
    text: "隠された鉱脈らしき輝きを見つけた。掘り出すか、放っておくか…",
    choiceA: { label: "掘り出す", karmaFaction: "merchant", karmaDelta: 3, powerBonus: -0.02 },
    choiceB: { label: "放っておく", karmaFaction: "mage", karmaDelta: 1, powerBonus: 0.02 },
  },
] as const;

/** 遭遇イベントの発生確率（毎回ではなく、たまに挟まる程度に抑える） */
const ENCOUNTER_CHANCE = 0.45;

export function rollEncounterOccurs(rng: () => number = Math.random): boolean {
  return rng() < ENCOUNTER_CHANCE;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

export function rollEncounter(rng: () => number = Math.random): Encounter {
  return pick(ENCOUNTERS, rng);
}

export function applyEncounterChoice(karma: KarmaState, choice: EncounterChoice): KarmaState {
  return { ...karma, [choice.karmaFaction]: karma[choice.karmaFaction] + choice.karmaDelta };
}
