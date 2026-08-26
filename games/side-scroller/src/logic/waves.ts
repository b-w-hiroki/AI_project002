/**
 * ウェーブ式サバイバルの難易度カーブ（Phaser 非依存の純粋関数）。
 * 固定ゴールへ向かうステージ制から、ウェーブを重ねるごとに敵が強くなっていく
 * 「どこまで生き残れるか」形式に変更したことに伴って新設した。
 */

/** 1ウェーブあたりの敵数の上限。無限に湧きすぎて処理落ちしないためのキャップ */
const MAX_ENEMIES_PER_WAVE = 10;

/** ウェーブ番号（1始まり）に応じた同時出現数 */
export function enemiesInWave(wave: number): number {
  return Math.min(3 + Math.floor((wave - 1) / 2), MAX_ENEMIES_PER_WAVE);
}

export interface EnemySpawnSpec {
  health: number;
  defense: number;
}

/** ウェーブ番号に応じた敵1体あたりの体力・防御力 */
export function enemySpecForWave(wave: number): EnemySpawnSpec {
  const health = 2 + Math.floor((wave - 1) / 3);
  const defense = wave >= 4 ? Math.min(Math.floor((wave - 4) / 3) + 1, 5) : 0;
  return { health, defense };
}

/** ウェーブクリア時に提示するピックアップの数。3ウェーブに1回は多めに出す */
export function pickupsForWave(wave: number): number {
  return wave % 3 === 0 ? 2 : 1;
}
