import { describe, expect, it } from "vitest";
import {
  ATTACK_COOLDOWN_MS,
  PLAYER_INVULNERABLE_MS,
  PLAYER_MAX_HEALTH,
  addScore,
  canAttack,
  damageEnemy,
  damagePlayer,
  gameStatus,
  inAttackRange,
  isAlive,
  isAttacking,
  isInvulnerable,
  newEnemy,
  newPlayer,
  reachedGoal,
  startAttack,
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
  it("背後や射程外なら false", () => {
    expect(inAttackRange(100, 1, 90)).toBe(false);
    expect(inAttackRange(100, 1, 200)).toBe(false);
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
