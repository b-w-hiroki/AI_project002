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
