export type CombatStyle = "chain" | "draw";
export function styleMultiplier(
  style: CombatStyle,
  combo: number,
  quietMs: number,
): number {
  return style === "chain"
    ? 1 + Math.min(Math.max(0, combo), 10) * 0.06
    : quietMs >= 1200
      ? 1.9
      : 1;
}
export function bossPhase(elapsed: number): "tell" | "charge" | "recover" {
  const t = ((elapsed % 3000) + 3000) % 3000;
  return t < 1000 ? "tell" : t < 1600 ? "charge" : "recover";
}
