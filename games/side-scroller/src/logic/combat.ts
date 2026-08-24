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

// ---- 武器種別 ----

export type WeaponKind = "melee" | "mid" | "ranged";

export interface WeaponDef {
  kind: WeaponKind;
  range: number; // 近/中距離の判定距離。遠距離は射程では判定せず飛翔体で当たりを取る
  damage: number;
  cooldownMs: number;
  attackWindowMs: number;
  projectile: boolean;
}

export const WEAPONS: Readonly<Record<WeaponKind, WeaponDef>> = {
  melee: {
    kind: "melee",
    range: ATTACK_RANGE,
    damage: 1,
    cooldownMs: ATTACK_COOLDOWN_MS,
    attackWindowMs: 150,
    projectile: false,
  },
  mid: {
    kind: "mid",
    range: 110,
    damage: 1,
    cooldownMs: 480,
    attackWindowMs: 180,
    projectile: false,
  },
  ranged: {
    kind: "ranged",
    range: 520,
    damage: 1,
    cooldownMs: 550,
    attackWindowMs: 120,
    projectile: true,
  },
} as const;

/**
 * 装備中武器の実効定義。customWeapons に上書きがあればそちらを優先する
 * （ロードアウトの基本装備/召喚武器で WEAPONS の固定値を差し替えるためのフック）。
 */
export function currentWeapon(player: PlayerState): WeaponDef {
  return player.customWeapons[player.equippedWeapon] ?? WEAPONS[player.equippedWeapon];
}

/** 装備武器を切り替える（所持判定は呼び出し側の責務。現状は全種類を最初から所持） */
export function switchWeapon(player: PlayerState, kind: WeaponKind): PlayerState {
  return { ...player, equippedWeapon: kind };
}

/** 特定スロットの実効武器定義を上書きする（基本装備/召喚武器の反映に使う） */
export function setCustomWeapon(player: PlayerState, kind: WeaponKind, def: WeaponDef): PlayerState {
  return { ...player, customWeapons: { ...player.customWeapons, [kind]: def } };
}

/** 上書きを解除し、WEAPONS の既定値に戻す */
export function clearCustomWeapon(player: PlayerState, kind: WeaponKind): PlayerState {
  const rest = { ...player.customWeapons };
  delete rest[kind];
  return { ...player, customWeapons: rest };
}

// ---- 必殺ゲージ ----

export const OUGI_GAUGE_MAX = 100;
export const OUGI_GAUGE_PER_HIT = 10;
export const OUGI_WINDOW_MS = 400;
export const OUGI_RANGE = 260;
export const OUGI_DAMAGE_MULTIPLIER = 5;

/** 秘奥義解放に必要な、今の周回でのスコア */
export const HIOUGI_UNLOCK_SCORE = 500;
export const HIOUGI_WINDOW_MS = 500;
export const HIOUGI_RANGE = 420;
export const HIOUGI_DAMAGE_MULTIPLIER = 12;

// ---- スキル（ボタン即時発動、独自クールダウン） ----

export const SKILL_COOLDOWN_MS = 4000;
export const SKILL_WINDOW_MS = 300;
export const SKILL_RANGE = 150;
export const SKILL_DAMAGE_MULTIPLIER = 2;

// ---- 無被弾スーパーコンボ ----

export const SUPER_COMBO_TIER1_THRESHOLD = 10;
export const SUPER_COMBO_TIER1_MULTIPLIER = 1.1;
export const SUPER_COMBO_TIER2_THRESHOLD = 30;
export const SUPER_COMBO_TIER2_MULTIPLIER = 1.2;

