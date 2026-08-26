/**
 * ウェーブ式サバイバルの難易度カーブ（Phaser 非依存の純粋関数）。
 * 固定ゴールへ向かうステージ制から、ウェーブを重ねるごとに敵が強くなっていく
 * 「どこまで生き残れるか」形式に変更したことに伴って新設した。
 * 単調な「体力/防御力が一定式で増えるだけ」から、数・ステータスに幅を持たせ、
 * 敵タイプ（敏捷型/タンク型）とボス/大量発生ウェーブを混ぜてバリエーションを出す。
 */

export type EnemyType = "normal" | "agile" | "tank";

export interface EnemySpawnSpec {
  type: EnemyType;
  health: number;
  defense: number;
  /** 徘徊速度の倍率。1が通常速度 */
  speedMul: number;
}

export type WaveKind = "normal" | "boss" | "swarm";

export interface WaveComposition {
  kind: WaveKind;
  enemies: EnemySpawnSpec[];
}

/** 1ウェーブあたりの敵数の上限。無限に湧きすぎて処理落ちしないためのキャップ */
const MAX_ENEMIES_PER_WAVE = 10;
const SWARM_MAX_ENEMIES = 14;

/** 何ウェーブごとにボス/大量発生を挟むか */
const BOSS_WAVE_INTERVAL = 5;
const SWARM_WAVE_INTERVAL = 7;

export const ENEMY_TYPE_MODIFIERS: Readonly<Record<EnemyType, { healthMul: number; defenseDelta: number; speedMul: number }>> = {
  normal: { healthMul: 1, defenseDelta: 0, speedMul: 1 },
  agile: { healthMul: 0.6, defenseDelta: 0, speedMul: 1.8 },
  tank: { healthMul: 1.8, defenseDelta: 1, speedMul: 0.6 },
};

export function isBossWave(wave: number): boolean {
  return wave % BOSS_WAVE_INTERVAL === 0;
}

/** ボスウェーブと重ならないよう、ボス判定を優先してから大量発生を判定する */
export function isSwarmWave(wave: number): boolean {
  return !isBossWave(wave) && wave % SWARM_WAVE_INTERVAL === 0;
}

function baseEnemyCount(wave: number): number {
  return Math.min(3 + Math.floor((wave - 1) / 2), MAX_ENEMIES_PER_WAVE);
}

function baseEnemyStats(wave: number): { health: number; defense: number } {
  const health = 2 + Math.floor((wave - 1) / 3);
  const defense = wave >= 4 ? Math.min(Math.floor((wave - 4) / 3) + 1, 5) : 0;
  return { health, defense };
}

/** ±range の範囲でランダムにブレさせる（最低1は保証する） */
function jitter(base: number, range: number, rng: () => number): number {
  if (range <= 0) return base;
  const delta = Math.floor(rng() * (range * 2 + 1)) - range;
  return Math.max(1, base + delta);
}

/**
 * 敵のタイプをウェーブ番号に応じた確率で抽選する。
 * 序盤（ウェーブ3未満）はまだ通常のみで、以降は通常を主体に敏捷型/タンク型を混ぜる。
 */
function rollEnemyType(wave: number, rng: () => number): EnemyType {
  if (wave < 3) return "normal";
  const r = rng();
  if (r < 0.55) return "normal";
  if (r < 0.8) return "agile";
  return "tank";
}

function specFor(type: EnemyType, base: { health: number; defense: number }, rng: () => number): EnemySpawnSpec {
  const mod = ENEMY_TYPE_MODIFIERS[type];
  const health = Math.max(1, Math.round(jitter(base.health, 1, rng) * mod.healthMul));
  const defense = Math.max(0, base.defense + mod.defenseDelta);
  return { type, health, defense, speedMul: mod.speedMul };
}

/**
 * ウェーブの編成をランダム生成する。同じウェーブ番号でも毎回数・タイプに幅が出る。
 * `rng` を差し替え可能にしているのはテストで決定的に検証するため（`rollStageBuffOptions` と同じ方針）。
 */
export function rollWaveComposition(wave: number, rng: () => number = Math.random): WaveComposition {
  const base = baseEnemyStats(wave);

  if (isBossWave(wave)) {
    const boss = specFor("tank", { health: base.health * 4, defense: base.defense + 2 }, rng);
    return { kind: "boss", enemies: [boss] };
  }

  const swarm = isSwarmWave(wave);
  const count = swarm
    ? Math.min(baseEnemyCount(wave) + 4, SWARM_MAX_ENEMIES)
    : jitter(baseEnemyCount(wave), 1, rng);

  const enemies: EnemySpawnSpec[] = [];
  for (let i = 0; i < count; i++) {
    const type = swarm ? "agile" : rollEnemyType(wave, rng);
    enemies.push(specFor(type, base, rng));
  }
  return { kind: swarm ? "swarm" : "normal", enemies };
}

/** ウェーブクリア時に提示するピックアップの数。3ウェーブに1回は多めに出す */
export function pickupsForWave(wave: number): number {
  return wave % 3 === 0 ? 2 : 1;
}
