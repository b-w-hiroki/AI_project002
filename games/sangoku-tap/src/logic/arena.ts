import type { Campaign } from "./campaign";
import type { Troop } from "./expedition";

export type ArenaTier = "Bronze" | "Silver" | "Gold" | "Legend";

export interface ArenaEntry {
  name: string;
  rating: number;
  self?: boolean;
}

export interface ArenaSnapshot {
  rating: number;
  rank: number;
  tier: ArenaTier;
  entries: ArenaEntry[];
  nextGap: number;
}

const RIVALS: readonly ArenaEntry[] = [
  { name: "白狼軍", rating: 5200 },
  { name: "赤壁連隊", rating: 4100 },
  { name: "蒼天義軍", rating: 3000 },
  { name: "虎牢守備隊", rating: 2100 },
  { name: "江東遊撃隊", rating: 1350 },
  { name: "新兵連合", rating: 700 },
] as const;

export function armyRating(
  troop: Pick<Troop, "power">,
  campaign: Pick<Campaign, "merit" | "training" | "cleared">,
  bestDistance: number,
): number {
  return Math.max(
    0,
    Math.round(
      troop.power * 10 +
      campaign.merit * 35 +
      campaign.training * 160 +
      campaign.cleared.length * 600 +
      Math.max(0, bestDistance) * 25,
    ),
  );
}

export function arenaTier(rating: number): ArenaTier {
  if (rating >= 4200) return "Legend";
  if (rating >= 2800) return "Gold";
  if (rating >= 1500) return "Silver";
  return "Bronze";
}

export function arenaSnapshot(
  troop: Pick<Troop, "power">,
  campaign: Pick<Campaign, "merit" | "training" | "cleared">,
  bestDistance: number,
): ArenaSnapshot {
  const rating = armyRating(troop, campaign, bestDistance);
  const player: ArenaEntry = { name: "あなたの軍勢", rating, self: true };
  const entries = [...RIVALS, player].sort(
    (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
  );
  const rank = entries.findIndex(entry => entry.self) + 1;
  const above = rank > 1 ? entries[rank - 2] : undefined;
  return {
    rating,
    rank,
    tier: arenaTier(rating),
    entries,
    nextGap: above ? Math.max(0, above.rating - rating + 1) : 0,
  };
}

export function arenaSummary(snapshot: ArenaSnapshot): string {
  return snapshot.rank === 1
    ? `軍勢評点 ${snapshot.rating} · ${snapshot.tier} · 首位`
    : `軍勢評点 ${snapshot.rating} · ${snapshot.tier} · ${snapshot.rank}/${snapshot.entries.length}位 · 次まで${snapshot.nextGap}`;
}
