import { contractCost, demandGenerator } from "./contracts";
import {
  GENERATORS,
  PRESTIGE_UNLOCK,
  essenceOnPrestige,
  generatorCost,
  type GameState,
} from "./economy";

export type NextObjectiveKind = "ascend" | "contract" | "demand_generator" | "prestige_progress";

export interface NextObjective {
  kind: NextObjectiveKind;
  current: number;
  target: number;
  ratio: number;
  contractIndex?: number;
  generatorId?: string;
  essenceGain?: number;
}

function ratio(current: number, target: number): number {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, current / target));
}

export function nextObjective(state: GameState): NextObjective {
  const essenceGain = essenceOnPrestige(state);
  if (essenceGain > 0) {
    return { kind: "ascend", current: 1, target: 1, ratio: 1, essenceGain };
  }

  for (const contractIndex of [0, 1]) {
    if (state.completedContracts.includes(contractIndex)) continue;
    const target = contractCost(state, contractIndex);
    return {
      kind: "contract",
      current: Math.min(state.potions, target),
      target,
      ratio: ratio(state.potions, target),
      contractIndex,
    };
  }

  const demanded = demandGenerator(state);
  if (demanded) {
    const def = GENERATORS.find((generator) => generator.id === demanded);
    if (def) {
      const target = generatorCost(def, state.counts[demanded] ?? 0);
      return {
        kind: "demand_generator",
        current: Math.min(state.potions, target),
        target,
        ratio: ratio(state.potions, target),
        generatorId: demanded,
      };
    }
  }

  return {
    kind: "prestige_progress",
    current: Math.min(state.totalBrewed, PRESTIGE_UNLOCK),
    target: PRESTIGE_UNLOCK,
    ratio: ratio(state.totalBrewed, PRESTIGE_UNLOCK),
  };
}
