import { describe, expect, it } from "vitest";
import { newExpedition } from "../src/logic/expedition";
import { resultRewards } from "../src/logic/resultRewards";

const troop = { ids: ["gen_soujin", "gen_kohei", "gen_ashigaru"], power: 10, hp: 100, guard: 0, scout: 0, merchant: 0 };
describe("result reward hierarchy", () => {
  it("leads with earned gear and merit instead of zero coins", () => {
    const run = { ...newExpedition(troop), status: "clear" as const, step: 10, loot: 0 };
    const rewards = resultRewards(run, 8, "ja");
    expect(rewards.map(r => r.text)).toEqual(["Rare装備 +1", "功績 +8", "0 持帰り銭"]);
    expect(rewards.map(r => r.earned)).toEqual([true, true, false]);
    expect(run.loot).toBe(0);
  });
  it("keeps defeat's halved coin amount and no gear", () => {
    const run = { ...newExpedition(troop), status: "defeat" as const, step: 4, loot: 99 };
    expect(resultRewards(run, 0, "en").map(r => r.text)).toEqual(["49 Coins Secured", "No Gear Reward", "Merit +0"]);
  });
  it("keeps positive coins ahead of unearned merit without changing the run", () => {
    const run = { ...newExpedition(troop), status: "retreat" as const, step: 3, loot: 120 };
    expect(resultRewards(run, 0, "ja").map(r => r.text)).toEqual(["Common装備 +1", "120 持帰り銭", "功績 +0"]);
    expect(run.loot).toBe(120);
  });
  it("distinguishes early returns from equipment-eligible returns", () => {
    const run = { ...newExpedition(troop), status: "retreat" as const, step: 2, loot: 0 };
    expect(resultRewards(run, 0, "ja").every(r => !r.earned)).toBe(true);
    expect(resultRewards({ ...run, step: 3 }, 0, "en")[0]?.text).toBe("Common Gear +1");
  });
});
