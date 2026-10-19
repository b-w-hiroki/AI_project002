/** Compact Japanese HUD values; truncate so the display never promises unearned points. */
export function scoreDisplay(value: number): string {
  for (const [unit, suffix] of [[1e12, "兆"], [1e8, "億"], [1e4, "万"]] as const) {
    if (value >= unit) return `${Math.floor(value / (unit / 10)) / 10}${suffix}`;
  }
  return String(value);
}
