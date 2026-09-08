import type { Highlight } from "./report";
export type Deity = "valor" | "mercy";
export type DeedTag = "valor" | "mercy" | "wisdom";
export interface Deed extends Highlight {
  tag: DeedTag;
}
export const DEITIES: Record<Deity, { name: string; wish: string }> = {
  valor: { name: "軍神", wish: "武勇を求める。次年は強敵と大きな加護" },
  mercy: { name: "慈愛神", wish: "支援と生還を好む。次年は安定した加護" },
};
export function scoreDeeds(selected: readonly Deed[], deity: Deity): number {
  const unique = selected
    .filter((d, i) => selected.findIndex((x) => x.id === d.id) === i)
    .slice(0, 2);
  return unique.reduce(
    (sum, d) => sum + 4 + (d.tag === deity ? 8 : d.tag === "wisdom" ? 4 : 0),
    0,
  );
}
export function nextMandate(
  selected: readonly Deed[],
  deity: Deity,
): { bonus: number; threat: number; label: string } {
  const score = scoreDeeds(selected, deity);
  return deity === "valor"
    ? { bonus: score / 120, threat: 1, label: "軍神の試練：強敵 +1段階／加護" }
    : {
        bonus: score / 240,
        threat: 0,
        label: "慈愛神の祝福：通常の討伐／加護",
      };
}
export function legendTitle(valor: number, mercy: number): string {
  if (valor > mercy * 1.5) return "戦場に名を刻む勇者";
  if (mercy > valor * 1.5) return "人々の灯を守る勇者";
  return "剣と慈悲を携える勇者";
}
