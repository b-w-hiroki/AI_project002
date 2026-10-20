import { describe, expect, it } from "vitest";
import { advanceRaid, attackRaid, loadRaid, newRaid, raidDamage, raidMaxHp, raidReward, saveRaid } from "../src/logic/raid";

describe("solo raid", () => {
  const fromRaw = (raw: string) => loadRaid({ getItem: () => raw, setItem: () => undefined });

  it.each([undefined, null, "bad", "0", -1, 0.5])("does not treat invalid HP %s as a defeat", hp => {
    expect(fromRaw(JSON.stringify({ level: 3, defeats: 2, hp }))).toEqual(newRaid(3, 2));
  });

  it.each(["null", "[]", "42", '"saved"', "{broken"])("recovers an invalid record %s", raw => {
    expect(fromRaw(raw)).toEqual(newRaid());
  });

  it.each(["Infinity", -3, 1.5, Number.MAX_SAFE_INTEGER])("rejects unsafe level %s", level => {
    const state = fromRaw(JSON.stringify({ level, defeats: -2 }));
    expect(state).toEqual(newRaid());
    expect(Number.isSafeInteger(raidReward(state))).toBe(true);
  });

  it("preserves legitimate defeated and damaged bosses and derives max HP", () => {
    expect(fromRaw('{"level":2,"defeats":1,"hp":0,"maxHp":999}')).toEqual({ ...newRaid(2, 1), hp: 0 });
    expect(fromRaw('{"level":2,"defeats":1,"hp":300}')).toEqual({ ...newRaid(2, 1), hp: 300 });
    expect(fromRaw('{"level":2,"defeats":1,"hp":9000}')).toEqual(newRaid(2, 1));
    expect(fromRaw('{"level":1e309,"hp":1e309,"defeats":1e309}')).toEqual(newRaid());
  });

  it.each([undefined, null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    "does not recover a reward or partial HP from corrupt level %s", level => {
      for (const hp of [0, 300]) {
        expect(fromRaw(JSON.stringify({ level, defeats: 9, hp }))).toEqual(newRaid());
      }
    },
  );

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
