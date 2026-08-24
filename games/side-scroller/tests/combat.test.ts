import { describe, expect, it } from "vitest";
import {
  ATTACK_COOLDOWN_MS,
  HIOUGI_UNLOCK_SCORE,
  OUGI_GAUGE_MAX,
  OUGI_WINDOW_MS,
  PLAYER_INVULNERABLE_MS,
  PLAYER_MAX_HEALTH,
  SKILL_COOLDOWN_MS,
  SKILL_WINDOW_MS,
  WEAPONS,
  addScore,
  canAttack,
  canUseHiougi,
  canUseOugi,
  canUseSkill,
  checkHiougiUnlock,
  currentWeapon,
  damageEnemy,
  damagePlayer,
  gainOugiGauge,
  gameStatus,
  inAttackRange,
  isAlive,
  isAttacking,
  isHiougiActive,
  isInvulnerable,
  isOugiActive,
  isSkillActive,
  newEnemy,
  newPlayer,
  reachedGoal,
  startAttack,
  switchWeapon,
  useHiougi,
  useOugi,
  useSkill,
} from "../src/logic/combat";

describe("newPlayer", () => {
  it("満タンHP・生存状態で始まる", () => {
    const p = newPlayer();
    expect(p.health).toBe(PLAYER_MAX_HEALTH);
    expect(isAlive(p)).toBe(true);
  });
});

describe("attack / cooldown", () => {
  it("最初は攻撃できる", () => {
    expect(canAttack(newPlayer(), 0)).toBe(true);
  });
  it("攻撃後はクールダウン中は攻撃できない", () => {
    const p = startAttack(newPlayer(), 1000)!;
    expect(canAttack(p, 1000 + ATTACK_COOLDOWN_MS - 1)).toBe(false);
    expect(canAttack(p, 1000 + ATTACK_COOLDOWN_MS)).toBe(true);
  });
  it("クールダウン中の startAttack は null", () => {
    const p = startAttack(newPlayer(), 1000)!;
    expect(startAttack(p, 1100)).toBeNull();
  });
  it("attackingUntil の間だけ isAttacking が true", () => {
    const p = startAttack(newPlayer(), 1000)!;
    expect(isAttacking(p, 1050)).toBe(true);
    expect(isAttacking(p, 1200)).toBe(false);
  });
});

describe("damagePlayer / invulnerability", () => {
  it("被弾でHPが減り無敵時間が始まる", () => {
    const p = damagePlayer(newPlayer(), 1, 0);
    expect(p.health).toBe(PLAYER_MAX_HEALTH - 1);
    expect(isInvulnerable(p, 0)).toBe(true);
    expect(isInvulnerable(p, PLAYER_INVULNERABLE_MS)).toBe(false);
  });
  it("無敵時間中は再度ダメージを受けない", () => {
    const p1 = damagePlayer(newPlayer(), 1, 0);
    const p2 = damagePlayer(p1, 1, 100);
    expect(p2.health).toBe(p1.health);
  });
  it("無敵時間が切れれば再びダメージを受ける", () => {
    const p1 = damagePlayer(newPlayer(), 1, 0);
    const p2 = damagePlayer(p1, 1, PLAYER_INVULNERABLE_MS);
    expect(p2.health).toBe(PLAYER_MAX_HEALTH - 2);
  });
  it("HPは0未満にならない", () => {
    let p = newPlayer();
    for (let i = 0; i < 10; i++) p = damagePlayer(p, 5, i * PLAYER_INVULNERABLE_MS);
    expect(p.health).toBe(0);
    expect(isAlive(p)).toBe(false);
  });
});

describe("addScore", () => {
  it("スコアが加算される", () => {
    expect(addScore(newPlayer(), 100).score).toBe(100);
  });
});

