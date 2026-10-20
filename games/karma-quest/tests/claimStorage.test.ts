import { describe, expect, it } from "vitest";
import { CLAIM_KEY, createClaimStorage } from "../src/logic/claimStorage";
import { loadRaid, newRaid } from "../src/logic/raid";
import { createProgressStorage } from "../src/logic/progress";

const RAID = "karma_quest_solo_raid_v1";
const TOTAL = "karma_quest_total_eval_v1";
function fixture(fail: string) {
  const map = new Map([[RAID, JSON.stringify({ ...newRaid(), hp: 0 })], [TOTAL, "500"]]);
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { if (key === fail) throw new Error("quota"); map.set(key, value); },
    removeItem: (key: string) => { if (fail === "remove") throw new Error("denied"); map.delete(key); },
  };
  return { map, store };
}
describe("durable raid claim", () => {
  it("does not change either value if the commit fails", () => {
    const { map, store } = fixture(CLAIM_KEY);
    expect(() => createClaimStorage(() => store).claimReward()).toThrow();
    expect(map.get(TOTAL)).toBe("500");
    expect(loadRaid(store).hp).toBe(0);
  });
  it.each([RAID, TOTAL, "remove", "none"])("recovers without duplicate reward after failure at %s", fail => {
    const { map, store } = fixture(fail);
    expect(createClaimStorage(() => store).claimReward()?.reward).toBe(80);
    const reload = createClaimStorage(() => store);
    expect(loadRaid(reload.storage)).toEqual(newRaid(2, 1));
    expect(reload.storage.getItem(TOTAL)).toBe("580");
    expect(reload.claimReward()).toBeNull();
    const progress = createProgressStorage(() => reload.storage);
    expect(progress.addTotalEvaluation(20)).toBe(600);
    expect(createClaimStorage(() => store).storage.getItem(TOTAL)).toBe("600");
    if (fail === "none") expect(map.has(CLAIM_KEY)).toBe(false);
  });
  it("preserves a committed claim if another journal update fails", () => {
    const { map, store } = fixture(RAID);
    createClaimStorage(() => store).claimReward();
    const failing = { ...store, setItem: () => { throw new Error("quota"); } };
    expect(() => createClaimStorage(() => failing).storage.setItem(TOTAL, "999")).toThrow();
    expect(createClaimStorage(() => store).storage.getItem(TOTAL)).toBe("580");
    expect(map.has(CLAIM_KEY)).toBe(true);
  });
  it("fails closed on a corrupt journal without granting another reward", () => {
    const { map, store } = fixture("none");
    map.set(CLAIM_KEY, '{"total":"900","raid":"{}"}');
    expect(() => createClaimStorage(() => store).claimReward()).toThrow();
    expect(map.get(TOTAL)).toBe("500");
  });
});
