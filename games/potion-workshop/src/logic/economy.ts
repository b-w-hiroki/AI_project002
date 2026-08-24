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
  { id: "observatory", name: "星読みの塔", baseCost: 1_400_000, costGrowth: 1.12, baseRate: 4_400 },
  { id: "dragon", name: "契約の竜", baseCost: 20_000_000, costGrowth: 1.11, baseRate: 26_000 },
  { id: "worldTree", name: "世界樹の雫", baseCost: 330_000_000, costGrowth: 1.11, baseRate: 170_000 },
] as const;

export interface GameState {
  potions: number; // 通貨
  totalBrewed: number; // 今周回の累計（転生で獲得エッセンスの元）
  clickPower: number;
  counts: Record<string, number>; // generatorId -> 所持数
  essence: number; // 転生通貨（永続）
  prestigeCount: number;
  lifetimeBrewed: number; // 転生を跨いだ累計（実績用、リセットされない）
  totalClicks: number; // 転生を跨いだ累計クリック数
  unlockedAchievements: string[]; // 実績ID（転生を跨いで保持）
  offlineExtLevel: number; // オフライン上限の購入拡張レベル（永続）
  offlineCapBonuses: Record<string, number>; // オフライン上限への加算秒数。ソースID -> 秒数
}

export function newGame(): GameState {
  return {
    potions: 0,
    totalBrewed: 0,
    clickPower: 1,
    counts: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    essence: 0,
    prestigeCount: 0,
    lifetimeBrewed: 0,
    totalClicks: 0,
    unlockedAchievements: [],
    offlineExtLevel: 0,
    offlineCapBonuses: {},
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
    lifetimeBrewed: state.lifetimeBrewed,
    totalClicks: state.totalClicks,
    unlockedAchievements: state.unlockedAchievements,
    offlineExtLevel: state.offlineExtLevel,
    offlineCapBonuses: state.offlineCapBonuses,
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
    lifetimeBrewed: state.lifetimeBrewed + gained,
  };
}

/** クリック（手動調合、エッセンス倍率込み） */
export function click(state: GameState): GameState {
  const gain = state.clickPower * essenceMultiplier(state);
  return {
    ...state,
    potions: state.potions + gain,
    totalBrewed: state.totalBrewed + gain,
    lifetimeBrewed: state.lifetimeBrewed + gain,
    totalClicks: state.totalClicks + 1,
  };
}

// ---- クリック強化 ----

export const CLICK_UPGRADE_BASE_COST = 50;
export const CLICK_UPGRADE_GROWTH = 1.6;

/** 選択可能な一括購入数。Infinity は「最大まで購入」を表す */
export const CLICK_UPGRADE_QUANTITIES: readonly number[] = [1, 5, 10, 100, Infinity];

/** 次の1回ぶんのクリック強化のコスト（clickPower は 1 始まりなので level = clickPower - 1） */
export function clickUpgradeCost(state: GameState): number {
  const level = state.clickPower - 1;
  return Math.ceil(CLICK_UPGRADE_BASE_COST * Math.pow(CLICK_UPGRADE_GROWTH, level));
}

/** level 目から qty 回ぶんのクリック強化を買った場合の合計コスト */
export function clickUpgradeCostForQuantity(state: GameState, qty: number): number {
  const startLevel = state.clickPower - 1;
  let total = 0;
  for (let i = 0; i < qty; i++) {
    total += Math.ceil(CLICK_UPGRADE_BASE_COST * Math.pow(CLICK_UPGRADE_GROWTH, startLevel + i));
  }
  return total;
}

/** 所持ポーションで買えるクリック強化の最大回数（コストは指数増加するため実用上は数百回程度で頭打ちになる） */
export function maxAffordableClickUpgrades(state: GameState): number {
  const startLevel = state.clickPower - 1;
  let spent = 0;
  let count = 0;
  const SAFETY_CAP = 100_000;
  while (count < SAFETY_CAP) {
    const cost = Math.ceil(CLICK_UPGRADE_BASE_COST * Math.pow(CLICK_UPGRADE_GROWTH, startLevel + count));
    if (spent + cost > state.potions) break;
    spent += cost;
    count += 1;
  }
  return count;
}

