/** 2言語対応（日本語/英語）。Phaser 非依存の純粋ロジック。 */

export type Lang = "ja" | "en";

const MESSAGES = {
  title: { ja: "🧪 ポーション工房", en: "🧪 Potion Workshop" },
  potions: { ja: "ポーション", en: "potions" },
  perSec: { ja: "/秒", en: "/sec" },
  brew: { ja: "調合！", en: "Brew!" },
  cost: { ja: "コスト", en: "Cost" },
  welcomeBack: {
    ja: "おかえりなさい！ 留守中に {n} ポーション調合されました",
    en: "Welcome back! You brewed {n} potions while away",
  },
  langButton: { ja: "EN", en: "日本語" },
  essence: { ja: "✨ エッセンス", en: "✨ Essence" },
  essenceBonus: { ja: "生産 +{n}%", en: "Production +{n}%" },
  prestige: { ja: "転生する（+{n} ✨）", en: "Ascend (+{n} ✨)" },
  prestigeLocked: {
    ja: "累計 {n} 調合で転生解放",
    en: "Brew {n} total to unlock ascension",
  },
  prestigeConfirm: {
    ja: "進行をリセットして {n} エッセンスを獲得します。よろしいですか？",
    en: "Reset progress and gain {n} essence. Are you sure?",
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;

const GENERATOR_NAMES: Record<string, { ja: string; en: string }> = {
  apprentice: { ja: "見習い錬金術師", en: "Apprentice Alchemist" },
  cauldron: { ja: "自動大釜", en: "Auto Cauldron" },
  garden: { ja: "薬草園", en: "Herb Garden" },
  golem: { ja: "調合ゴーレム", en: "Brewing Golem" },
  portal: { ja: "異界ポータル", en: "Otherworld Portal" },
};

export function t(lang: Lang, key: MessageKey, params?: Record<string, string>): string {
  let text: string = MESSAGES[key][lang];
  for (const [k, v] of Object.entries(params ?? {})) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

export function generatorName(lang: Lang, id: string): string {
  return GENERATOR_NAMES[id]?.[lang] ?? id;
}

/** ブラウザの言語設定から初期言語を決める */
export function detectLang(navigatorLanguage: string): Lang {
  return navigatorLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function toggleLang(lang: Lang): Lang {
  return lang === "ja" ? "en" : "ja";
}
