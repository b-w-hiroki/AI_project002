export type FighterId = "ryuga" | "renka" | "gaku" | "mei";

export interface FighterProfile {
  id: FighterId;
  name: string;
  role: string;
  accent: number;
  specialty: "punch" | "kick" | "ki" | null;
}

export const FIGHTERS: readonly FighterProfile[] = [
  { id: "ryuga", name: "竜牙", role: "攻守の基準", accent: 0xffffff, specialty: null },
  { id: "renka", name: "蓮花", role: "連撃・拳", accent: 0xffb6c9, specialty: "punch" },
  { id: "gaku", name: "岳", role: "剛力・蹴", accent: 0xd6b078, specialty: "kick" },
  { id: "mei", name: "冥", role: "気功・気", accent: 0x9da8ff, specialty: "ki" },
] as const;

export const MAX_TEAM_SIZE = 3;

export function fighterById(id: FighterId): FighterProfile {
  return FIGHTERS.find(fighter => fighter.id === id) ?? FIGHTERS[0]!;
}

export function normalizeTeam(ids: readonly FighterId[]): FighterId[] {
  const valid = new Set(FIGHTERS.map(fighter => fighter.id));
  const unique = ids.filter((id, index) => valid.has(id) && ids.indexOf(id) === index);
  return (unique.length ? unique : ["ryuga"]).slice(0, MAX_TEAM_SIZE) as FighterId[];
}

export function toggleTeamMember(team: readonly FighterId[], id: FighterId): FighterId[] {
  const current = normalizeTeam(team);
  if (current.includes(id)) {
    if (current.length === 1) return current;
    return current.filter(member => member !== id);
  }
  if (current.length >= MAX_TEAM_SIZE) return current;
  return [...current, id];
}

export function teamLabel(team: readonly FighterId[]): string {
  return normalizeTeam(team).map(id => fighterById(id).name).join(" / ");
}


/** 得意技は通常技ダメージを18%だけ伸ばす。交代の意味を持たせつつ、固定キャラ必須にはしない。 */
export function fighterMoveMultiplier(
  id: FighterId,
  move: "punch" | "kick" | "ki",
): number {
  const fighter = fighterById(id);
  return fighter.specialty === move ? 1.18 : 1;
}
