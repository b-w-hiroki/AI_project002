import { describe, expect, it } from "vitest";
import { arenaSnapshot, arenaTier, armyRating } from "../src/logic/arena";

describe("asynchronous army ranking", () => {
  const campaign = { merit: 8, training: 2, cleared: ["plains"] as const };

  it("combines troop power and campaign progress into a rating", () => {
    const weak = armyRating({ power: 80 }, campaign, 3);
    const strong = armyRating({ power: 160 }, campaign, 8);
    expect(strong).toBeGreaterThan(weak);
  });

  it("maps rating to league tiers", () => {
    expect(arenaTier(0)).toBe("Bronze");
    expect(arenaTier(1500)).toBe("Silver");
    expect(arenaTier(2800)).toBe("Gold");
    expect(arenaTier(4200)).toBe("Legend");
  });

  it("places the player among ghost armies and exposes next-rank gap", () => {
    const snapshot = arenaSnapshot({ power: 120 }, campaign, 5);
    expect(snapshot.entries.some(entry => entry.self)).toBe(true);
    expect(snapshot.rank).toBeGreaterThanOrEqual(1);
    expect(snapshot.rank).toBeLessThanOrEqual(snapshot.entries.length);
    expect(snapshot.nextGap).toBeGreaterThanOrEqual(0);
  });
});
