import type { RegionId } from "./regions";

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

const GENERAL: Record<string, string> = {
  gen_hakuen: "Hakuen",
  gen_soujin: "Soujin",
  gen_guren: "Guren",
  gen_genbu: "Genbu",
  gen_suzaku: "Suzaku",
  gen_seiryu: "Seiryu",
  gen_kohei: "Foot Soldier",
  gen_ashigaru: "Ashigaru",
};
export function generalName(lang: Lang, id: string, fallback: string): string {
  return lang === "ja" ? fallback : (GENERAL[id] ?? fallback);
}

const REGION: Record<RegionId, { name: string; subtitle: string; boss: string; hint: string }> = {
  plains: {
    name: "Dawn Road",
    subtitle: "Chapter of Departure",
    boss: "Road Gate",
    hint: "Bring a guardian and learn when to return safely.",
  },
  pass: {
    name: "Emerald Pass",
    subtitle: "Mountain Crossing",
    boss: "Pass Fortress",
    hint: "Enemies grow stronger. Prepare with training and gear.",
  },
  citadel: {
    name: "Crimson Citadel",
    subtitle: "Final Battle",
    boss: "Citadel Main Gate",
    hint: "The final region. Returning safely is also a valid strategy.",
  },
};
export function regionText(
  lang: Lang,
  region: { id: RegionId; name: string; subtitle: string; boss: string; hint: string },
) {
  return lang === "ja" ? region : { ...region, ...REGION[region.id] };
}

const ROLE: Record<string, string> = {
  "猛将": "Vanguard",
  "守将": "Guardian",
  "軍師": "Strategist",
  "商才": "Merchant",
};
export function roleName(lang: Lang, role: string): string {
  return lang === "ja" ? role : (ROLE[role] ?? role);
}

export function expeditionMessage(lang: Lang, message: string): string {
  if (lang === "ja") return message;
  const exact: Record<string, string> = {
    "街道へ。安全を優先して進む。": "Take the road and prioritize safety.",
    "山道へ。強敵の先には多くの財宝。": "Take the mountain path. Greater danger brings greater treasure.",
    "無理せず帰還。収穫を次の遠征へ。": "Return safely and carry the spoils into the next expedition.",
    "行商隊と合流。補給品を分けてもらった。": "Met a merchant caravan and received supplies.",
    "村の炊き出しで兵が息を整えた。": "The troops recovered at a village kitchen.",
    "峠の薬草地を発見。傷を手当てした。": "Found medicinal herbs in the pass and treated the wounded.",
    "落石に遭遇。荷を守りながら進軍した。": "A rockfall struck; the troops protected the cargo and pressed on.",
    "城塞外郭の隠し倉を発見。軍資金を確保。": "Found a hidden storehouse outside the citadel and secured funds.",
    "火計跡を突破。損耗したが戦利品を回収。": "Crossed a burned battlefield, taking losses but recovering spoils.",
  };
  if (exact[message]) return exact[message]!;
  let out = message
    .replace(/(.+)へ出発。10地点先の関門を目指そう。/, "Depart for $1. Reach the gate 10 stops ahead.")
    .replace(/関門戦/g, "Gate Battle")
    .replace(/小競り合い/g, "Skirmish")
    .replace(/勝利/g, "Victory")
    .replace(/撤退/g, "Retreat")
    .replace(/兵力/g, "Troops")
    .replace(/銭/g, "Coins")
    .replace(/街道の財宝を発見。/g, "Found treasure on the road. ")
    .replace(/無理せず帰還。収穫を次の遠征へ。/g, "Returned safely with the current spoils.");
  for (const [ja, en] of Object.entries(exact)) out = out.replace(ja, en);
  return out;
}
