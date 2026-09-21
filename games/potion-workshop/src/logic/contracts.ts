import type { GameState } from "./economy";
import { townForState } from "./towns";

export function demandGenerator(state: GameState): string | null {
  return townForState(state).demandGeneratorId;
}

export function demandMultiplier(state: GameState, id: string): number {
  const demanded = demandGenerator(state);
  return demanded !== null && demanded === id ? 1.5 : 1;
}

export function contractReward(state: GameState, index: number): number {
  const base = index === 0 ? 1 : 3;
  return Math.max(1, Math.round(base * townForState(state).contractRewardMultiplier));
}

export function contractCost(state: GameState, index: number): number {
  return (index === 0 ? 120 : 500) * (1 + Math.min(state.prestigeCount, 20));
}

export function fulfillContract(
  state: GameState,
  index: number,
): GameState | null {
  if (
    (index !== 0 && index !== 1) ||
    state.completedContracts.includes(index) ||
    state.potions < contractCost(state, index)
  )
    return null;
  return {
    ...state,
    potions: state.potions - contractCost(state, index),
    reputation: state.reputation + contractReward(state, index),
    completedContracts: [...state.completedContracts, index],
  };
}