/** 無被弾で継続しているコンボ数に応じたダメージ倍率 */
export function superComboMultiplier(streak: number): number {
  if (streak >= SUPER_COMBO_TIER2_THRESHOLD) return SUPER_COMBO_TIER2_MULTIPLIER;
  if (streak >= SUPER_COMBO_TIER1_THRESHOLD) return SUPER_COMBO_TIER1_MULTIPLIER;
  return 1;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  facing: Facing;
  invulnerableUntil: number; // epoch ms 相当（テストでは任意の単調増加値でよい）
  attackingUntil: number; // この時刻まで通常攻撃の判定が有効
  lastAttackAt: number; // 直近の通常攻撃発動時刻（クールダウン計算用）
  score: number;
  equippedWeapon: WeaponKind;
  /** 装備スロットごとの実効武器定義の上書き。ロードアウトの基本装備/召喚武器に使う */
  customWeapons: Partial<Record<WeaponKind, WeaponDef>>;
  ougiGauge: number; // 0..OUGI_GAUGE_MAX
  ougiActiveUntil: number; // この時刻まで奥義の判定が有効
  hiougiUnlocked: boolean; // 秘奥義が解放済みか（今の周回で永続）
  hiougiActiveUntil: number; // この時刻まで秘奥義の判定が有効
  lastSkillAt: number; // 直近のスキル発動時刻（クールダウン計算用）
  skillActiveUntil: number; // この時刻までスキルの判定が有効
  comboStreak: number; // 無被弾で継続している連撃数。被弾で0に戻る
  armorCharges: number; // 防具の残り耐久。被弾時、HPより先にここが減る
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
    equippedWeapon: "melee",
    customWeapons: {},
    ougiGauge: 0,
    ougiActiveUntil: 0,
    hiougiUnlocked: false,
    hiougiActiveUntil: 0,
    lastSkillAt: -Infinity,
    skillActiveUntil: 0,
    comboStreak: 0,
    armorCharges: 0,
  };
}

export function isAlive(player: PlayerState): boolean {
  return player.health > 0;
}

export function isInvulnerable(player: PlayerState, now: number): boolean {
  return now < player.invulnerableUntil;
}

/** 装備中の武器のクールダウンで判定する */
export function canAttack(player: PlayerState, now: number): boolean {
  return now - player.lastAttackAt >= currentWeapon(player).cooldownMs;
}

/** 通常攻撃を発動（クールダウン中なら null）。判定時間・射程は装備武器に従う */
export function startAttack(player: PlayerState, now: number): PlayerState | null {
  if (!canAttack(player, now)) return null;
  return {
    ...player,
    lastAttackAt: now,
    attackingUntil: now + currentWeapon(player).attackWindowMs,
  };
}

export function isAttacking(player: PlayerState, now: number): boolean {
  return now < player.attackingUntil;
}

// ---- 必殺ゲージ / スキル / 奥義 / 秘奥義 ----

/** ゲージを加算する（命中時などに呼ぶ）。上限でクランプ */
export function gainOugiGauge(player: PlayerState, amount: number): PlayerState {
  return { ...player, ougiGauge: Math.min(OUGI_GAUGE_MAX, player.ougiGauge + amount) };
}

export function canUseSkill(player: PlayerState, now: number): boolean {
  return now - player.lastSkillAt >= SKILL_COOLDOWN_MS;
}

/** スキルを発動（クールダウン中なら null）。通常攻撃とは独立したクールダウン */
export function useSkill(player: PlayerState, now: number): PlayerState | null {
  if (!canUseSkill(player, now)) return null;
  return { ...player, lastSkillAt: now, skillActiveUntil: now + SKILL_WINDOW_MS };
}

export function isSkillActive(player: PlayerState, now: number): boolean {
  return now < player.skillActiveUntil;
}

export function canUseOugi(player: PlayerState): boolean {
  return player.ougiGauge >= OUGI_GAUGE_MAX;
}

/** 奥義を発動（ゲージ不足なら null）。ゲージを消費して広範囲攻撃の判定を開く */
export function useOugi(player: PlayerState, now: number): PlayerState | null {
  if (!canUseOugi(player)) return null;
  return { ...player, ougiGauge: 0, ougiActiveUntil: now + OUGI_WINDOW_MS };
}

export function isOugiActive(player: PlayerState, now: number): boolean {
  return now < player.ougiActiveUntil;
}

/** 今の周回のスコアが条件を満たしていれば秘奥義を解放する（解放は以後ずっと有効） */
export function checkHiougiUnlock(player: PlayerState): PlayerState {
  if (player.hiougiUnlocked || player.score < HIOUGI_UNLOCK_SCORE) return player;
  return { ...player, hiougiUnlocked: true };
}

/** 秘奥義は「解放済み」かつ「ゲージ満タン」の両方を満たす場合のみ発動できる */
export function canUseHiougi(player: PlayerState): boolean {
  return player.hiougiUnlocked && player.ougiGauge >= OUGI_GAUGE_MAX;
}

