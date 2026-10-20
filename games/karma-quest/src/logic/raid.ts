import type { HeroStats } from "./karma";

export interface RaidState {
  level: number;
  hp: number;
  maxHp: number;
  defeats: number;
}

export interface RaidAttackResult {
  next: RaidState;
  damage: number;
  defeated: boolean;
}

export interface RaidStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const RAID_KEY = "karma_quest_solo_raid_v1";

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function raidMaxHp(level: number): number {
  return 900 + Math.max(0, level - 1) * 350;
}

export function newRaid(level = 1, defeats = 0): RaidState {
  const maxHp = raidMaxHp(level);
  return { level, hp: maxHp, maxHp, defeats };
}

export function loadRaid(store: RaidStore): RaidState {
  const raw = store.getItem(RAID_KEY);
  if (!raw) return newRaid();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return newRaid();
    const record = parsed as Partial<Record<keyof RaidState, unknown>>;
    // Save files contain numbers. Do not coerce missing/null/string HP to zero:
    // zero is an actual defeated boss with a reward waiting to be claimed.
    // HP belongs to a specific boss. Never transfer a corrupt boss's zero HP
    // onto level 1: that would manufacture a claimable defeat during recovery.
    if (!nonNegativeInteger(record.level) || record.level < 1
      || !Number.isSafeInteger(raidMaxHp(record.level + 1))) return newRaid();
    const level = record.level;
    const defeats = nonNegativeInteger(record.defeats) && record.defeats < Number.MAX_SAFE_INTEGER ? record.defeats : 0;
    const maxHp = raidMaxHp(level);
    const hp = nonNegativeInteger(record.hp) ? Math.min(maxHp, record.hp) : maxHp;
    return { level, hp, maxHp, defeats };
  } catch {
    return newRaid();
  }
}

export function saveRaid(store: RaidStore, state: RaidState): void {
  store.setItem(RAID_KEY, JSON.stringify(state));
}

/** 攻撃・魔力を主軸に、防御と体力も少し火力へ還元する。 */
export function raidDamage(stats: HeroStats): number {
  return Math.max(
    1,
    Math.round(stats.atk * 5 + stats.magic * 4 + stats.def * 2 + stats.hp * 0.35),
  );
}

export function attackRaid(state: RaidState, stats: HeroStats): RaidAttackResult {
  if (state.hp <= 0) return { next: state, damage: 0, defeated: true };
  const damage = Math.min(state.hp, raidDamage(stats));
  const hp = Math.max(0, state.hp - damage);
  return {
    next: { ...state, hp },
    damage,
    defeated: hp === 0,
  };
}

export function raidReward(state: RaidState): number {
  return 80 + Math.max(0, state.level - 1) * 20;
}

export function advanceRaid(state: RaidState): RaidState {
  return newRaid(state.level + 1, state.defeats + 1);
}
