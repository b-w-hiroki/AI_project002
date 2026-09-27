import { describe, expect, it } from "vitest";
import { tacticalAdvice } from "../src/logic/tactics";
import type { WaveComposition } from "../src/logic/waves";

const wave = (kind: WaveComposition["kind"], types: Array<"normal" | "agile" | "tank">): WaveComposition => ({
  kind,
  enemies: types.map(type => ({ type, health: 3, defense: type === "tank" ? 1 : 0, speedMul: 1 })),
});

describe("tacticalAdvice", () => {
  it("boss always teaches guard then punish", () => {
    const advice = tacticalAdvice("chain", "melee", wave("boss", ["tank"]));
    expect(advice.plan).toBe("boss_guard");
    expect(advice.ja).toContain("GRD");
    expect(advice.ja).toContain("SKL");
  });

  it("chain and draw give different swarm plans", () => {
    const composition = wave("swarm", ["agile", "agile", "agile"]);
    expect(tacticalAdvice("chain", "melee", composition).plan).toBe("swarm_pressure");
    expect(tacticalAdvice("draw", "melee", composition).plan).toBe("agile_spacing");
  });

  it("tank-heavy wave explains each stance differently", () => {
    const composition = wave("normal", ["tank", "tank", "normal"]);
    expect(tacticalAdvice("chain", "melee", composition).ja).toContain("連撃");
    expect(tacticalAdvice("draw", "melee", composition).ja).toContain("1.2秒");
  });
});
