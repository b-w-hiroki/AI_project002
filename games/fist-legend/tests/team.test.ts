import { describe, expect, it } from "vitest";
import { normalizeTeam, toggleTeamMember } from "../src/logic/team";

describe("fighter team", () => {
  it("defaults to Ryuga when empty", () => {
    expect(normalizeTeam([])).toEqual(["ryuga"]);
  });

  it("allows up to three unique fighters", () => {
    const team = ["ryuga"] as const;
    let next = toggleTeamMember(team, "renka");
    next = toggleTeamMember(next, "gaku");
    expect(next).toEqual(["ryuga", "renka", "gaku"]);
    expect(toggleTeamMember(next, "mei")).toEqual(["ryuga", "renka", "gaku"]);
  });

  it("never allows an empty team and preserves leader order", () => {
    expect(toggleTeamMember(["ryuga"], "ryuga")).toEqual(["ryuga"]);
    const team = toggleTeamMember(["ryuga", "renka", "gaku"], "ryuga");
    expect(team).toEqual(["renka", "gaku"]);
    expect(toggleTeamMember(team, "mei")).toEqual(["renka", "gaku", "mei"]);
  });
});
