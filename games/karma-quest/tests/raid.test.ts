import { describe, expect, it } from "vitest";
import { advanceRaid, attackRaid, loadRaid, newRaid, raidDamage, raidMaxHp, raidReward, saveRaid } from "../src/logic/raid";

describe("solo raid", () => {
  it("scales boss HP by level", () => {
    expect(raidMaxHp(1)).toBe(900);
    expect(raidMaxHp(3)).toBe(1600);
  });

  it("deals deterministic damage from hero stats", () => {
    const damage = raidDamage({ atk: 20, def: 10, hp: 60, magic: 15 });
    expect(damage).toBeGreaterThan(150);
    const result = attackRaid(newRaid(), { atk: 20, def: 10, hp: 60, magic: 15 });
    expect(result.next.hp).toBe(900 - damage);
  });

  it("persists and restores progress", () => {
    const map = new Map<string, string>();
    const store = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
    };
    const damaged = { ...newRaid(2), hp: 300 };
    saveRaid(store, damaged);
    expect(loadRaid(store)).toEqual(damaged);
  });

  it("advances to a stronger boss after defeat", () => {
    const cleared = { ...newRaid(1), hp: 0 };
    expect(raidReward(cleared)).toBe(80);
    const next = advanceRaid(cleared);
    expect(next.level).toBe(2);
    expect(next.defeats).toBe(1);
    expect(next.hp).toBe(next.maxHp);
  });
});
