import { describe, expect, it } from "vitest";
import { teamTacticalRead } from "../src/logic/teamTactics";

describe("team tactical read", () => {
  it("maps each rival tell to the existing rock-paper-scissors counter", () => {
    expect(teamTacticalRead(["ryuga"], "punch").counterMove).toBe("kick");
    expect(teamTacticalRead(["ryuga"], "kick").counterMove).toBe("ki");
    expect(teamTacticalRead(["ryuga"], "ki").counterMove).toBe("punch");
  });

  it("changes the suggested fighter when the selected team contains a matching specialist", () => {
    expect(teamTacticalRead(["ryuga", "gaku"], "punch").specialist).toBe("gaku");
    expect(teamTacticalRead(["ryuga", "mei"], "kick").specialist).toBe("mei");
    expect(teamTacticalRead(["ryuga", "renka"], "ki").specialist).toBe("renka");
    expect(teamTacticalRead(["ryuga"], "punch").specialist).toBeNull();
  });
});
