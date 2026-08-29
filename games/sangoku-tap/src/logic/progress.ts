/** ゲーム内通貨・最高進撃距離の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

const CURRENCY_KEY = "sangoku_tap_currency_v1";
const BEST_DISTANCE_KEY = "sangoku_tap_best_distance_v1";

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

export function loadBestDistance(): number {
  return loadNumber(BEST_DISTANCE_KEY);
}

export function saveBestDistance(distance: number): void {
  if (distance > loadBestDistance()) {
    localStorage.setItem(BEST_DISTANCE_KEY, String(distance));
  }
}
