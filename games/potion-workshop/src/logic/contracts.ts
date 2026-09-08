import type { GameState } from "./economy";
export function demandGenerator(prestigeCount: number): string {
  return ["apprentice", "garden", "cauldron"][prestigeCount % 3]!;
}
export function demandMultiplier(prestigeCount: number, id: string): number {
  return prestigeCount > 0 && demandGenerator(prestigeCount) === id ? 1.5 : 1;
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
    reputation: state.reputation + (index === 0 ? 1 : 3),
    completedContracts: [...state.completedContracts, index],
  };
}
