import { describe, expect, it } from "vitest";
import { leagueRating, leagueSnapshot, leagueTier } from "../src/logic/league";

describe("solo hero league", () => {
  it("rates total evaluation plus best-stage bonus", () => {
    expect(leagueRating(120, 6)).toBe(480);
    expect(leagueRating(0, 12)).toBe(720);
  });

  it("maps rating to Bronze / Silver / Gold / Legend", () => {
    expect(leagueTier(0)).toBe("Bronze");
    expect(leagueTier(550)).toBe("Silver");
    expect(leagueTier(1100)).toBe("Gold");
    expect(leagueTier(1800)).toBe("Legend");
  });

  it("places the player among fixed asynchronous rivals", () => {
    const low = leagueSnapshot(0, 0);
    expect(low.rank).toBe(low.entries.length);
    expect(low.entries.find(entry => entry.self)?.name).toContain("カイト");

    const high = leagueSnapshot(2200, 12);
    expect(high.rank).toBe(1);
    expect(high.nextGap).toBe(0);
  });

  it("reports points needed for the next rank", () => {
    const snapshot = leagueSnapshot(400, 2); // rating 520, just below 紅蓮のバルク 520 tie ordering
    expect(snapshot.rating).toBe(520);
    expect(snapshot.nextGap).toBeGreaterThanOrEqual(0);
  });
});
