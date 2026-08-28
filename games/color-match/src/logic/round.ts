/**
 * カラーマッチのラウンド生成・採点ロジック（Phaser非依存の純粋関数）。
 * ストループ効果（文字の意味と文字色が矛盾する）を下敷きに、「内容」判定と「色」判定を
 * ラウンドごとに切り替えて出題する。選択肢は正解と同じ属性を持つカードを1枚だけ含み、
 * 他の選択肢はわざと逆の属性（意味は合うが色は違う、など）を混ぜて引っかけにする。
 */

export interface ColorDef {
  id: string;
  name: string;
  hex: number;
}

export const COLORS: readonly ColorDef[] = [
  { id: "red", name: "あか", hex: 0xe0447a },
  { id: "blue", name: "あお", hex: 0x2f8fd1 },
  { id: "green", name: "みどり", hex: 0x1f8a63 },
  { id: "yellow", name: "きいろ", hex: 0xd6a71a },
  { id: "purple", name: "むらさき", hex: 0x8a4fd1 },
  { id: "orange", name: "だいだい", hex: 0xd97a2b },
] as const;

export type JudgeMode = "content" | "color";

export interface CandidateCard {
  /** カードに書かれた文字の内容（色の名前） */
  word: string;
  /** カードに書かれた文字のインク色 */
  ink: string;
}

export interface Round {
  /** 出題プロンプトの文字内容 */
  promptWord: string;
  /** 出題プロンプトのインク色 */
  promptInk: string;
  judgeMode: JudgeMode;
  choices: CandidateCard[];
  correctIndex: number;
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

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp!;
  }
  return a;
}

/** レベルに応じた選択肢の枚数。序盤は少なく、進むほど選択肢が増えて難化する */
export function choiceCountForLevel(level: number): number {
  return Math.min(3 + Math.floor(level / 3), 6);
}

/**
 * ラウンドを生成する。`rng` を差し替え可能にしているのはテストで決定的に検証するため。
 * 選択肢の中で「正解の属性」を持つのは必ず1枚のみになるよう構築する。
 */
export function generateRound(level: number, rng: () => number = Math.random): Round {
  const promptWordColor = pick(COLORS, rng);
  const promptInkColor = pick(COLORS, rng);
  const judgeMode: JudgeMode = rng() < 0.5 ? "content" : "color";
  const target = judgeMode === "content" ? promptWordColor.id : promptInkColor.id;
  const count = choiceCountForLevel(level);

  const others = COLORS.filter((c) => c.id !== target);
  const distractorIds = shuffle(others, rng)
    .slice(0, count - 1)
    .map((c) => c.id);

  const choices: CandidateCard[] = [];
  // 正解カード: 判定対象の属性だけを正解色にし、もう片方の属性はわざと別色にして紛らわしくする
  const otherAttrForCorrect = pick(
    others,
    rng,
  ).id;
  if (judgeMode === "content") {
    choices.push({ word: target, ink: otherAttrForCorrect });
  } else {
    choices.push({ word: otherAttrForCorrect, ink: target });
  }

  for (const distractorId of distractorIds) {
    // ダミーは判定対象の属性が正解色と一致しないようにしつつ、逆属性を正解色にして引っかけを作る
    const decoyOtherAttr = rng() < 0.5 ? target : pick(others, rng).id;
    if (judgeMode === "content") {
      choices.push({ word: distractorId, ink: decoyOtherAttr });
    } else {
      choices.push({ word: decoyOtherAttr, ink: distractorId });
    }
  }

  const shuffledChoices = shuffle(
    choices.map((c, i) => ({ c, i })),
    rng,
  );
  const correctIndex = shuffledChoices.findIndex((entry) => entry.i === 0);

  return {
    promptWord: promptWordColor.id,
    promptInk: promptInkColor.id,
    judgeMode,
    choices: shuffledChoices.map((entry) => entry.c),
    correctIndex,
  };
}

export function hexForColorId(id: string): number {
  return colorById(id).hex;
}

export function nameForColorId(id: string): string {
  return colorById(id).name;
}

export interface RoundResult {
  correct: boolean;
  reactionMs: number;
}

/** 1ラウンド分の得点(0-100)。正解のみ加点し、速く正解するほど高くなる */
export function scoreRound(result: RoundResult): number {
  if (!result.correct) return 0;
  const speedBonus = Math.max(0, 100 - result.reactionMs / 20);
  return Math.round(40 + speedBonus * 0.6);
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
