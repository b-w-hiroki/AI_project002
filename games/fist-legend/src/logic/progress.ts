/** ゲーム内通貨・戦績・編成の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

import { normalizeTeam, type FighterId } from "./team";

const CURRENCY_KEY = "fist_legend_currency_v1";
const WIN_COUNT_KEY = "fist_legend_win_count_v1";
const TEAM_KEY = "fist_legend_team_v1";
const STORY_PROGRESS_KEY = "fist_legend_story_progress_v1";

function loadNumber(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function loadCurrency(): number {
  return loadNumber(CURRENCY_KEY);
}

export function addCurrency(amount: number): number {
  const next = Math.max(0, loadCurrency() + amount);
  localStorage.setItem(CURRENCY_KEY, String(next));
  return next;
}

export function spendCurrency(amount: number): boolean {
  const current = loadCurrency();
  if (current < amount) return false;
  localStorage.setItem(CURRENCY_KEY, String(current - amount));
  return true;
}

export function loadWinCount(): number {
  return loadNumber(WIN_COUNT_KEY);
}

export function incrementWinCount(): number {
  const next = loadWinCount() + 1;
  localStorage.setItem(WIN_COUNT_KEY, String(next));
  return next;
}


export function loadTeam(): FighterId[] {
  const raw = localStorage.getItem(TEAM_KEY);
  if (!raw) return ["ryuga"];
  try {
    return normalizeTeam(JSON.parse(raw) as FighterId[]);
  } catch {
    return ["ryuga"];
  }
}

export function saveTeam(team: readonly FighterId[]): FighterId[] {
  const normalized = normalizeTeam(team);
  localStorage.setItem(TEAM_KEY, JSON.stringify(normalized));
  return normalized;
}


export function loadStoryProgress(): number {
  return Math.max(0, Math.floor(loadNumber(STORY_PROGRESS_KEY)));
}

export function saveStoryProgress(clearedChapters: number): number {
  const current = loadStoryProgress();
  const next = Math.max(current, Math.max(0, Math.floor(clearedChapters)));
  localStorage.setItem(STORY_PROGRESS_KEY, String(next));
  return next;
}
