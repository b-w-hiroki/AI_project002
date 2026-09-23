import { resolveJaEnLang } from "../../../shared/locale";
export type Lang = "ja" | "en";

export function detectLang(
  search = typeof window !== "undefined" ? window.location.search : "",
  browserLanguage = typeof navigator !== "undefined" ? navigator.language : "en",
  sdkLocale?: string,
): Lang {
  return resolveJaEnLang(search, browserLanguage, sdkLocale);
}

const STRINGS = {
  ja: {
    title: "カラーマッチ",
    rules:
      "60秒チャレンジで総合力を測定。\n20秒弱点練習では、過去成績から苦手な判定だけを集中出題。\n指示に合う色の枠までカードをドラッグしてください。\n\n制限時間内に判断できないと失敗になります。\n1秒以内の正解が5回続くとターボモード突入、\n獲得ポイントが加速します。",
    writing: "出題の表記",
    challenge: "60秒チャレンジ",
    practice: "20秒 弱点練習",
    retry: "もう一度あそぶ (R)",
    bestScore: "ベストスコア",
    bestTurbo: "ベストターボ",
    remaining: "残り",
    questions: "問",
    contentMeaning: "文字の意味",
    inkColor: "文字の色",
    practiceContentHint: "弱点練習：文字そのものの意味だけに集中",
    practiceColorHint: "弱点練習：文字の見た目の色だけに集中",
    switchSoon: "まもなく、次のカードから判定が切り替わります",
    switchGuide: "内容 → 色 → 切り替え。目の前の指示を見よう",
    dragContent: "文字の「内容」に合う枠へ\nドラッグ",
    dragColor: "文字の「色」に合う枠へ\nドラッグ",
    turbo: "ターボモード",
    practiceShortContent: "意味",
    practiceShortColor: "色",
    score: "スコア",
    accuracy: "正答率",
    avgReaction: "平均反応",
    turboBonus: "ターボボーナス",
    metricContent: "意味",
    metricColor: "色  ",
    metricSwitch: "切替",
    best60: "60秒ベスト",
  },
  en: {
    title: "Color Match",
    rules:
      "Test your overall skill in a 60-second challenge.\nWeakness Practice focuses on the judgment type you struggle with most.\nDrag each card to the color frame that matches the instruction.\n\nFailing to decide before time runs out counts as a miss.\nAnswer correctly within 1 second five times in a row to enter FLOW,\nwhere bonus points ramp up with your streak.",
    writing: "Word Style",
    challenge: "60-Second Challenge",
    practice: "20-Second Practice",
    retry: "Play Again (R)",
    bestScore: "Best Score",
    bestTurbo: "Best FLOW",
    remaining: "Time",
    questions: "Q",
    contentMeaning: "Word Meaning",
    inkColor: "Ink Color",
    practiceContentHint: "Practice: focus only on the word meaning",
    practiceColorHint: "Practice: focus only on the visible ink color",
    switchSoon: "The rule will switch on the next card",
    switchGuide: "Meaning → Color → Switch. Follow the current instruction.",
    dragContent: "Drag to the frame matching\nthe WORD",
    dragColor: "Drag to the frame matching\nthe INK COLOR",
    turbo: "FLOW",
    practiceShortContent: "Meaning",
    practiceShortColor: "Color",
    score: "Score",
    accuracy: "Accuracy",
    avgReaction: "Avg. Reaction",
    turboBonus: "FLOW Bonus",
    metricContent: "Word",
    metricColor: "Color",
    metricSwitch: "Switch",
    best60: "60s Best",
  },
} as const;

export type StringKey = keyof typeof STRINGS.ja;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key];
}

export function tr(lang: Lang, ja: string, en: string): string {
  return lang === "ja" ? ja : en;
}

export function writingModeLabel(lang: Lang, mode: "hiragana" | "katakana" | "kanji" | "english"): string {
  if (lang === "ja") {
    return {
      hiragana: "ひらがな",
      katakana: "カタカナ",
      kanji: "漢字",
      english: "English",
    }[mode];
  }
  return {
    hiragana: "Hiragana",
    katakana: "Katakana",
    kanji: "Kanji",
    english: "English",
  }[mode];
}
