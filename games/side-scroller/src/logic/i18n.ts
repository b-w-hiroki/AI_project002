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

export function weaponLabel(lang: Lang, kind: "melee" | "mid" | "ranged"): string {
  const labels = {
    ja: { melee: "近接", mid: "中距離", ranged: "遠距離" },
    en: { melee: "Melee", mid: "Mid-range", ranged: "Ranged" },
  } as const;
  return labels[lang][kind];
}

export function combatStyleLabel(lang: Lang, style: "chain" | "draw"): string {
  return style === "chain"
    ? tr(lang, "連撃", "Combo")
    : tr(lang, "居合", "Draw");
}


const WEAPON_NAMES: Record<string, { ja: string; en: string }> = {
  iron_sword: { ja: "鉄の剣", en: "Iron Sword" },
  greatsword: { ja: "大剣", en: "Greatsword" },
  war_spear: { ja: "戦槍", en: "War Spear" },
  naginata: { ja: "薙刀", en: "Naginata" },
  short_bow: { ja: "短弓", en: "Short Bow" },
  heavy_crossbow: { ja: "重弩", en: "Heavy Crossbow" },
};
const ARMOR_NAMES: Record<string, { ja: string; en: string }> = {
  none: { ja: "なし", en: "None" },
  leather: { ja: "革の鎧", en: "Leather Armor" },
  chain: { ja: "鎖帷子", en: "Chainmail" },
  plate: { ja: "板金鎧", en: "Plate Armor" },
};
const ITEM_NAMES: Record<string, { ja: string; en: string }> = {
  potion: { ja: "ポーション", en: "Potion" },
  power_charm: { ja: "剛力の護符", en: "Power Charm" },
  haste_charm: { ja: "俊足の護符", en: "Haste Charm" },
};
const BUFF_TEXT: Record<string, { jaLabel: string; enLabel: string; jaDesc: string; enDesc: string }> = {
  power: { jaLabel: "攻撃力アップ", enLabel: "Power Up", jaDesc: "しばらくの間ダメージが増加する", enDesc: "Increase damage for a while" },
  haste: { jaLabel: "俊足", enLabel: "Haste", jaDesc: "しばらくの間移動速度が上昇する", enDesc: "Increase movement speed for a while" },
  regen: { jaLabel: "HP自動回復", enLabel: "Regeneration", jaDesc: "しばらくの間HPが少しずつ回復する", enDesc: "Recover HP gradually for a while" },
  doubleJump: { jaLabel: "空中二段ジャンプ", enLabel: "Double Jump", jaDesc: "しばらくの間、空中でもう一度ジャンプできる", enDesc: "Jump one extra time in midair for a while" },
};

export function weaponName(lang: Lang, id: string, fallback = id): string {
  const value = WEAPON_NAMES[id];
  return value ? value[lang] : fallback;
}
export function armorName(lang: Lang, id: string, fallback = id): string {
  const value = ARMOR_NAMES[id];
  return value ? value[lang] : fallback;
}
export function itemName(lang: Lang, id: string, fallback = id): string {
  const value = ITEM_NAMES[id];
  return value ? value[lang] : fallback;
}
export function stageBuffText(lang: Lang, kind: string, fallbackLabel: string, fallbackDesc: string): { label: string; desc: string } {
  const value = BUFF_TEXT[kind];
  if (!value) return { label: fallbackLabel, desc: fallbackDesc };
  return lang === "ja"
    ? { label: value.jaLabel, desc: value.jaDesc }
    : { label: value.enLabel, desc: value.enDesc };
}
