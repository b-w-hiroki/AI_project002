/** 2言語対応（日本語/英語）。Phaser 非依存の純粋ロジック。 */

export type Lang = "ja" | "en";

const MESSAGES = {
  title: { ja: "ポーション工房", en: "Potion Workshop" },
  potions: { ja: "ポーション", en: "potions" },
  perSec: { ja: "/秒", en: "/sec" },
  brew: { ja: "調合！", en: "Brew!" },
  cost: { ja: "コスト", en: "Cost" },
  welcomeBack: {
    ja: "おかえりなさい！ 留守中に {n} ポーション調合されました",
    en: "Welcome back! You brewed {n} potions while away",
  },
  welcomeTitle: { ja: "おかえりなさい", en: "Welcome back" },
  welcomeClose: { ja: "閉じる", en: "Close" },
  langButton: { ja: "EN", en: "日本語" },
  essence: { ja: "✨ エッセンス", en: "✨ Essence" },
  essenceBonus: { ja: "生産 +{n}%", en: "Production +{n}%" },
  prestige: { ja: "転生する（+{n} ✨）", en: "Ascend (+{n} ✨)" },
  prestigeTitle: { ja: "転生", en: "Ascension" },
  prestigeReady: { ja: "リセットして✨を獲得", en: "Reset & gain ✨" },
  prestigeLocked: {
    ja: "累計{n}調合で転生解放",
    en: "Unlocks at {n} total brewed",
  },
  prestigeConfirm: {
    ja: "進行をリセットして {n} エッセンスを獲得します。よろしいですか？",
    en: "Reset progress and gain {n} essence. Are you sure?",
  },
  clickUpgrade: { ja: "クリック強化", en: "Click Power" },
  clickUpgradeDesc: { ja: "1クリックの調合量 +{n}", en: "+{n} potion(s) per click" },
  buyQtyLabel: { ja: "購入数", en: "Buy" },
  buyQtyMax: { ja: "MAX", en: "MAX" },
  offlineCapButton: { ja: "放置上限拡張", en: "Extend Offline Cap" },
  offlineCapLabel: { ja: "放置上限 {h}時間", en: "Offline Cap {h}h" },
  offlineCapMaxed: { ja: "放置上限 {h}時間（最大）", en: "Offline Cap {h}h (MAX)" },
  soundOn: { ja: "🔊", en: "🔊" },
  soundOff: { ja: "🔇", en: "🔇" },
  achievementsButton: { ja: "実績", en: "Achievements" },
  achievementsTitle: { ja: "実績", en: "Achievements" },
  achievementUnlocked: { ja: "実績解除: {n}", en: "Achievement unlocked: {n}" },
  exportButton: { ja: "セーブ書き出し", en: "Export Save" },
  importButton: { ja: "セーブ読み込み", en: "Import Save" },
  exportDone: { ja: "セーブデータをコピーしました", en: "Save data copied" },
  importPrompt: { ja: "セーブデータ（JSON）を貼り付けてください", en: "Paste your save data (JSON)" },
  importFailed: { ja: "セーブデータの読み込みに失敗しました", en: "Failed to import save data" },
  importDone: { ja: "セーブデータを読み込みました", en: "Save data imported" },
  closeButton: { ja: "閉じる", en: "Close" },
  footerLifetimeBrewed: { ja: "累計醸造", en: "Lifetime Brewed" },
  footerPrestigeCount: { ja: "転生回数", en: "Ascensions" },
  footerPlaytime: { ja: "プレイ時間", en: "Playtime" },
} as const;

export type MessageKey = keyof typeof MESSAGES;

const GENERATOR_NAMES: Record<string, { ja: string; en: string }> = {
  apprentice: { ja: "見習い錬金術師", en: "Apprentice Alchemist" },
  cauldron: { ja: "自動大釜", en: "Auto Cauldron" },
  garden: { ja: "薬草園", en: "Herb Garden" },
  golem: { ja: "調合ゴーレム", en: "Brewing Golem" },
  portal: { ja: "異界ポータル", en: "Otherworld Portal" },
  observatory: { ja: "星読みの塔", en: "Stargazer Tower" },
  dragon: { ja: "契約の竜", en: "Bonded Dragon" },
  worldTree: { ja: "世界樹の雫", en: "World Tree Sap" },
};

const ACHIEVEMENT_INFO: Record<string, { ja: string; en: string }> = {
  first_click: { ja: "はじめての調合", en: "First Brew" },
  click_100: { ja: "100回クリック", en: "100 Clicks" },
  click_1000: { ja: "1000回クリック", en: "1000 Clicks" },
  brewed_1k: { ja: "累計1,000ポーション", en: "1,000 Potions Brewed" },
  brewed_1m: { ja: "累計100万ポーション", en: "1,000,000 Potions Brewed" },
  brewed_1b: { ja: "累計10億ポーション", en: "1,000,000,000 Potions Brewed" },
  first_prestige: { ja: "はじめての転生", en: "First Ascension" },
  prestige_5: { ja: "5回転生", en: "5 Ascensions" },
  essence_10: { ja: "エッセンス10個", en: "10 Essence" },
  all_generators: { ja: "全設備を1つ以上所持", en: "One of Every Generator" },
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

export function achievementName(lang: Lang, id: string): string {
  return ACHIEVEMENT_INFO[id]?.[lang] ?? id;
}

/** ブラウザの言語設定から初期言語を決める */
export function detectLang(navigatorLanguage: string): Lang {
  return navigatorLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function toggleLang(lang: Lang): Lang {
  return lang === "ja" ? "en" : "ja";
}
