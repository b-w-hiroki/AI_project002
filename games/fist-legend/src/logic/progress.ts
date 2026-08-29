/** ゲーム内通貨・戦績の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const CURRENCY_KEY = "fist_legend_currency_v1";
const WIN_COUNT_KEY = "fist_legend_win_count_v1";

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