/** 秘奥義を発動（未解放またはゲージ不足なら null） */
export function useHiougi(player: PlayerState, now: number): PlayerState | null {
  if (!canUseHiougi(player)) return null;
  return { ...player, ougiGauge: 0, hiougiActiveUntil: now + HIOUGI_WINDOW_MS };
}

export function isHiougiActive(player: PlayerState, now: number): boolean {
  return now < player.hiougiActiveUntil;
}

/**
 * プレイヤーが被弾。無敵時間中なら変化なし。
 * 防具の残り耐久（armorCharges）があれば、HPを削らずそちらを1消費して肩代わりする。
 * 防具で防いだ場合も「被弾」自体は発生しているため、無敵時間の付与・スーパーコンボのリセットは行う。
 */
export function damagePlayer(player: PlayerState, amount: number, now: number): PlayerState {
  if (!isAlive(player) || isInvulnerable(player, now)) return player;
  const base = {
    ...player,
    comboStreak: 0,
    invulnerableUntil: now + PLAYER_INVULNERABLE_MS,
  };
  if (base.armorCharges > 0) {
    return { ...base, armorCharges: base.armorCharges - 1 };
  }
  return { ...base, health: Math.max(0, base.health - amount) };
}

export function addScore(player: PlayerState, amount: number): PlayerState {
  return { ...player, score: player.score + amount };
}

/** 無被弾コンボ数を加算する（命中時に呼ぶ想定） */
export function gainComboStreak(player: PlayerState, amount = 1): PlayerState {
  return { ...player, comboStreak: player.comboStreak + amount };
}

/** 防具を獲得する（耐久を加算） */
export function gainArmor(player: PlayerState, amount = 1): PlayerState {
  return { ...player, armorCharges: player.armorCharges + amount };
}

/** HPを回復する（アイテム使用時などに呼ぶ）。最大HPでクランプ */
export function healPlayer(player: PlayerState, amount: number): PlayerState {
  return { ...player, health: Math.min(player.maxHealth, player.health + amount) };
}

// ---- 敵 ----

export interface EnemyState {
  id: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  hitAt: number; // 直近に攻撃を受けた時刻（多段ヒット防止用）
  defense: number; // 防御力。連続ヒットで削れていく（DEFENSE_SHRED_PER_HIT）
}

export function newEnemy(id: string, health = 2, defense = 0): EnemyState {
  return { id, health, maxHealth: health, alive: true, hitAt: -Infinity, defense };
}

const HIT_DEBOUNCE_MS = 200;
/** 連続ヒット1回ごとに防御力が削れる量。連撃が続くほど後段の通りが良くなる */
export const DEFENSE_SHRED_PER_HIT = 1;
/** 防御力でどれだけ軽減されても、最低限このダメージは通す */
const MIN_DAMAGE_THROUGH_DEFENSE = 1;

/** 敵が攻撃判定内にいる時にダメージを与える。連続ヒット防止のデバウンス付き */
export function damageEnemy(enemy: EnemyState, amount: number, now: number): EnemyState {
  if (!enemy.alive) return enemy;
  if (now - enemy.hitAt < HIT_DEBOUNCE_MS) return enemy;
  const effectiveDamage = Math.max(MIN_DAMAGE_THROUGH_DEFENSE, amount - enemy.defense);
  const health = Math.max(0, enemy.health - effectiveDamage);
  const defense = Math.max(0, enemy.defense - DEFENSE_SHRED_PER_HIT);
  return { ...enemy, health, defense, alive: health > 0, hitAt: now };
}

/**
 * プレイヤーの攻撃範囲に敵が入っているか（1次元の距離判定）。
 * 密着時に敵の中心がわずかに背後へ回り込んでも取りこぼさないよう、
 * 背後方向にも rangeBehind ぶんの許容を持たせる。
 * range/rangeBehind を省略すると通常攻撃（近接武器）の射程で判定する。
 */
export function inAttackRange(
  playerX: number,
  facing: Facing,
  enemyX: number,
  range: number = ATTACK_RANGE,
  rangeBehind: number = ATTACK_RANGE_BEHIND,
): boolean {
  const dx = (enemyX - playerX) * facing;
  return dx >= -rangeBehind && dx <= range;
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