/**
 * クリックパワーを一括で強化する。qty に Infinity を渡すと買えるだけ買う。
 * 1回も買えなければ null。qty より少ない回数しか買えない場合は買える分だけ購入する。
 */
export function buyClickUpgrades(state: GameState, qty: number): GameState | null {
  const affordable = maxAffordableClickUpgrades(state);
  const actualQty = Math.min(qty, affordable);
  if (actualQty <= 0) return null;
  const cost = clickUpgradeCostForQuantity(state, actualQty);
  return { ...state, potions: state.potions - cost, clickPower: state.clickPower + actualQty };
}

/** クリックパワーを+1する。買えなければ null（buyClickUpgrades(state, 1) の別名） */
export function buyClickUpgrade(state: GameState): GameState | null {
  return buyClickUpgrades(state, 1);
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

// ---- オフライン進行の上限 ----

/** 基本のオフライン進行上限（12時間） */
export const OFFLINE_CAP_BASE_SEC = 12 * 60 * 60;
/** どれだけ拡張しても超えない絶対上限（72時間） */
export const OFFLINE_CAP_MAX_SEC = 72 * 60 * 60;

/**
 * オフライン上限は「ベース + 複数ソースの加算ボーナス」で決まり、絶対上限でクランプされる。
 * ソースは sourceId をキーにした加算式なので、課金・強化・上限突破・バフ装備など
 * 性質の異なる拡張手段を後から自由に追加できる（お互いに干渉しない）。
 */
export function offlineCapSec(state: GameState): number {
  const bonus = Object.values(state.offlineCapBonuses).reduce((sum, v) => sum + v, 0);
  return Math.min(OFFLINE_CAP_MAX_SEC, OFFLINE_CAP_BASE_SEC + Math.max(0, bonus));
}

/** 特定ソースのオフライン上限ボーナスを絶対値で設定する（同じソースの再設定は上書き＝二重加算しない） */
export function setOfflineCapBonus(state: GameState, sourceId: string, bonusSec: number): GameState {
  return { ...state, offlineCapBonuses: { ...state.offlineCapBonuses, [sourceId]: bonusSec } };
}

/** 特定ソースのオフライン上限ボーナスに加算する（バフの重ね掛けなど、加算的なソース向け） */
export function addOfflineCapBonus(state: GameState, sourceId: string, deltaSec: number): GameState {
  const current = state.offlineCapBonuses[sourceId] ?? 0;
  return setOfflineCapBonus(state, sourceId, current + deltaSec);
}

// ---- オフライン上限拡張（購入型の具体的なソースの一実装） ----

export const OFFLINE_EXT_SOURCE_ID = "purchase";
export const OFFLINE_EXT_HOURS_PER_LEVEL = 6;
/** 10レベル(60h) + ベース12h = 72h で絶対上限に到達する */
export const OFFLINE_EXT_MAX_LEVEL = 10;
export const OFFLINE_EXT_BASE_COST = 3; // essence 建て
export const OFFLINE_EXT_GROWTH = 1.8;

/** 次のオフライン拡張レベルのコスト（essence）。上限到達済みなら null */
export function offlineExtensionCost(state: GameState): number | null {
  if (state.offlineExtLevel >= OFFLINE_EXT_MAX_LEVEL) return null;
  return Math.ceil(OFFLINE_EXT_BASE_COST * Math.pow(OFFLINE_EXT_GROWTH, state.offlineExtLevel));
}

/** オフライン上限をレベル1ぶん購入で拡張する（essence消費）。買えない/上限到達済みなら null */
export function buyOfflineExtension(state: GameState): GameState | null {
  const cost = offlineExtensionCost(state);
  if (cost === null || state.essence < cost) return null;
  const nextLevel = state.offlineExtLevel + 1;
  const next = { ...state, essence: state.essence - cost, offlineExtLevel: nextLevel };
  return setOfflineCapBonus(next, OFFLINE_EXT_SOURCE_ID, nextLevel * OFFLINE_EXT_HOURS_PER_LEVEL * 60 * 60);
}

/** 離席時間ぶんの進行を適用し、得た量も返す */
export function applyOfflineProgress(
  state: GameState,
  elapsedSec: number,
): { state: GameState; gained: number } {
  const cap = offlineCapSec(state);
  const dt = Math.min(Math.max(elapsedSec, 0), cap);
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
