/**
 * アウトゲーム（ステージ外）の武器育成・ロードアウトのロジック（Phaser 非依存の純粋関数）。
 *
 * 階層: WeaponTemplate（武器の原型） → WeaponInstance（プレイヤーが所持する個体）。
 * 個体はレア度に応じたステータス配分でロールされ、強化/進化/熟練度の3軸で独立に成長する。
 * プレイヤーは近距離/中距離/遠距離の各スロットに個体を1本ずつ設定（ロードアウト）しておき、
 * ステージ側ではその設定に基づいて「召喚」できる武器が決まる（召喚の実行はステージ側ロジックの責務）。
 *
 * ステージ開始時は基本装備（baseEquipmentStats）からスタートし、召喚媒体を拾ったタイミングで
 * ロードアウト済みの WeaponInstance（toWeaponDef を通じて combat.ts の WeaponDef 形式に変換）へ
 * 切り替える。実際の切り替え適用は combat.ts の setCustomWeapon を GameScene 側から呼ぶ。
 */

import type { WeaponDef, WeaponKind } from "./combat";

// ---- レア度 ----

export type RarityTier = "N" | "R" | "SR" | "SSR" | "UR";

export interface RarityDef {
  tier: RarityTier;
  label: string;
  /** ステータス品質（0..1）のロール範囲。個体のステータス配分はこの範囲内でロールされる */
  qualityMin: number;
  qualityMax: number;
  /** アルティメット化が可能か（SR以上） */
  canUltimate: boolean;
}

export const RARITY_ORDER: readonly RarityTier[] = ["N", "R", "SR", "SSR", "UR"];

export const RARITIES: Readonly<Record<RarityTier, RarityDef>> = {
  N: { tier: "N", label: "ノーマル", qualityMin: 0, qualityMax: 0.2, canUltimate: false },
  R: { tier: "R", label: "レア", qualityMin: 0.2, qualityMax: 0.45, canUltimate: false },
  SR: { tier: "SR", label: "スーパーレア", qualityMin: 0.45, qualityMax: 0.7, canUltimate: true },
  SSR: {
    tier: "SSR",
    label: "スーパースペシャルレア",
    qualityMin: 0.7,
    qualityMax: 0.9,
    canUltimate: true,
  },
  UR: { tier: "UR", label: "ウルトラレア", qualityMin: 0.9, qualityMax: 1, canUltimate: true },
};

// ---- 武器の原型（テンプレート） ----

/** 品質(0..1)を実際の値域へ写す。higherIsBetter=false の項目は品質が高いほど値が小さくなる（速い/軽い） */
interface StatRange {
  min: number;
  max: number;
  higherIsBetter: boolean;
}

export interface BaseWeaponStats {
  range: number; // 距離
  power: number; // パワー
  swingSpeedMs: number; // 速さ（モーション所要時間。小さいほど速い）
  hitWidth: number; // 範囲（一振りで巻き込める幅）
  weight: number; // 重さ（移動速度に影響。大きいほど重い）
  comboHits: number; // 連続攻撃回数
}

const STAT_RANGES: Readonly<Record<keyof BaseWeaponStats, StatRange>> = {
  range: { min: 40, max: 260, higherIsBetter: true },
  power: { min: 1, max: 6, higherIsBetter: true },
  swingSpeedMs: { min: 180, max: 500, higherIsBetter: false },
  hitWidth: { min: 8, max: 70, higherIsBetter: true },
  weight: { min: 1, max: 10, higherIsBetter: false },
  comboHits: { min: 1, max: 5, higherIsBetter: true },
};

/** テンプレートごとの各ステータスへの重み付け（1.0が基準、大きいほどそのステータスに寄る） */
export type StatBias = Readonly<Record<keyof BaseWeaponStats, number>>;

export interface WeaponTemplate {
  id: string;
  name: string;
  kind: WeaponKind;
  bias: StatBias;
}

