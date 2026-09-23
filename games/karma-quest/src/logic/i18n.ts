import { resolveJaEnLang } from "../../../shared/locale";
import type { Encounter, EncounterChoice } from "./encounter";
import type { Faction, KarmaRequest } from "./karma";
import type { Deity } from "./legend";

export type Lang = "ja" | "en";

export function detectLang(
  search = typeof window !== "undefined" ? window.location.search : "",
  browserLanguage = typeof navigator !== "undefined" ? navigator.language : "en",
  sdkLocale?: string,
): Lang {
  return resolveJaEnLang(search, browserLanguage, sdkLocale);
}

export function tr(lang: Lang, ja: string, en: string): string {
  return lang === "ja" ? ja : en;
}

const FACTION_EN: Record<Faction, string> = {
  warrior: "Warrior Faction",
  merchant: "Merchant Faction",
  outlaw: "Outlaw Faction",
  mage: "Mage Faction",
};
export function factionLabel(lang: Lang, faction: Faction): string {
  return lang === "ja"
    ? { warrior: "戦士の派閥", merchant: "商人の派閥", outlaw: "荒くれ者の派閥", mage: "魔術師の派閥" }[faction]
    : FACTION_EN[faction];
}
export function factionShort(lang: Lang, faction: Faction): string {
  return lang === "ja"
    ? { warrior: "戦士", merchant: "商人", outlaw: "荒くれ", mage: "魔術師" }[faction]
    : { warrior: "Warrior", merchant: "Merchant", outlaw: "Outlaw", mage: "Mage" }[faction];
}

const REQUEST_EN: Record<string, string> = {
  warrior_iron: "We do not have enough iron to forge swords...",
  warrior_train: "We want to test our skills in real combat...",
  merchant_monster: "The monsters make it impossible to travel and trade...",
  merchant_toll: "Could you lower the checkpoint toll for us?",
  outlaw_gold: "We're out of coin and cannot even buy a drink...",
  outlaw_fight: "We're bored. Let us cut loose and fight...",
  mage_stone: "We need magic stones for our research...",
  mage_book: "Grant us permission to read the forbidden tome...",
};
export function requestText(lang: Lang, request: KarmaRequest): string {
  return lang === "ja" ? request.text : (REQUEST_EN[request.id] ?? request.text);
}

const ENCOUNTER_EN: Record<string, { text: string; a: string; b: string }> = {
  wounded_traveler: {
    text: "A wounded traveler lies on the road. Help them, or hurry onward?",
    a: "Help the traveler",
    b: "Press onward",
  },
  mysterious_shrine: {
    text: "You find a moss-covered shrine. Offer a prayer, or pass it by?",
    a: "Offer a prayer",
    b: "Pass it by",
  },
  bandit_camp: {
    text: "You discover a bandit camp. Drive them out, or leave them alone?",
    a: "Drive them out",
    b: "Leave them alone",
  },
  hidden_stash: {
    text: "You spot a glittering hidden vein. Dig it out, or leave it untouched?",
    a: "Dig it out",
    b: "Leave it untouched",
  },
};
export function encounterText(lang: Lang, encounter: Encounter): string {
  return lang === "ja" ? encounter.text : (ENCOUNTER_EN[encounter.id]?.text ?? encounter.text);
}
export function encounterChoiceLabel(
  lang: Lang,
  encounter: Encounter,
  slot: "A" | "B",
): string {
  if (lang === "ja") return slot === "A" ? encounter.choiceA.label : encounter.choiceB.label;
  return slot === "A"
    ? (ENCOUNTER_EN[encounter.id]?.a ?? encounter.choiceA.label)
    : (ENCOUNTER_EN[encounter.id]?.b ?? encounter.choiceB.label);
}
export function choiceLabel(lang: Lang, encounter: Encounter, choice: EncounterChoice): string {
  return choice === encounter.choiceA
    ? encounterChoiceLabel(lang, encounter, "A")
    : encounterChoiceLabel(lang, encounter, "B");
}

export function deityName(lang: Lang, deity: Deity): string {
  return deity === "valor"
    ? tr(lang, "軍神", "God of Valor")
    : tr(lang, "慈愛神", "Goddess of Mercy");
}
export function deityWish(lang: Lang, deity: Deity): string {
  return deity === "valor"
    ? tr(lang, "武勇を求める。次年は強敵と大きな加護", "Values valor. Next year brings a stronger foe and a greater blessing.")
    : tr(lang, "支援と生還を好む。次年は安定した加護", "Values support and survival. Next year brings a steady blessing.");
}
export function mandateLabel(lang: Lang, label: string): string {
  if (lang === "ja") return label;
  if (label.startsWith("軍神の試練")) return "Trial of Valor: foe +1 tier / greater blessing";
  if (label.startsWith("慈愛神の祝福")) return "Blessing of Mercy: normal hunt / stable blessing";
  if (label.startsWith("最初の旅")) return "First Journey: shape your hero freely";
  return label;
}
export function legendTitleText(lang: Lang, valor: number, mercy: number): string {
  if (lang === "ja") {
    if (valor > mercy * 1.5) return "戦場に名を刻む勇者";
    if (mercy > valor * 1.5) return "人々の灯を守る勇者";
    return "剣と慈悲を携える勇者";
  }
  if (valor > mercy * 1.5) return "Hero Who Carved a Name in Battle";
  if (mercy > valor * 1.5) return "Hero Who Guarded the People's Light";
  return "Hero of Blade and Mercy";
}
export function deedTagLabel(lang: Lang, tag: "valor" | "mercy" | "wisdom"): string {
  return tag === "valor"
    ? tr(lang, "武勇", "Valor")
    : tag === "mercy"
      ? tr(lang, "慈悲", "Mercy")
      : tr(lang, "知恵", "Wisdom");
}
