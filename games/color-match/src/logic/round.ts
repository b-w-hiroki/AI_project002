/**
 * カラーマッチのラウンド生成・採点ロジック（Phaser非依存の純粋関数）。
 * 2011年に作られていた旧試作品（ドラッグ&ドロップでカードを色の枠に仕分ける、
 * カウントダウンタイマー付きのタイムアタック）をベースに、ストループ効果
 * （文字の意味と文字色が矛盾する）を使った「内容」判定・「色」判定の複合判定を
 * 組み合わせた。プロンプトカードの文字内容とインク色をラウンドごとに指示された
 * 属性で見分け、制限時間内に正しい色の枠へドラッグする。
 */

/** 出題文字の表記モード。ひらがな以外は読解負荷を上げるための難易度バリエーション */
export type WritingMode = "hiragana" | "katakana" | "kanji" | "english";

export const WRITING_MODES: readonly WritingMode[] = ["hiragana", "katakana", "kanji", "english"] as const;

export const WRITING_MODE_LABEL: Readonly<Record<WritingMode, string>> = {
  hiragana: "ひらがな",
  katakana: "カタカナ",
  kanji: "漢字",
  english: "English",
};

export interface ColorDef {
  id: string;
  names: Readonly<Record<WritingMode, string>>;
  hex: number;
}

export const COLORS: readonly ColorDef[] = [
  {
    id: "red",
    names: { hiragana: "あか", katakana: "アカ", kanji: "赤", english: "RED" },
    hex: 0xe0447a,
  },
  {
    id: "blue",
    names: { hiragana: "あお", katakana: "アオ", kanji: "青", english: "BLUE" },
    hex: 0x2f8fd1,
  },
  {
    id: "green",
    names: { hiragana: "みどり", katakana: "ミドリ", kanji: "緑", english: "GREEN" },
    hex: 0x1f8a63,
  },
  {
    id: "yellow",
    names: { hiragana: "きいろ", katakana: "キイロ", kanji: "黄", english: "YELLOW" },
    hex: 0xd6a71a,
  },
  {
    id: "purple",
    names: { hiragana: "むらさき", katakana: "ムラサキ", kanji: "紫", english: "PURPLE" },
    hex: 0x8a4fd1,
  },
  {
    id: "orange",
    names: { hiragana: "だいだい", katakana: "ダイダイ", kanji: "橙", english: "ORANGE" },
    hex: 0xd97a2b,
  },
] as const;

export type JudgeMode = "content" | "color";

export interface Round {
  /** 出題プロンプトの文字内容 */
  promptWord: string;
  /** 出題プロンプトのインク色 */
  promptInk: string;
  judgeMode: JudgeMode;
  /** 正解の枠（COLORSのid） */
  correctColorId: string;
}

function colorById(id: string): ColorDef {
  const c = COLORS.find((c) => c.id === id);
  if (!c) throw new Error(`unknown color id: ${id}`);
  return c;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

/**
 * ラウンドを生成する。`rng` を差し替え可能にしているのはテストで決定的に検証するため。
 * 内容とインク色が同じ（矛盾しない）ラウンドも一定確率で混ぜ、
 * 「常に矛盾する」ことを学習して即答されるのを防ぐ。
 */
export function generateRound(rng: () => number = Math.random): Round {
  const promptWordColor = pick(COLORS, rng);
  const promptInkColor = rng() < 0.25 ? promptWordColor : pick(COLORS, rng);
  const judgeMode: JudgeMode = rng() < 0.5 ? "content" : "color";
  const correctColorId = judgeMode === "content" ? promptWordColor.id : promptInkColor.id;

  return {
    promptWord: promptWordColor.id,
    promptInk: promptInkColor.id,
    judgeMode,
    correctColorId,
  };
}

const BASE_TIME_LIMIT_MS = 4200;
const MIN_TIME_LIMIT_MS = 1800;
const TIME_LIMIT_STEP_MS = 150;

/** レベルが上がるほど制限時間が短くなる（タイムアタック的な難化） */
export function timeLimitMsForLevel(level: number): number {
  return Math.max(MIN_TIME_LIMIT_MS, BASE_TIME_LIMIT_MS - level * TIME_LIMIT_STEP_MS);
}

export function hexForColorId(id: string): number {
  return colorById(id).hex;
}

export function nameForColorId(id: string, mode: WritingMode = "hiragana"): string {
  return colorById(id).names[mode];
}

export interface RoundResult {
  correct: boolean;
  /** タイムアウトで未回答のまま終わったラウンド */
  timedOut: boolean;
  reactionMs: number;
}

/** 1ラウンド分の得点(0-100)。正解のみ加点し、速く正解するほど高くなる */
export function scoreRound(result: RoundResult): number {
  if (!result.correct) return 0;
  const speedBonus = Math.max(0, 100 - result.reactionMs / 20);
  return Math.round(40 + speedBonus * 0.6);
}

/** この時間内に正解し続けると「ターボモード」の連続判定として数える */
export const TURBO_FAST_MS = 1000;
/** 連続数がこの値に達すると画面上でターボモードに突入したと表示する */
export const TURBO_ENTRY_STREAK = 5;

/**
 * 連続ターボ正解数に応じた1回あたりの獲得ポイント。
 * ユーザー指定の段階表: 1〜5回=1pt、6〜10回=2pt、11〜20回=3pt、21〜50回=4pt、51回〜=5pt。
 */
export function pointsForStreak(streak: number): number {
  if (streak <= 5) return 1;
  if (streak <= 10) return 2;
  if (streak <= 20) return 3;
  if (streak <= 50) return 4;
  return 5;
}

export interface SessionSummary {
  accuracy: number;
  avgReactionMs: number;
  score: number;
}

/** セッション全体の総合評価。正答率(60%)と平均反応速度(40%)を組み合わせて100点満点にする */
export function summarizeSession(results: RoundResult[]): SessionSummary {
  if (results.length === 0) {
    return { accuracy: 0, avgReactionMs: 0, score: 0 };
  }
  const correctResults = results.filter((r) => r.correct);
  const accuracy = correctResults.length / results.length;
  const avgReactionMs =
    correctResults.length > 0
      ? correctResults.reduce((sum, r) => sum + r.reactionMs, 0) / correctResults.length
      : 0;
  const speedScore = correctResults.length > 0 ? Math.max(0, 100 - avgReactionMs / 20) : 0;
  const score = Math.round(accuracy * 100 * 0.6 + speedScore * 0.4);
  return { accuracy, avgReactionMs, score };
}
