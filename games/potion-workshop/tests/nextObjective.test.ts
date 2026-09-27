import { describe, expect, it } from "vitest";
import { newGame, PRESTIGE_UNLOCK } from "../src/logic/economy";
import { nextObjective } from "../src/logic/nextObjective";

describe("nextObjective", () => {
  it("starts with the first town order", () => {
    const objective = nextObjective(newGame());
    expect(objective.kind).toBe("contract");
    expect(objective.contractIndex).toBe(0);
    expect(objective.target).toBe(120);
  });

  it("moves to the second order after the first is complete", () => {
    const objective = nextObjective({ ...newGame(), completedContracts: [0] });
    expect(objective.kind).toBe("contract");
    expect(objective.contractIndex).toBe(1);
  });

  it("uses current town demand after both orders are complete", () => {
    const objective = nextObjective({
      ...newGame(),
      townIndex: 1,
      prestigeCount: 1,
      completedContracts: [0, 1],
    });
    expect(objective.kind).toBe("demand_generator");
    expect(objective.generatorId).toBe("garden");
  });

  it("promotes ascension as soon as it is available", () => {
    const objective = nextObjective({ ...newGame(), totalBrewed: PRESTIGE_UNLOCK });
    expect(objective.kind).toBe("ascend");
    expect(objective.essenceGain).toBe(1);
  });

  it("falls back to ascension progress when the town has no demand and orders are done", () => {
    const objective = nextObjective({
      ...newGame(),
      completedContracts: [0, 1],
      totalBrewed: PRESTIGE_UNLOCK / 2,
    });
    expect(objective.kind).toBe("prestige_progress");
    expect(objective.ratio).toBe(0.5);
  });
});
