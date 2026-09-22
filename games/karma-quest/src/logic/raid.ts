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
    const parsed = JSON.parse(raw) as Partial<RaidState>;
    const level = Math.max(1, Math.floor(Number(parsed.level) || 1));
    const defeats = Math.max(0, Math.floor(Number(parsed.defeats) || 0));
    const maxHp = raidMaxHp(level);
    const hp = Math.min(maxHp, Math.max(0, Number(parsed.hp) || 0));
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
