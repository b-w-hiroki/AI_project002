/**
 * 覇拳伝の戦闘ロジック（Phaser非依存の純粋関数）。
 * 「拳/蹴/気の3ボタン+じゃんけん相性、当てて奥義ゲージを溜めて必殺技を放つ」という
 * 旧格闘ゲーム企画の核（コアアクション）を、ブラウザでの実装向けに単純化した。
 * プレイヤーとCPUが毎ビート同時に技を選び、相性で威力が変わる。
 */

export type MoveType = "punch" | "kick" | "ki";

export const MOVE_LABEL: Readonly<Record<MoveType, string>> = {
  punch: "拳",
  kick: "蹴",
  ki: "気",
};

/** 拳→気→蹴→拳 の順で、前者が後者に対して威力有利になる（旧企画の三すくみ図に準拠） */
const BEATS: Readonly<Record<MoveType, MoveType>> = {
  punch: "ki",
  ki: "kick",
  kick: "punch",
};

export type ClashResult = "advantage" | "disadvantage" | "clash";

/** プレイヤー視点での相性判定 */
export function resolveClash(player: MoveType, enemy: MoveType): ClashResult {
  if (player === enemy) return "clash";
  if (BEATS[player] === enemy) return "advantage";
  return "disadvantage";
}

const BASE_DAMAGE = 10;
const ADVANTAGE_MULTIPLIER = 1.6;
const DISADVANTAGE_MULTIPLIER = 0.5;
const CLASH_MULTIPLIER = 0.9;

/** 相性に応じたダメージ倍率 */
export function multiplierForClash(result: ClashResult): number {
  switch (result) {
    case "advantage":
      return ADVANTAGE_MULTIPLIER;
    case "disadvantage":
      return DISADVANTAGE_MULTIPLIER;
    case "clash":
      return CLASH_MULTIPLIER;
  }
}

/** ダメージに±2の幅を持たせる。rng差し替え可能（テストで決定的に検証するため） */
export function damageForClash(result: ClashResult, rng: () => number = Math.random): number {
  const jitter = Math.floor(rng() * 5) - 2;
  return Math.max(1, Math.round(BASE_DAMAGE * multiplierForClash(result)) + jitter);
}

export const OUGI_GAUGE_MAX = 100;
const GAUGE_GAIN_PER_HIT = 14;
const GAUGE_GAIN_ON_TAKEN = 6;

/** 与ダメージ・被ダメージそれぞれで奥義ゲージが増える量（上限でクランプ） */
export function nextGauge(current: number, dealt: boolean): number {
  const gain = dealt ? GAUGE_GAIN_PER_HIT : GAUGE_GAIN_ON_TAKEN;
  return Math.min(OUGI_GAUGE_MAX, current + gain);
}

const OUGI_DAMAGE_BASE = 32;

/** 奥義の固定ダメージ（多少の幅を持たせる） */
export function ougiDamage(rng: () => number = Math.random): number {
  const jitter = Math.floor(rng() * 7) - 3;
  return Math.max(1, OUGI_DAMAGE_BASE + jitter);
}

export interface BattleState {
  playerHp: number;
  enemyHp: number;
  playerGauge: number;
  enemyGauge: number;
}

export const MAX_HP = 100;

export function initialBattleState(): BattleState {
  return { playerHp: MAX_HP, enemyHp: MAX_HP, playerGauge: 0, enemyGauge: 0 };
}

export interface BeatResult {
  state: BattleState;
  clash: ClashResult;
  playerDamageDealt: number;
  enemyDamageDealt: number;
}

/** 1ビート分の通常攻撃応酬を解決する */
export function applyBeat(state: BattleState, playerMove: MoveType, enemyMove: MoveType, rng: () => number = Math.random): BeatResult {
  const clash = resolveClash(playerMove, enemyMove);
  const enemyClash: ClashResult = clash === "advantage" ? "disadvantage" : clash === "disadvantage" ? "advantage" : "clash";

  const playerDamageDealt = damageForClash(clash, rng);
  const enemyDamageDealt = damageForClash(enemyClash, rng);

  const enemyHp = Math.max(0, state.enemyHp - playerDamageDealt);
  const playerHp = Math.max(0, state.playerHp - enemyDamageDealt);

  const playerGauge = nextGauge(nextGauge(state.playerGauge, true), false);
  const enemyGauge = nextGauge(nextGauge(state.enemyGauge, true), false);

  return {
    state: { playerHp, enemyHp, playerGauge, enemyGauge },
    clash,
    playerDamageDealt,
    enemyDamageDealt,
  };
}

/** プレイヤーが奥義を放つ（ゲージが満タンでなければ何もしない） */
export function applyPlayerOugi(state: BattleState, rng: () => number = Math.random): BattleState {
  if (state.playerGauge < OUGI_GAUGE_MAX) return state;
  const damage = ougiDamage(rng);
  return {
    ...state,
    enemyHp: Math.max(0, state.enemyHp - damage),
    playerGauge: 0,
  };
}

const HIDDEN_COMMAND_DAMAGE_BASE = 20;

/** 隠しコマンド技のダメージ（多少の幅を持たせる） */
export function hiddenCommandDamage(rng: () => number = Math.random): number {
  const jitter = Math.floor(rng() * 5) - 2;
  return Math.max(1, HIDDEN_COMMAND_DAMAGE_BASE + jitter);
}

/** 隠しコマンド技（拳→拳→拳→気）を発動する。ゲージ消費なしの固定ダメージ攻撃 */
export function applyHiddenCommand(state: BattleState, rng: () => number = Math.random): BattleState {
  const damage = hiddenCommandDamage(rng);
  return { ...state, enemyHp: Math.max(0, state.enemyHp - damage) };
}

export type BattleOutcome = "playerWin" | "enemyWin" | "draw";

/** HPが尽きた、またはタイムアップ時の勝敗判定。バトル継続中はnull */
export function battleOutcome(state: BattleState, timeUp: boolean): BattleOutcome | null {
  if (state.playerHp <= 0 && state.enemyHp <= 0) return "draw";
  if (state.enemyHp <= 0) return "playerWin";
  if (state.playerHp <= 0) return "enemyWin";
  if (timeUp) {
    if (state.playerHp > state.enemyHp) return "playerWin";
    if (state.playerHp < state.enemyHp) return "enemyWin";
    return "draw";
  }
  return null;
}

export function pickCpuMove(rng: () => number = Math.random): MoveType {
  const moves: MoveType[] = ["punch", "kick", "ki"];
  const move = moves[Math.floor(rng() * moves.length)];
  if (move === undefined) throw new Error("pickCpuMove: empty move pool");
  return move;
}
