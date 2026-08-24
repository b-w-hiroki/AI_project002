/**
 * 戦闘・レベル進行のロジック（Phaser 非依存の純粋関数）。
 * Phaser 側は物理演算・当たり判定の「発生」だけを担当し、
 * ダメージ計算やゲーム状態の更新はすべてここに集約する。
 */

export const PLAYER_MAX_HEALTH = 3;
export const PLAYER_INVULNERABLE_MS = 1000; // 被弾後の無敵時間
export const ATTACK_COOLDOWN_MS = 350;
export const ATTACK_RANGE = 60; // プレイヤー中心から前方への攻撃判定距離
export const ATTACK_RANGE_BEHIND = 12; // 密着時に敵が僅かに背後判定になっても取りこぼさないための許容量
export const ENEMY_TOUCH_DAMAGE = 1;
export const SCORE_PER_KILL = 100;

export type Facing = 1 | -1;

export interface PlayerState {
  health: number;
  maxHealth: number;
  facing: Facing;
  invulnerableUntil: number; // epoch ms 相当（テストでは任意の単調増加値でよい）
  attackingUntil: number; // この時刻まで攻撃判定が有効
  lastAttackAt: number; // 直近の攻撃発動時刻（クールダウン計算用）
  score: number;
}

export function newPlayer(): PlayerState {
  return {
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    facing: 1,
    invulnerableUntil: 0,
    attackingUntil: 0,
    lastAttackAt: -Infinity,
    score: 0,
  };
}

export function isAlive(player: PlayerState): boolean {
  return player.health > 0;
}

export function isInvulnerable(player: PlayerState, now: number): boolean {
  return now < player.invulnerableUntil;
}

export function canAttack(player: PlayerState, now: number): boolean {
  return now - player.lastAttackAt >= ATTACK_COOLDOWN_MS;
}

/** 攻撃を発動（クールダウン中なら null） */
export function startAttack(player: PlayerState, now: number): PlayerState | null {
  if (!canAttack(player, now)) return null;
  return {
    ...player,
    lastAttackAt: now,
    attackingUntil: now + 150, // 攻撃判定の有効時間
  };
}

export function isAttacking(player: PlayerState, now: number): boolean {
  return now < player.attackingUntil;
}

/** プレイヤーが被弾。無敵時間中なら変化なし */
export function damagePlayer(player: PlayerState, amount: number, now: number): PlayerState {
  if (!isAlive(player) || isInvulnerable(player, now)) return player;
  return {
    ...player,
    health: Math.max(0, player.health - amount),
    invulnerableUntil: now + PLAYER_INVULNERABLE_MS,
  };
}

export function addScore(player: PlayerState, amount: number): PlayerState {
  return { ...player, score: player.score + amount };
}

// ---- 敵 ----

export interface EnemyState {
  id: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  hitAt: number; // 直近に攻撃を受けた時刻（多段ヒット防止用）
}

export function newEnemy(id: string, health = 2): EnemyState {
  return { id, health, maxHealth: health, alive: true, hitAt: -Infinity };
}

const HIT_DEBOUNCE_MS = 200;

/** 敵が攻撃判定内にいる時にダメージを与える。連続ヒット防止のデバウンス付き */
export function damageEnemy(enemy: EnemyState, amount: number, now: number): EnemyState {
  if (!enemy.alive) return enemy;
  if (now - enemy.hitAt < HIT_DEBOUNCE_MS) return enemy;
  const health = Math.max(0, enemy.health - amount);
  return { ...enemy, health, alive: health > 0, hitAt: now };
}

/**
 * プレイヤーの攻撃範囲に敵が入っているか（1次元の距離判定）。
 * 密着時に敵の中心がわずかに背後へ回り込んでも取りこぼさないよう、
 * 背後方向にも ATTACK_RANGE_BEHIND ぶんの許容を持たせる。
 */
export function inAttackRange(playerX: number, facing: Facing, enemyX: number): boolean {
  const dx = (enemyX - playerX) * facing;
  return dx >= -ATTACK_RANGE_BEHIND && dx <= ATTACK_RANGE;
}

/** ゴール地点に到達したか */
export function reachedGoal(playerX: number, goalX: number): boolean {
  return playerX >= goalX;
}

export type GameStatus = "playing" | "cleared" | "gameover";

export function gameStatus(player: PlayerState, playerX: number, goalX: number): GameStatus {
  if (!isAlive(player)) return "gameover";
  if (reachedGoal(playerX, goalX)) return "cleared";
  return "playing";
}
