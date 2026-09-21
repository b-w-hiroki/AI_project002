import { describe, expect, it } from "vitest";
import { initialBattleState } from "../src/logic/battle";
import { applyHajaAfterBeat, HAJA_DURATION_MS } from "../src/logic/haja";

describe("覇者モード", () => {
  it("5秒間の強化として定義される", () => {
    expect(HAJA_DURATION_MS).toBe(5_000);
  });

  it("剛は解決済み与ダメージを40%上乗せする", () => {
    const before = initialBattleState();
    const resolved = { ...before, enemyHp: 80, playerHp: 92, playerGauge: 14 };
    const result = applyHajaAfterBeat(before, resolved, "go");
    expect(result.bonusDamage).toBe(8);
    expect(result.state.enemyHp).toBe(72);
    expect(result.state.playerHp).toBe(92);
  });

  it("柔は生存中の被ダメージを50%軽減する", () => {
    const before = initialBattleState();
    const resolved = { ...before, playerHp: 80, enemyHp: 92 };
    const result = applyHajaAfterBeat(before, resolved, "ju");
    expect(result.preventedDamage).toBe(10);
    expect(result.state.playerHp).toBe(90);
  });

  it("柔でもKO済みの一撃は復活させない", () => {
    const before = { ...initialBattleState(), playerHp: 12 };
    const resolved = { ...before, playerHp: 0 };
    const result = applyHajaAfterBeat(before, resolved, "ju");
    expect(result.preventedDamage).toBe(0);
    expect(result.state.playerHp).toBe(0);
  });

  it("瞬はそのビートで得た奥義ゲージを同量追加する", () => {
    const before = { ...initialBattleState(), playerGauge: 20 };
    const resolved = { ...before, playerGauge: 34, enemyHp: 90, playerHp: 92 };
    const result = applyHajaAfterBeat(before, resolved, "shun");
    expect(result.bonusGauge).toBe(14);
    expect(result.state.playerGauge).toBe(48);
  });

  it("瞬の追加ゲージは100を超えない", () => {
    const before = { ...initialBattleState(), playerGauge: 90 };
    const resolved = { ...before, playerGauge: 98 };
    const result = applyHajaAfterBeat(before, resolved, "shun");
    expect(result.bonusGauge).toBe(2);
    expect(result.state.playerGauge).toBe(100);
  });
});
