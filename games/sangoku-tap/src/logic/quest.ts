/**
 * 三国ポチポチのクエスト（タップ進撃）ロジック（Phaser非依存の純粋関数）。
 * 企画書の「ボタンをタップすることで部隊を進行させ、発生するイベントを楽しむ」
 * ポチポチ系タップゲームのコアループを実装する。
 */

export type EventType = "encounter" | "treasure" | "battle";

export interface QuestEvent {
  type: EventType;
  message: string;
  reward: number;
  /** battleイベントのみ意味を持つ */
  won: boolean | null;
}

const ENCOUNTER_MESSAGES = [
  "旅の商人と出会った",
  "村人に道を尋ねられた",
  "腹ペコの猫を助けた",
  "先を行く武将と挨拶を交わした",
] as const;

const TREASURE_MESSAGES = ["宝箱を発見！", "落し物の財布を拾った", "隠し財宝を掘り当てた！"] as const;

const BATTLE_WIN_MESSAGES = ["野盗を撃退した！", "敵の斥候を蹴散らした！", "小競り合いに勝利した！"] as const;

const BATTLE_LOSE_MESSAGES = ["敵の待ち伏せに遭い撤退した…", "力及ばず退いた…"] as const;

function pick<T>(arr: readonly T[], rng: () => number): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

/** イベント種別を確率で決める（遭遇40% / 宝箱35% / 戦闘25%） */
export function rollEventType(rng: () => number = Math.random): EventType {
  const r = rng();
  if (r < 0.4) return "encounter";
  if (r < 0.75) return "treasure";
  return "battle";
}

/** 部隊レベルに応じた戦力 */
export function troopPower(level: number): number {
  return 10 + level * 6;
}

/** 進撃距離に応じた敵の強さ（進むほど強くなる） */
export function enemyPowerForDistance(distance: number): number {
  return 8 + distance * 0.9;
}

/** 距離に応じた基礎報酬（進むほど増える） */
function baseRewardForDistance(distance: number): number {
  return 5 + Math.floor(distance * 0.4);
}

/**
 * 1タップ分の進撃を解決する。rng差し替え可能（テストで決定的に検証するため）。
 */
export function resolveQuestTap(
  distance: number,
  troopLevel: number,
  rng: () => number = Math.random,
): QuestEvent {
  const type = rollEventType(rng);
  const baseReward = baseRewardForDistance(distance);

  if (type === "encounter") {
    return { type, message: pick(ENCOUNTER_MESSAGES, rng), reward: Math.round(baseReward * 0.5), won: null };
  }
  if (type === "treasure") {
    return { type, message: pick(TREASURE_MESSAGES, rng), reward: Math.round(baseReward * 1.5), won: null };
  }

  const power = troopPower(troopLevel);
  const enemyPower = enemyPowerForDistance(distance);
  const winProbability = Math.max(0.15, Math.min(0.9, power / enemyPower - 0.2));
  const won = rng() < winProbability;
  return {
    type,
    message: won ? pick(BATTLE_WIN_MESSAGES, rng) : pick(BATTLE_LOSE_MESSAGES, rng),
    reward: won ? Math.round(baseReward * 2) : 0,
    won,
  };
}
