import { GameState } from "./economy";

export interface AchievementDef {
  id: string;
  check: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first_click", check: (s) => s.totalClicks >= 1 },
  { id: "click_100", check: (s) => s.totalClicks >= 100 },
  { id: "click_1000", check: (s) => s.totalClicks >= 1_000 },
  { id: "brewed_1k", check: (s) => s.lifetimeBrewed >= 1_000 },
  { id: "brewed_1m", check: (s) => s.lifetimeBrewed >= 1_000_000 },
  { id: "brewed_1b", check: (s) => s.lifetimeBrewed >= 1_000_000_000 },
  { id: "first_prestige", check: (s) => s.prestigeCount >= 1 },
  { id: "prestige_5", check: (s) => s.prestigeCount >= 5 },
  { id: "essence_10", check: (s) => s.essence >= 10 },
  { id: "all_generators", check: (s) => Object.values(s.counts).every((c) => c >= 1) },
];

/** state 時点で満たしているのに unlocked に無い実績IDを返す */
export function checkNewAchievements(state: GameState): string[] {
  const unlocked = new Set(state.unlockedAchievements);
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(state)).map((a) => a.id);
}

/** 新規実績を state に反映 */
export function unlockAchievements(state: GameState, ids: string[]): GameState {
  if (ids.length === 0) return state;
  return {
    ...state,
    unlockedAchievements: [...state.unlockedAchievements, ...ids],
  };
}
