/**
 * 放置ゲームの経済ロジック（Phaser 非依存の純粋関数）。
 * テーマ: ポーション工房 — クリックで調合、設備を買って自動生産。
 */

export interface GeneratorDef {
  id: string;
  name: string;
  baseCost: number;
  costGrowth: number; // 購入ごとのコスト倍率
  baseRate: number; // 1台あたりの毎秒生産量
}

export const GENERATORS: readonly GeneratorDef[] = [
  { id: "apprentice", name: "見習い錬金術師", baseCost: 15, costGrowth: 1.15, baseRate: 0.5 },
  { id: "cauldron", name: "自動大釜", baseCost: 100, costGrowth: 1.15, baseRate: 4 },
  { id: "garden", name: "薬草園", baseCost: 1_100, costGrowth: 1.14, baseRate: 25 },
  { id: "golem", name: "調合ゴーレム", baseCost: 12_000, costGrowth: 1.13, baseRate: 140 },
  { id: "portal", name: "異界ポータル", baseCost: 130_000, costGrowth: 1.12, baseRate: 800 },
] as const;

export interface GameState {
  potions: number; // 通貨
  totalBrewed: number; // 今周回の累計（転生で獲得エッセンスの元）
  clickPower: number;
  counts: Record<string, number>; // generatorId -> 所持数
  essence: number; // 転生通貨（永続）
  prestigeCount: number;
}

export function newGame(): GameState {
  return {
    potions: 0,
    totalBrewed: 0,
    clickPower: 1,
    counts: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    essence: 0,
    prestigeCount: 0,
  };
}

// ---- 転生（プレステージ） ----

/** 転生に必要な今周回の累計調合数 */
export const PRESTIGE_UNLOCK = 1_000_000;

/** エッセンス1個あたりの生産・クリック倍率ボーナス（+10%） */
export const ESSENCE_BONUS = 0.1;

/** 今転生したら得られるエッセンス数 */
export function essenceOnPrestige(state: GameState): number {
  if (state.totalBrewed < PRESTIGE_UNLOCK) return 0;
  return Math.floor(Math.sqrt(state.totalBrewed / PRESTIGE_UNLOCK));
}

/** エッセンスによる倍率（1 + 0.1 × essence） */
export function essenceMultiplier(state: GameState): number {
  return 1 + state.essence * ESSENCE_BONUS;
}

/** 転生: 進行をリセットしてエッセンスを獲得。不可なら null */
export function prestige(state: GameState): GameState | null {
  const gained = essenceOnPrestige(state);
  if (gained <= 0) return null;
  return {
    ...newGame(),
    essence: state.essence + gained,
    prestigeCount: state.prestigeCount + 1,
  };
}

/** n台目購入時のコスト（所持数 count のとき） */
export function generatorCost(def: GeneratorDef, count: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, count));
}

/** 毎秒の総生産量（エッセンス倍率込み） */
export function productionPerSec(state: GameState): number {
  const base = GENERATORS.reduce(
    (sum, g) => sum + g.baseRate * (state.counts[g.id] ?? 0),
    0,
  );
  return base * essenceMultiplier(state);
}

/** dt 秒ぶん時間を進める */
export function tick(state: GameState, dtSec: number): GameState {
  if (dtSec <= 0) return state;
  const gained = productionPerSec(state) * dtSec;
  return {
    ...state,
    potions: state.potions + gained,
    totalBrewed: state.totalBrewed + gained,
  };
}

/** クリック（手動調合、エッセンス倍率込み） */
export function click(state: GameState): GameState {
  const gain = state.clickPower * essenceMultiplier(state);
  return {
    ...state,
    potions: state.potions + gain,
    totalBrewed: state.totalBrewed + gain,
  };
}

/** 設備を1台購入。買えなければ null */
export function buyGenerator(state: GameState, id: string): GameState | null {
  const def = GENERATORS.find((g) => g.id === id);
  if (!def) return null;
  const count = state.counts[id] ?? 0;
  const cost = generatorCost(def, count);
  if (state.potions < cost) return null;
  return {
    ...state,
    potions: state.potions - cost,
    counts: { ...state.counts, [id]: count + 1 },
  };
}

/** オフライン進行の上限（8時間） */
export const OFFLINE_CAP_SEC = 8 * 60 * 60;

/** 離席時間ぶんの進行を適用し、得た量も返す */
export function applyOfflineProgress(
  state: GameState,
  elapsedSec: number,
): { state: GameState; gained: number } {
  const dt = Math.min(Math.max(elapsedSec, 0), OFFLINE_CAP_SEC);
  const gained = productionPerSec(state) * dt;
  return { state: tick(state, dt), gained };
}

/** 大きい数の表示（1.5K, 2.3M …） */
export function formatNumber(n: number): string {
  if (n < 1000) {
    return Number.isInteger(n) ? n.toString() : (Math.floor(n * 10) / 10).toString();
  }
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let value = n;
  let unit = "";
  for (const u of units) {
    value /= 1000;
    unit = u;
    if (value < 1000) break;
  }
  return `${value.toFixed(value < 100 ? 1 : 0)}${unit}`;
}
