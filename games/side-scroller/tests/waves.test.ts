import { describe, expect, it } from "vitest";
import { enemiesInWave, enemySpecForWave, pickupsForWave } from "../src/logic/waves";

describe("enemiesInWave", () => {
  it("序盤は3体から始まり、ウェーブが進むほど増える", () => {
    expect(enemiesInWave(1)).toBe(3);
    expect(enemiesInWave(3)).toBe(4);
    expect(enemiesInWave(5)).toBe(5);
  });

  it("上限を超えて増え続けない", () => {
    expect(enemiesInWave(100)).toBe(10);
  });
});

describe("enemySpecForWave", () => {
  it("序盤は体力2・防御0", () => {
    expect(enemySpecForWave(1)).toEqual({ health: 2, defense: 0 });
  });

  it("ウェーブが進むと体力が増える", () => {
    expect(enemySpecForWave(4).health).toBeGreaterThan(enemySpecForWave(1).health);
  });

  it("ウェーブ4以降で防御力が付き始める", () => {
    expect(enemySpecForWave(3).defense).toBe(0);
    expect(enemySpecForWave(4).defense).toBeGreaterThan(0);
  });

  it("防御力の上限を超えない", () => {
    expect(enemySpecForWave(1000).defense).toBeLessThanOrEqual(5);
  });
});

describe("pickupsForWave", () => {
  it("3の倍数ウェーブは2つ、それ以外は1つ", () => {
    expect(pickupsForWave(1)).toBe(1);
    expect(pickupsForWave(3)).toBe(2);
    expect(pickupsForWave(6)).toBe(2);
    expect(pickupsForWave(7)).toBe(1);
  });
});