describe("enemy", () => {
  it("ダメージでHPが減り、0で死亡する", () => {
    const e1 = damageEnemy(newEnemy("e1", 2), 1, 0);
    expect(e1.health).toBe(1);
    expect(e1.alive).toBe(true);
    const e2 = damageEnemy(e1, 1, 1000);
    expect(e2.health).toBe(0);
    expect(e2.alive).toBe(false);
  });
  it("デバウンス時間内の連続ヒットは無視される", () => {
    const e1 = damageEnemy(newEnemy("e1", 5), 1, 0);
    const e2 = damageEnemy(e1, 1, 50); // デバウンス内
    expect(e2.health).toBe(e1.health);
  });
  it("死亡した敵にダメージを与えても変化しない", () => {
    const dead = damageEnemy(newEnemy("e1", 1), 1, 0);
    expect(damageEnemy(dead, 1, 1000)).toEqual(dead);
  });
});

describe("inAttackRange", () => {
  it("前方の射程内なら true", () => {
    expect(inAttackRange(100, 1, 130)).toBe(true);
    expect(inAttackRange(100, -1, 70)).toBe(true);
  });
  it("密着時に敵の中心がわずかに背後でも許容範囲内なら true", () => {
    // dx = -10（許容 ATTACK_RANGE_BEHIND=12 以内）
    expect(inAttackRange(100, 1, 90)).toBe(true);
  });
  it("完全に背後や射程外なら false", () => {
    expect(inAttackRange(100, 1, 50)).toBe(false); // dx=-50、明確に背後
    expect(inAttackRange(100, 1, 200)).toBe(false); // dx=100、射程外
  });
});

describe("reachedGoal / gameStatus", () => {
  it("ゴールのx座標に到達したか判定できる", () => {
    expect(reachedGoal(999, 1000)).toBe(false);
    expect(reachedGoal(1000, 1000)).toBe(true);
  });
  it("死亡していれば gameover", () => {
    const dead = { ...newPlayer(), health: 0 };
    expect(gameStatus(dead, 0, 1000)).toBe("gameover");
  });
  it("ゴール到達で cleared", () => {
    expect(gameStatus(newPlayer(), 1000, 1000)).toBe("cleared");
  });
  it("それ以外は playing", () => {
    expect(gameStatus(newPlayer(), 500, 1000)).toBe("playing");
  });
});

describe("武器種別", () => {
  it("初期装備は melee", () => {
    expect(newPlayer().equippedWeapon).toBe("melee");
  });
  it("switchWeapon で装備を切り替えられる", () => {
    const p = switchWeapon(newPlayer(), "ranged");
    expect(p.equippedWeapon).toBe("ranged");
    expect(currentWeapon(p).kind).toBe("ranged");
  });
  it("武器ごとにクールダウン・射程が異なる", () => {
    expect(WEAPONS.melee.range).toBeLessThan(WEAPONS.mid.range);
    expect(WEAPONS.mid.range).toBeLessThan(WEAPONS.ranged.range);
  });
  it("装備している武器のクールダウンで攻撃可否が決まる", () => {
    const midPlayer = switchWeapon(newPlayer(), "mid");
    const attacked = startAttack(midPlayer, 1000)!;
    expect(canAttack(attacked, 1000 + WEAPONS.mid.cooldownMs - 1)).toBe(false);
    expect(canAttack(attacked, 1000 + WEAPONS.mid.cooldownMs)).toBe(true);
  });
});

describe("必殺ゲージ", () => {
  it("初期値は0", () => {
    expect(newPlayer().ougiGauge).toBe(0);
  });
  it("gainOugiGauge で加算され、上限でクランプされる", () => {
    let p = newPlayer();
    p = gainOugiGauge(p, 60);
    expect(p.ougiGauge).toBe(60);
    p = gainOugiGauge(p, 60);
    expect(p.ougiGauge).toBe(OUGI_GAUGE_MAX);
  });
});

