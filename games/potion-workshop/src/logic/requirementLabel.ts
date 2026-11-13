import { formatNumber } from "./economy";
import type { Lang } from "./i18n";

/** Read-only affordance: round shortages up so a fractional shortage never says zero. */
export function requirementLabel(available: number, cost: number, lang: Lang, action: "deliver" | "buy"): string {
  if (available >= cost) return lang === "ja"
    ? (action === "deliver" ? "納品できる ✓" : "購入できる ✓")
    : (action === "deliver" ? "Deliver now ✓" : "Buy now ✓");
  const remaining = formatNumber(Math.ceil(cost - available));
  return lang === "ja" ? `あと${remaining}` : `${remaining} more`;
}