export const WEAPON_TEMPLATES: readonly WeaponTemplate[] = [
  {
    id: "iron_sword",
    name: "鉄の剣",
    kind: "melee",
    bias: { range: 0.9, power: 1.0, swingSpeedMs: 1.1, hitWidth: 1.0, weight: 1.0, comboHits: 1.1 },
  },
  {
    id: "greatsword",
    name: "大剣",
    kind: "melee",
    bias: { range: 0.8, power: 1.3, swingSpeedMs: 0.7, hitWidth: 1.3, weight: 1.4, comboHits: 0.8 },
  },
  {
    id: "war_spear",
    name: "戦槍",
    kind: "mid",
    bias: { range: 1.3, power: 1.0, swingSpeedMs: 0.9, hitWidth: 0.8, weight: 1.1, comboHits: 0.9 },
  },
  {
    id: "naginata",
    name: "薙刀",
    kind: "mid",
    bias: { range: 1.1, power: 1.0, swingSpeedMs: 1.0, hitWidth: 1.2, weight: 1.0, comboHits: 1.0 },
  },
  {
    id: "short_bow",
    name: "短弓",
    kind: "ranged",
    bias: { range: 1.1, power: 0.9, swingSpeedMs: 1.2, hitWidth: 0.7, weight: 0.7, comboHits: 1.0 },
  },
  {
    id: "heavy_crossbow",
    name: "重弩",
    kind: "ranged",
    bias: { range: 1.3, power: 1.3, swingSpeedMs: 0.6, hitWidth: 0.6, weight: 1.3, comboHits: 0.7 },
  },
];

