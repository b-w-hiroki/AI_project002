import { describe, expect, it } from "vitest";
import { leagueRating, leagueSnapshot, leagueTier } from "../src/logic/league";

describe("solo hero league", () => {
  it("keeps the rating safe when the year bonus reaches the integer limit", () => {
    expect(leagueRating(Number.MAX_SAFE_INTEGER, 12)).toBe(Number.MAX_SAFE_INTEGER);
    expect(leagueSnapshot(Number.MAX_SAFE_INTEGER, 12).rank).toBe(1);
  });
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

  it.each([260, 520, 820, 1180, 1650, 2200])("requires one point above a rival at %i", rating => {
    const tied = leagueSnapshot(rating, 0);
    expect(tied.entries[tied.rank - 2]?.rating).toBe(rating);
    expect(tied.nextGap).toBe(1);
    expect(leagueSnapshot(rating - 1, 0).rank).toBe(tied.rank);
    expect(leagueSnapshot(rating - 1, 0).nextGap).toBe(2);
    expect(leagueSnapshot(rating + 1, 0).rank).toBe(tied.rank - 1);
  });

  it.each([0, 259, 260, 519, 520, 819, 820, 1179, 1180, 1649, 1650, 2199, 2200])(
    "nextGap is exactly enough to improve rank from rating %i", rating => {
      const current = leagueSnapshot(rating, 0);
      expect(leagueSnapshot(rating + current.nextGap - 1, 0).rank).toBe(current.rank);
      expect(leagueSnapshot(rating + current.nextGap, 0).rank).toBe(current.rank - 1);
    },
  );
});