describe("スキル", () => {
  it("最初は使用可能", () => {
    expect(canUseSkill(newPlayer(), 0)).toBe(true);
  });
  it("発動後はクールダウン中は使えない", () => {
    const p = useSkill(newPlayer(), 1000)!;
    expect(canUseSkill(p, 1000 + SKILL_COOLDOWN_MS - 1)).toBe(false);
    expect(canUseSkill(p, 1000 + SKILL_COOLDOWN_MS)).toBe(true);
  });
  it("クールダウン中の useSkill は null", () => {
    const p = useSkill(newPlayer(), 1000)!;
    expect(useSkill(p, 1100)).toBeNull();
  });
  it("発動中のみ isSkillActive が true", () => {
    const p = useSkill(newPlayer(), 1000)!;
    expect(isSkillActive(p, 1100)).toBe(true);
    expect(isSkillActive(p, 1000 + SKILL_WINDOW_MS)).toBe(false);
  });
});

describe("奥義", () => {
  it("ゲージが満タンでなければ使えない", () => {
    const p = gainOugiGauge(newPlayer(), 99);
    expect(canUseOugi(p)).toBe(false);
    expect(useOugi(p, 0)).toBeNull();
  });
  it("ゲージ満タンで発動でき、ゲージが0に戻る", () => {
    const full = gainOugiGauge(newPlayer(), OUGI_GAUGE_MAX);
    expect(canUseOugi(full)).toBe(true);
    const used = useOugi(full, 1000)!;
    expect(used.ougiGauge).toBe(0);
    expect(isOugiActive(used, 1100)).toBe(true);
    expect(isOugiActive(used, 1000 + OUGI_WINDOW_MS)).toBe(false);
  });
});

describe("秘奥義", () => {
  it("スコア条件を満たすまで解放されない", () => {
    const p = { ...newPlayer(), score: HIOUGI_UNLOCK_SCORE - 1 };
    expect(checkHiougiUnlock(p).hiougiUnlocked).toBe(false);
  });
  it("スコア条件を満たすと解放される", () => {
    const p = { ...newPlayer(), score: HIOUGI_UNLOCK_SCORE };
    expect(checkHiougiUnlock(p).hiougiUnlocked).toBe(true);
  });
  it("未解放ならゲージが満タンでも使えない", () => {
    const full = gainOugiGauge(newPlayer(), OUGI_GAUGE_MAX);
    expect(canUseHiougi(full)).toBe(false);
    expect(useHiougi(full, 0)).toBeNull();
  });
  it("解放済み＋ゲージ満タンで発動できる", () => {
    let p = { ...newPlayer(), score: HIOUGI_UNLOCK_SCORE };
    p = checkHiougiUnlock(p);
    p = gainOugiGauge(p, OUGI_GAUGE_MAX);
    expect(canUseHiougi(p)).toBe(true);
    const used = useHiougi(p, 1000)!;
    expect(used.ougiGauge).toBe(0);
    expect(isHiougiActive(used, 1100)).toBe(true);
  });
  it("解放済みでもゲージ不足なら使えない", () => {
    let p = { ...newPlayer(), score: HIOUGI_UNLOCK_SCORE };
    p = checkHiougiUnlock(p);
    p = gainOugiGauge(p, 50);
    expect(canUseHiougi(p)).toBe(false);
  });
});

describe("inAttackRange（武器射程の可変対応）", () => {
  it("range を省略すると近接武器の射程で判定する", () => {
    expect(inAttackRange(100, 1, 100 + WEAPONS.melee.range)).toBe(true);
    expect(inAttackRange(100, 1, 100 + WEAPONS.melee.range + 1)).toBe(false);
  });
  it("range を渡すとその射程で判定する（中距離武器など）", () => {
    expect(inAttackRange(100, 1, 100 + WEAPONS.mid.range, WEAPONS.mid.range)).toBe(true);
    expect(inAttackRange(100, 1, 100 + WEAPONS.mid.range + 1, WEAPONS.mid.range)).toBe(false);
  });
});
