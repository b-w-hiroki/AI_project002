import type { MoveType } from "./battle";
import type { FighterId } from "./team";
import type { Opponent } from "./opponent";

export type Lang = "ja" | "en";

export function detectLang(
  search = typeof window !== "undefined" ? window.location.search : "",
  browserLanguage = typeof navigator !== "undefined" ? navigator.language : "en",
): Lang {
  const forced = new URLSearchParams(search).get("lang");
  if (forced === "ja" || forced === "en") return forced;
  return browserLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function tr(lang: Lang, ja: string, en: string): string {
  return lang === "ja" ? ja : en;
}

const FIGHTER_NAMES: Record<FighterId, [string, string]> = {
  ryuga: ["竜牙", "Ryuga"],
  renka: ["蓮花", "Renka"],
  gaku: ["岳", "Gaku"],
  mei: ["冥", "Mei"],
};

const FIGHTER_ROLES: Record<FighterId, [string, string]> = {
  ryuga: ["攻守の基準", "Balanced"],
  renka: ["連撃・拳", "Combo / Punch"],
  gaku: ["剛力・蹴", "Power / Kick"],
  mei: ["気功・気", "Ki Master"],
};

const OPPONENT_NAMES: Record<Opponent, [string, string]> = {
  rush: ["猛攻の岳", "Gaku the Aggressor"],
  counter: ["反撃の蓮花", "Renka the Counter"],
  charge: ["気功の冥", "Mei the Ki Master"],
};

const OPPONENT_HINTS: Record<Opponent, [string, string]> = {
  rush: ["拳 → 拳 → 気。連係の最後を読もう", "Punch → Punch → Ki. Read the finisher."],
  counter: ["直前のあなたの手に対抗する。初手は蹴", "Counters your previous move. Opens with Kick."],
  charge: ["蹴 → 気 → 気。溜めた気を拳で崩そう", "Kick → Ki → Ki. Break charged Ki with Punch."],
};

const OPPONENT_TYPES: Record<Opponent, [string, string]> = {
  rush: ["猛攻型", "Rush"],
  counter: ["反撃型", "Counter"],
  charge: ["気功型", "Ki"],
};

const MOVE_LABELS: Record<MoveType, [string, string]> = {
  punch: ["拳", "Punch"],
  kick: ["蹴", "Kick"],
  ki: ["気", "Ki"],
};

const MOVE_TELLS: Record<MoveType, [string, string]> = {
  punch: ["拳を引いている", "Pulling back a fist"],
  kick: ["脚へ重心を移した", "Shifting weight to the leg"],
  ki: ["掌に気が集まる", "Ki gathers in the palm"],
};

const GACHA_NAMES: Record<string, [string, string]> = {
  char_ryu: ["竜牙", "Ryuga"],
  char_ren: ["蓮花", "Renka"],
  char_gaku: ["岳", "Gaku"],
  char_mei: ["冥", "Mei"],
  ougi_hyakuretsu: ["百裂拳", "Hundred Fists"],
  ougi_shousan: ["昇山脚", "Rising Mountain Kick"],
  ougi_rekku: ["裂空掌", "Sky-Rending Palm"],
  ougi_kihou: ["気砲", "Ki Cannon"],
  hasha_gou: ["覇者の剛", "Haja: Might"],
  hasha_jun: ["覇者の柔", "Haja: Flow"],
  hasha_shun: ["覇者の瞬", "Haja: Flash"],
};

const STORY: Record<string, { title: [string, string]; intro: [string, string]; clear: [string, string] }> = {
  dojo_breaker: {
    title: ["第一章・道場破り", "Chapter 1: Dojo Breaker"],
    intro: ["王都に現れた猛攻の拳士。まずは正面から、その勢いを止めろ。", "A relentless fighter appears in the capital. Stop his momentum head-on."],
    clear: ["猛攻を制し、次なる使い手への道が開いた。", "You stopped the rush and opened the path to the next challenger."],
  },
  counter_master: {
    title: ["第二章・静水の反撃", "Chapter 2: Still-Water Counter"],
    intro: ["攻めるほど返される反撃の達人。間を読み、先に崩せ。", "A counter master punishes every attack. Read the gap and break her rhythm first."],
    clear: ["静かな反撃を越え、頂への最後の門が姿を現した。", "You overcame the counter style. The final gate now stands before you."],
  },
  ki_grandmaster: {
    title: ["最終章・天衝の気", "Final Chapter: Heaven-Piercing Ki"],
    intro: ["闘技場の頂に待つ気功宗師。三つの型を使い切り、決着をつけろ。", "The Ki grandmaster waits at the summit. Use every style and settle the fight."],
    clear: ["三人の強敵を越え、覇拳の物語を完遂した。", "You defeated all three rivals and completed the Fist Legend."],
  },
};

export const fighterName = (lang: Lang, id: FighterId) => FIGHTER_NAMES[id][lang === "ja" ? 0 : 1];
export const fighterRole = (lang: Lang, id: FighterId) => FIGHTER_ROLES[id][lang === "ja" ? 0 : 1];
export const opponentName = (lang: Lang, id: Opponent) => OPPONENT_NAMES[id][lang === "ja" ? 0 : 1];
export const opponentHint = (lang: Lang, id: Opponent) => OPPONENT_HINTS[id][lang === "ja" ? 0 : 1];
export const opponentType = (lang: Lang, id: Opponent) => OPPONENT_TYPES[id][lang === "ja" ? 0 : 1];
export const moveLabel = (lang: Lang, move: MoveType) => MOVE_LABELS[move][lang === "ja" ? 0 : 1];
export const moveTell = (lang: Lang, move: MoveType) => MOVE_TELLS[move][lang === "ja" ? 0 : 1];
export const gachaName = (lang: Lang, id: string, fallback: string) => GACHA_NAMES[id]?.[lang === "ja" ? 0 : 1] ?? fallback;
export const storyTitle = (lang: Lang, id: string, fallback: string) => STORY[id]?.title[lang === "ja" ? 0 : 1] ?? fallback;
export const storyIntro = (lang: Lang, id: string, fallback: string) => STORY[id]?.intro[lang === "ja" ? 0 : 1] ?? fallback;
export const storyClear = (lang: Lang, id: string, fallback: string) => STORY[id]?.clear[lang === "ja" ? 0 : 1] ?? fallback;
