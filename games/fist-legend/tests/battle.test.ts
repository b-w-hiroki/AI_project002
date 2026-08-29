import { describe, expect, it } from "vitest";
import {
  MAX_HP,
  OUGI_GAUGE_MAX,
  applyBeat,
  applyHiddenCommand,
  applyPlayerOugi,
  battleOutcome,
  damageForClash,
  hiddenCommandDamage,
  initialBattleState,
  multiplierForClash,
  nextGauge,
  ougiDamage,
  pickCpuMove,
  resolveClash,
} from "../src/logic/battle";

/** テストを決定的にするための疑似乱数（呼び出しごとに巡回する） */
function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("resolveClash", () => {
  it("拳は気に、気は蹴に、蹴は拳に有利", () => {
    expect(resolveClash("punch", "ki")).toBe("advantage");
    expect(resolveClash("ki", "kick")).toBe("advantage");
    expect(resolveClash("kick", "punch")).toBe("advantage");
  });

  it("逆順は不利判定になる", () => {
    expect(resolveClash("ki", "punch")).toBe("disadvantage");
    expect(resolveClash("kick", "ki")).toBe("disadvantage");
    expect(resolveClash("punch", "kick")).toBe("disadvantage");
  });

  it("同じ技はぶつかり合い(clash)", () => {
    expect(resolveClash("punch", "punch")).toBe("clash");
  });
});

describe("multiplierForClash", () => {
  it("有利>ぶつかり合い>不利の順で倍率が下がる", () => {
    expect(multiplierForClash("advantage")).toBeGreaterThan(multiplierForClash("clash"));
    expect(multiplierForClash("clash")).toBeGreaterThan(multiplierForClash("disadvantage"));
  });
});

describe("damageForClash", () => {
  it("最低1ダメージは保証される", () => {
    const rng = sequentialRng([0]);
    expect(damageForClash("disadvantage", rng)).toBeGreaterThanOrEqual(1);
  });
});

describe("nextGauge", () => {
  it("上限(100)でクランプされる", () => {
    expect(nextGauge(95, true)).toBe(OUGI_GAUGE_MAX);
    expect(nextGauge(0, true)).toBeGreaterThan(0);
    expect(nextGauge(0, false)).toBeGreaterThan(0);
  });
});

describe("ougiDamage", () => {
  it("正の値を返す", () => {
    expect(ougiDamage(sequentialRng([0.5]))).toBeGreaterThan(0);
  });
});

describe("applyBeat", () => {
  it("有利な技を出した側がより多くダメージを与える", () => {
    const state = initialBattleState();
    const rng = sequentialRng([0.5, 0.5]);
    const result = applyBeat(state, "punch", "ki", rng);
    expect(result.clash).toBe("advantage");
    expect(result.playerDamageDealt).toBeGreaterThan(result.enemyDamageDealt);
    expect(result.state.enemyHp).toBeLessThan(state.enemyHp);
    expect(result.state.playerHp).toBeLessThan(state.playerHp);
  });

  it("HPは0未満にならない", () => {
    let state = initialBattleState();
    const rng = sequentialRng([0.5, 0.5]);
    for (let i = 0; i < 30; i++) {
      state = applyBeat(state, "punch", "ki", rng).state;
    }
    expect(state.enemyHp).toBeGreaterThanOrEqual(0);
  });

  it("同じrngシードなら再現できる", () => {
    const a = applyBeat(initialBattleState(), "kick", "punch", sequentialRng([0.3, 0.6]));
    const b = applyBeat(initialBattleState(), "kick", "punch", sequentialRng([0.3, 0.6]));
    expect(a).toEqual(b);
  });
});

describe("applyPlayerOugi", () => {
  it("ゲージが満タン未満なら何も起きない", () => {
    const state = { ...initialBattleState(), playerGauge: 50 };
    const result = applyPlayerOugi(state, sequentialRng([0.5]));
    expect(result).toEqual(state);
  });

  it("満タンなら敵にダメージを与えゲージが0に戻る", () => {
    const state = { ...initialBattleState(), playerGauge: OUGI_GAUGE_MAX };
    const result = applyPlayerOugi(state, sequentialRng([0.5]));
    expect(result.enemyHp).toBeLessThan(MAX_HP);
    expect(result.playerGauge).toBe(0);
  });
});

describe("hiddenCommandDamage / applyHiddenCommand", () => {
  it("最低1ダメージは保証される", () => {
    expect(hiddenCommandDamage(sequentialRng([0]))).toBeGreaterThanOrEqual(1);
  });

  it("敵にダメージを与え、プレイヤー側の状態は変化しない", () => {
    const state = initialBattleState();
    const result = applyHiddenCommand(state, sequentialRng([0.5]));
    expect(result.enemyHp).toBeLessThan(MAX_HP);
    expect(result.playerHp).toBe(state.playerHp);
    expect(result.playerGauge).toBe(state.playerGauge);
  });

  it("HPは0未満にならない", () => {
    const state = { ...initialBattleState(), enemyHp: 5 };
    const result = applyHiddenCommand(state, sequentialRng([0.99]));
    expect(result.enemyHp).toBe(0);
  });
});

describe("battleOutcome", () => {
  it("敵のHPが0ならプレイヤーの勝ち", () => {
    const state = { ...initialBattleState(), enemyHp: 0 };
    expect(battleOutcome(state, false)).toBe("playerWin");
  });

  it("プレイヤーのHPが0なら敵の勝ち", () => {
    const state = { ...initialBattleState(), playerHp: 0 };
    expect(battleOutcome(state, false)).toBe("enemyWin");
  });

  it("両者0なら引き分け", () => {
    const state = { ...initialBattleState(), playerHp: 0, enemyHp: 0 };
    expect(battleOutcome(state, false)).toBe("draw");
  });

  it("タイムアップ時はHPが多い方の勝ち", () => {
    const state = { ...initialBattleState(), playerHp: 60, enemyHp: 40 };
    expect(battleOutcome(state, true)).toBe("playerWin");
  });

  it("バトル継続中はnull", () => {
    expect(battleOutcome(initialBattleState(), false)).toBeNull();
  });
});

describe("pickCpuMove", () => {
  it("3種のいずれかを返す", () => {
    const move = pickCpuMove(sequentialRng([0.99]));
    expect(["punch", "kick", "ki"]).toContain(move);
  });
});
