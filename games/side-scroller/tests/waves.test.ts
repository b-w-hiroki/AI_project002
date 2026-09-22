import { describe, expect, it } from "vitest";
import { isBossWave, isSwarmWave, pickupsForWave, rollWaveComposition } from "../src/logic/waves";

/** テストを決定的にするための疑似乱数（呼び出しごとに0, 0.1, 0.2... と巡回する） */
function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("isBossWave / isSwarmWave", () => {
  it("5の倍数ウェーブはボス", () => {
    expect(isBossWave(5)).toBe(true);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(4)).toBe(false);
  });

  it("7の倍数ウェーブは大量発生（ボスと重ならない）", () => {
    expect(isSwarmWave(7)).toBe(true);
    expect(isSwarmWave(14)).toBe(true);
  });

  it("ボスと大量発生が同時に成立するウェーブ(35)はボス優先", () => {
    expect(isBossWave(35)).toBe(true);
    expect(isSwarmWave(35)).toBe(false);
  });
});

describe("rollWaveComposition", () => {
  it("ボスウェーブは敵1体・タンク型", () => {
    const comp = rollWaveComposition(5, sequentialRng([0]));
    expect(comp.kind).toBe("boss");
    expect(comp.enemies).toHaveLength(1);
    expect(comp.enemies[0]!.type).toBe("tank");
  });

  it("大量発生ウェーブは敏捷型中心だが序盤Wave7は8体に抑える", () => {
    const comp = rollWaveComposition(7, sequentialRng([0]));
    expect(comp.kind).toBe("swarm");
    expect(comp.enemies).toHaveLength(8);
    expect(comp.enemies.every((e) => e.type === "agile")).toBe(true);
  });

  it("通常ウェーブはウェーブ番号なりの敵数（±1）になる", () => {
    const comp = rollWaveComposition(1, sequentialRng([0.5]));
    expect(comp.kind).toBe("normal");
    expect(comp.enemies.length).toBeGreaterThanOrEqual(2);
    expect(comp.enemies.length).toBeLessThanOrEqual(4);
  });

  it("序盤（ウェーブ3未満）は通常タイプのみ", () => {
    const comp = rollWaveComposition(2, sequentialRng([0.99]));
    expect(comp.enemies.every((e) => e.type === "normal")).toBe(true);
  });

  it("Wave3〜5は通常敵を70%主体にしてタンク混入を抑える", () => {
    const normal = rollWaveComposition(3, sequentialRng([0.5]));
    expect(normal.enemies.every((e) => e.type === "normal")).toBe(true);
    const tank = rollWaveComposition(3, sequentialRng([0.95]));
    expect(tank.enemies.some((e) => e.type === "tank")).toBe(true);
  });

  it("Wave5ボスは序盤向けに過剰な硬さを持たない", () => {
    const comp = rollWaveComposition(5, sequentialRng([0.5]));
    const boss = comp.enemies[0]!;
    expect(boss.health).toBeLessThanOrEqual(18);
    expect(boss.defense).toBeLessThanOrEqual(2);
  });

  it("同じrngシードなら再現できる", () => {
    const a = rollWaveComposition(10, sequentialRng([0.3, 0.6, 0.9]));
    const b = rollWaveComposition(10, sequentialRng([0.3, 0.6, 0.9]));
    expect(a).toEqual(b);
  });
});

describe("pickupsForWave", () => {
  it("3の倍数と特殊Waveは2つ、それ以外は1つ", () => {
    expect(pickupsForWave(1)).toBe(1);
    expect(pickupsForWave(3)).toBe(2);
    expect(pickupsForWave(5)).toBe(2);
    expect(pickupsForWave(6)).toBe(2);
    expect(pickupsForWave(7)).toBe(2);
  });
});