export function findTemplate(templateId: string): WeaponTemplate | undefined {
  return WEAPON_TEMPLATES.find((t) => t.id === templateId);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function lerpStat(range: StatRange, quality01: number): number {
  const q = clamp01(quality01);
  const t = range.higherIsBetter ? q : 1 - q;
  return range.min + (range.max - range.min) * t;
}

// ---- 武器の個体（インスタンス） ----

export const MAX_ENHANCE_LEVEL = 5;
export const MAX_EVOLUTION_STAGE = 2;
const QUALITY_PER_ENHANCE = 0.03;
const QUALITY_PER_EVOLUTION = 0.08;
const PROFICIENCY_HITS_PER_COMBO_BONUS = 500;
const MAX_PROFICIENCY_COMBO_BONUS = 3;
const MAX_COMBO_HITS = 8;

export interface WeaponInstance {
  id: string;
  templateId: string;
  rarity: RarityTier;
  /** ロール時の基礎品質（0..1）。強化/進化とは別に個体差として保持 */
  baseQuality: number;
  enhanceLevel: number; // 0..MAX_ENHANCE_LEVEL
  evolutionStage: number; // 0..MAX_EVOLUTION_STAGE
  proficiencyHits: number; // 命中数の累計（熟練度の元）
}

let instanceSeq = 0;
function nextInstanceId(): string {
  instanceSeq += 1;
  return `wpn_${instanceSeq}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * テンプレート＋レア度から新規個体をロールする。
 * rng は 0..1 の一様乱数を返す関数（テストでは決定的な値を注入できる）。
 */
export function rollWeaponInstance(
  templateId: string,
  rarity: RarityTier,
  rng: () => number = Math.random,
): WeaponInstance {
  const def = RARITIES[rarity];
  const baseQuality = def.qualityMin + rng() * (def.qualityMax - def.qualityMin);
  return {
    id: nextInstanceId(),
    templateId,
    rarity,
    baseQuality,
    enhanceLevel: 0,
    evolutionStage: 0,
    proficiencyHits: 0,
  };
}

/** 強化。最大レベルなら変化なし（進化してから強化すること） */
export function enhanceWeapon(instance: WeaponInstance): WeaponInstance {
  if (instance.enhanceLevel >= MAX_ENHANCE_LEVEL) return instance;
  return { ...instance, enhanceLevel: instance.enhanceLevel + 1 };
}

/** 進化。強化が最大レベルに達していない、または進化上限に達していれば変化なし */
export function evolveWeapon(instance: WeaponInstance): WeaponInstance {
  if (instance.enhanceLevel < MAX_ENHANCE_LEVEL) return instance;
  if (instance.evolutionStage >= MAX_EVOLUTION_STAGE) return instance;
  return { ...instance, evolutionStage: instance.evolutionStage + 1, enhanceLevel: 0 };
}

/** 熟練度の蓄積（命中のたびに呼ぶ想定） */
export function gainProficiency(instance: WeaponInstance, hits = 1): WeaponInstance {
  return { ...instance, proficiencyHits: instance.proficiencyHits + hits };
}

/** 熟練度によるコンボ数ボーナス（上限あり） */
export function proficiencyComboBonus(instance: WeaponInstance): number {
  return Math.min(
    MAX_PROFICIENCY_COMBO_BONUS,
    Math.floor(instance.proficiencyHits / PROFICIENCY_HITS_PER_COMBO_BONUS),
  );
}

/**
 * 個体の実効ステータスを計算する。
 * 品質 = baseQuality + 進化ボーナス（強化はパワー/速さにのみ乗算で作用させ、
 * 品質そのものは動かさない — 強化しすぎて全ステータスが伸びて簡単になりすぎるのを避けるため）。
 */
export function effectiveStats(instance: WeaponInstance): BaseWeaponStats {
  const template = findTemplate(instance.templateId);
  if (!template) throw new Error(`unknown weapon template: ${instance.templateId}`);

  const quality = clamp01(instance.baseQuality + instance.evolutionStage * QUALITY_PER_EVOLUTION);

  const rolled = Object.fromEntries(
    (Object.keys(STAT_RANGES) as (keyof BaseWeaponStats)[]).map((key) => {
      const biased = clamp01(quality * template.bias[key]);
      return [key, lerpStat(STAT_RANGES[key], biased)];
    }),
  ) as unknown as BaseWeaponStats;

  const enhanceFactor = instance.enhanceLevel * QUALITY_PER_ENHANCE;
  const power = rolled.power * (1 + enhanceFactor);
  const swingSpeedMs = rolled.swingSpeedMs * (1 - enhanceFactor);
  const comboHits = Math.min(
    MAX_COMBO_HITS,
    Math.round(rolled.comboHits) +
      Math.floor(instance.enhanceLevel / 2) +
      proficiencyComboBonus(instance),
  );

  return { ...rolled, power, swingSpeedMs, comboHits };
}

// ---- 入手経路 ----

export interface ChestRarityWeights {
  weights: Readonly<Record<RarityTier, number>>;
}

export const DEFAULT_CHEST_WEIGHTS: ChestRarityWeights = {
  weights: { N: 50, R: 30, SR: 14, SSR: 5, UR: 1 },
};

function pickWeightedRarity(weights: Readonly<Record<RarityTier, number>>, rng: () => number): RarityTier {
  const total = RARITY_ORDER.reduce((sum, tier) => sum + weights[tier], 0);
  let roll = rng() * total;
  for (const tier of RARITY_ORDER) {
    roll -= weights[tier];
    if (roll <= 0) return tier;
  }
  return RARITY_ORDER[RARITY_ORDER.length - 1]!;
}

/** 宝箱を開ける。テンプレートとレア度を確率で抽選し、新規個体を1本生成する */
export function openChest(
  templates: readonly WeaponTemplate[] = WEAPON_TEMPLATES,
  chestWeights: ChestRarityWeights = DEFAULT_CHEST_WEIGHTS,
  rng: () => number = Math.random,
): WeaponInstance {
  const index = Math.floor(rng() * templates.length) % templates.length;
  const template = templates[index] ?? templates[0]!;
  const rarity = pickWeightedRarity(chestWeights.weights, rng);
  return rollWeaponInstance(template.id, rarity, rng);
}

export const BLACKSMITH_COST: Readonly<Record<RarityTier, number>> = {
  N: 50,
  R: 150,
  SR: 400,
  SSR: 1000,
  UR: 2500,
};

/**
 * 鍛治でテンプレート＋目標レア度を指定して確定入手する。
 * 通貨が足りなければ null。ロール幅は宝箱よりやや狭め（品質帯の中央寄り）にする。
 */
export function craftAtBlacksmith(
  templateId: string,
  rarity: RarityTier,
  currency: number,
  rng: () => number = Math.random,
): { instance: WeaponInstance; cost: number } | null {
  const cost = BLACKSMITH_COST[rarity];
  if (currency < cost) return null;
  const def = RARITIES[rarity];
  const mid = (def.qualityMin + def.qualityMax) / 2;
  const narrowSpan = (def.qualityMax - def.qualityMin) * 0.3;
  const narrowRng = () => 0.5 + (rng() - 0.5) * (narrowSpan / (def.qualityMax - def.qualityMin) || 1);
  const quality = mid + (narrowRng() - 0.5) * narrowSpan;
  const instance: WeaponInstance = {
    id: nextInstanceId(),
    templateId,
    rarity,
    baseQuality: clamp01(quality),
    enhanceLevel: 0,
    evolutionStage: 0,
    proficiencyHits: 0,
  };
  return { instance, cost };
}

// ---- ロードアウト（アウトゲームでのスロット設定） ----

export type Loadout = Record<WeaponKind, string | null>;

export function newLoadout(): Loadout {
  return { melee: null, mid: null, ranged: null };
}

/** 個体をスロットに設定する。inventory に存在しない instanceId なら変化なし */
export function assignLoadoutSlot(
  loadout: Loadout,
  inventory: readonly WeaponInstance[],
  kind: WeaponKind,
  instanceId: string | null,
): Loadout {
  if (instanceId === null) return { ...loadout, [kind]: null };
  const instance = inventory.find((w) => w.id === instanceId);
  if (!instance) return loadout;
  const template = findTemplate(instance.templateId);
  if (!template || template.kind !== kind) return loadout;
  return { ...loadout, [kind]: instanceId };
}

// ---- 基本装備（ステージ開始時の固定装備、強化可能だが上限は低い） ----

export const BASE_EQUIPMENT_MAX_LEVEL = 5;
const BASE_EQUIPMENT_LEVEL_BONUS = 0.02; // 1レベルごとの品質相当の伸び（ロードアウト武器より小さい）

/**
 * 基本装備の実効ステータス。ロードアウトの WeaponInstance とは独立した固定品質（品質0.15 = N下位相当）
 * から始まり、レベルアップで少しずつ伸びるが、ロードアウト武器には遠く及ばない上限に抑える。
 */
export function baseEquipmentStats(kind: WeaponKind, level: number): BaseWeaponStats {
  const template = WEAPON_TEMPLATES.find((t) => t.kind === kind);
  if (!template) throw new Error(`no template for kind: ${kind}`);
  const clampedLevel = Math.max(0, Math.min(BASE_EQUIPMENT_MAX_LEVEL, level));
  const quality = clamp01(0.15 + clampedLevel * BASE_EQUIPMENT_LEVEL_BONUS);
  return Object.fromEntries(
    (Object.keys(STAT_RANGES) as (keyof BaseWeaponStats)[]).map((key) => {
      const biased = clamp01(quality * template.bias[key]);
      return [key, lerpStat(STAT_RANGES[key], biased)];
    }),
  ) as unknown as BaseWeaponStats;
}

// ---- インゲーム内の重複強化（ヴァンサバ/ダダサバ形式、ロードアウト武器の召喚後にのみ適用） ----

/** 0=入手のみ, 1..2=強化1〜2回目, 3=アルティメット化（SR以上のみ到達可） */
export type RunEnhanceStage = 0 | 1 | 2 | 3;
export const RUN_ENHANCE_MAX_STAGE: RunEnhanceStage = 3;

export interface RunWeaponState {
  instanceId: string;
  stage: RunEnhanceStage;
}

export function summonRunWeapon(instanceId: string): RunWeaponState {
  return { instanceId, stage: 0 };
}

/**
 * 同じ武器の召喚媒体を再度拾った時の重複強化。
 * アルティメット化（stage 3）は対象個体のレア度が SR 以上でなければ発生しない。
 */
export function stackRunWeapon(state: RunWeaponState, rarity: RarityTier): RunWeaponState {
  if (state.stage >= RUN_ENHANCE_MAX_STAGE) return state;
  const nextStage = (state.stage + 1) as RunEnhanceStage;
  if (nextStage === RUN_ENHANCE_MAX_STAGE && !RARITIES[rarity].canUltimate) return state;
  return { ...state, stage: nextStage };
}

const RUN_STAGE_POWER_MULTIPLIER: Readonly<Record<RunEnhanceStage, number>> = {
  0: 1,
  1: 1.15,
  2: 1.3,
  3: 1.6,
};
const RUN_STAGE_SPEED_MULTIPLIER: Readonly<Record<RunEnhanceStage, number>> = {
  0: 1,
  1: 0.92,
  2: 0.85,
  3: 0.7,
};
const RUN_STAGE_COMBO_BONUS: Readonly<Record<RunEnhanceStage, number>> = {
  0: 0,
  1: 0,
  2: 1,
  3: 2,
};

/** インゲーム内重複強化を織り込んだ、召喚中の実効ステータス */
export function runEffectiveStats(baseStats: BaseWeaponStats, runState: RunWeaponState): BaseWeaponStats {
  return {
    ...baseStats,
    power: baseStats.power * RUN_STAGE_POWER_MULTIPLIER[runState.stage],
    swingSpeedMs: baseStats.swingSpeedMs * RUN_STAGE_SPEED_MULTIPLIER[runState.stage],
    comboHits: Math.min(MAX_COMBO_HITS, baseStats.comboHits + RUN_STAGE_COMBO_BONUS[runState.stage]),
  };
}

/** BaseWeaponStats を combat.ts の WeaponDef 形式に変換する（GameScene への適用に使う） */
export function toWeaponDef(stats: BaseWeaponStats, kind: WeaponKind): WeaponDef {
  return {
    kind,
    range: stats.range,
    damage: stats.power,
    cooldownMs: stats.swingSpeedMs,
    attackWindowMs: Math.max(60, Math.round(stats.swingSpeedMs * 0.4)),
    projectile: kind === "ranged",
  };
}

export interface SummonResult {
  stats: BaseWeaponStats;
  runState: RunWeaponState;
  instance: WeaponInstance;
}

/**
 * 召喚媒体でスロット kind を呼び出す。
 * 同じ個体を既に召喚済み（existingRun.instanceId が一致）なら、インゲーム内重複強化として扱う。
 * ロードアウトが未設定、または所持していない個体なら null。
 */
export function resolveSummon(
  loadout: Loadout,
  inventory: readonly WeaponInstance[],
  kind: WeaponKind,
  existingRun: RunWeaponState | undefined,
): SummonResult | null {
  const instanceId = loadout[kind];
  if (!instanceId) return null;
  const instance = inventory.find((w) => w.id === instanceId);
  if (!instance) return null;
  const runState =
    existingRun && existingRun.instanceId === instance.id
      ? stackRunWeapon(existingRun, instance.rarity)
      : summonRunWeapon(instance.id);
  const stats = runEffectiveStats(effectiveStats(instance), runState);
  return { stats, runState, instance };
}

// ---- 消耗品（防具/アイテム） ----

export interface ArmorState {
  id: string;
  name: string;
  durability: number; // 被弾ごとに減る。0で消滅
  maxDurability: number;
}

/** 被弾時に耐久を1減らす。0になった防具は呼び出し側で除外する */
export function damageArmor(armor: ArmorState, amount = 1): ArmorState {
  return { ...armor, durability: Math.max(0, armor.durability - amount) };
}

export function isArmorBroken(armor: ArmorState): boolean {
  return armor.durability <= 0;
}

export interface ItemDef {
  id: string;
  name: string;
}

/** アイテムは使用したら1回で消滅するため、状態としては所持数のみ持てば十分 */
export type ItemInventory = Record<string, number>;

export function useItem(inventory: ItemInventory, itemId: string): ItemInventory | null {
  const count = inventory[itemId] ?? 0;
  if (count <= 0) return null;
  return { ...inventory, [itemId]: count - 1 };
}

// ---- 永続データ（アウトゲームのセーブ） ----

/** localStorage 互換のインターフェース（テストではメモリ実装を注入） */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LOADOUT_SAVE_KEY = "ai_project002_sideScroller_loadout_v1";

export interface LoadoutSaveData {
  inventory: WeaponInstance[];
  loadout: Loadout;
  baseEquipmentLevels: Record<WeaponKind, number>;
  currency: number;
}

export function newLoadoutSave(): LoadoutSaveData {
  return {
    inventory: [],
    loadout: newLoadout(),
    baseEquipmentLevels: { melee: 0, mid: 0, ranged: 0 },
    currency: 0,
  };
}

export function saveLoadout(data: LoadoutSaveData, store: KVStore): void {
  store.setItem(LOADOUT_SAVE_KEY, JSON.stringify(data));
}

export function loadLoadout(store: KVStore): LoadoutSaveData {
  const raw = store.getItem(LOADOUT_SAVE_KEY);
  if (!raw) return newLoadoutSave();
  try {
    const parsed = JSON.parse(raw) as Partial<LoadoutSaveData>;
    return { ...newLoadoutSave(), ...parsed };
  } catch {
    return newLoadoutSave();
  }
}
