export interface LeagueEntry {
  name: string;
  rating: number;
  self?: boolean;
}

export interface LeagueSnapshot {
  rating: number;
  rank: number;
  tier: "Bronze" | "Silver" | "Gold" | "Legend";
  entries: LeagueEntry[];
  nextGap: number;
}

const RIVALS: readonly LeagueEntry[] = [
  { name: "鉄壁のガルド", rating: 2200 },
  { name: "星詠みミレイ", rating: 1650 },
  { name: "疾風のロウ", rating: 1180 },
  { name: "商都のセラ", rating: 820 },
  { name: "紅蓮のバルク", rating: 520 },
  { name: "新米勇者ノア", rating: 260 },
] as const;

export function leagueRating(totalEvaluation: number, bestStage: number): number {
  return Math.max(0, Math.floor(totalEvaluation + bestStage * 60));
}

export function leagueTier(rating: number): LeagueSnapshot["tier"] {
  if (rating >= 1800) return "Legend";
  if (rating >= 1100) return "Gold";
  if (rating >= 550) return "Silver";
  return "Bronze";
}

export function leagueSnapshot(totalEvaluation: number, bestStage: number): LeagueSnapshot {
  const rating = leagueRating(totalEvaluation, bestStage);
  const player: LeagueEntry = { name: "あなた / カイト", rating, self: true };
  const entries = [...RIVALS, player]
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const rank = entries.findIndex(entry => entry.self) + 1;
  const above = rank > 1 ? entries[rank - 2] : undefined;
  return {
    rating,
    rank,
    tier: leagueTier(rating),
    entries,
    nextGap: above ? Math.max(0, above.rating - rating + 1) : 0,
  };
}

export function formatLeague(snapshot: LeagueSnapshot): string {
  const lines = snapshot.entries.map((entry, index) => {
    const marker = entry.self ? "▶" : " ";
    return `${marker}${index + 1}位  ${entry.name}  ${entry.rating}`;
  });
  const next = snapshot.rank === 1
    ? "現在トップ。評価を伸ばして首位を守ろう。"
    : `次の順位まで あと ${snapshot.nextGap}`;
  return [
    `${snapshot.tier} LEAGUE  ·  Rating ${snapshot.rating}`,
    `現在 ${snapshot.rank}/${snapshot.entries.length}位`,
    "",
    ...lines,
    "",
    next,
  ].join("\n");
}
