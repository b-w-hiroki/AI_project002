import { MAX_HP, OUGI_GAUGE_MAX, type BattleState } from "./battle";

export type HajaMode = "go" | "ju" | "shun";

export const HAJA_DURATION_MS = 5_000;
export const HAJA_SHUN_RECOVERY_MS = 190;

export const HAJA_MODE_INFO: Readonly<
  Record<
    HajaMode,
    {
      label: string;
      shortLabel: string;
      description: string;
      accent: number;
      glow: number;
    }
  >
> = {
  go: {
    label: "覇者・剛",
    shortLabel: "剛",
    description: "与ダメージ+40%",
    accent: 0xe6533f,
    glow: 0xffad66,
  },
  ju: {
    label: "覇者・柔",
    shortLabel: "柔",
    description: "被ダメージ50%軽減",
    accent: 0x4ca67a,
    glow: 0x8ce6bd,
  },
  shun: {
    label: "覇者・瞬",
    shortLabel: "瞬",
    description: "奥義加速・硬直短縮",
    accent: 0x576ccf,
    glow: 0xaebaff,
  },
};

export interface HajaAdjustment {
  state: BattleState;
  bonusDamage: number;
  preventedDamage: number;
  bonusGauge: number;
}

/**
 * 通常の戦闘解決後に、覇者モードぶんだけ差分補正する。
 * 既存の三すくみ・乱数・奥義ロジックは触らず、モード効果だけを後段に足す。
 */
export function applyHajaAfterBeat(
  before: BattleState,
  resolved: BattleState,
  mode: HajaMode | null,
): HajaAdjustment {
  if (!mode) {
    return { state: resolved, bonusDamage: 0, preventedDamage: 0, bonusGauge: 0 };
  }

  if (mode === "go") {
    const dealt = Math.max(0, before.enemyHp - resolved.enemyHp);
    const bonusDamage = Math.min(resolved.enemyHp, Math.round(dealt * 0.4));
    return {
      state: { ...resolved, enemyHp: Math.max(0, resolved.enemyHp - bonusDamage) },
      bonusDamage,
      preventedDamage: 0,
      bonusGauge: 0,
    };
  }

  if (mode === "ju") {
    const taken = Math.max(0, before.playerHp - resolved.playerHp);
    // 既存ロジック側でKO判定済みの一撃は復活させない。結果遷移との競合を避けるため。
    const preventedDamage = resolved.playerHp <= 0 ? 0 : Math.round(taken * 0.5);
    return {
      state: {
        ...resolved,
        playerHp: Math.min(MAX_HP, resolved.playerHp + preventedDamage),
      },
      bonusDamage: 0,
      preventedDamage,
      bonusGauge: 0,
    };
  }

  const gained = Math.max(0, resolved.playerGauge - before.playerGauge);
  const bonusGauge = Math.min(OUGI_GAUGE_MAX - resolved.playerGauge, gained);
  return {
    state: {
      ...resolved,
      playerGauge: Math.min(OUGI_GAUGE_MAX, resolved.playerGauge + bonusGauge),
    },
    bonusDamage: 0,
    preventedDamage: 0,
    bonusGauge,
  };
}
