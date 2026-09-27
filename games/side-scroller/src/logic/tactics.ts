import type { WeaponKind } from "./combat";
import type { CombatStyle } from "./style";
import type { EnemyType, WaveComposition } from "./waves";

export type TacticalPlan =
  | "boss_guard"
  | "swarm_pressure"
  | "tank_punish"
  | "agile_spacing"
  | "balanced";

export interface TacticalAdvice {
  plan: TacticalPlan;
  preferredWeapon: WeaponKind;
  ja: string;
  en: string;
}

function dominantEnemyType(composition: WaveComposition): EnemyType {
  const counts: Record<EnemyType, number> = { normal: 0, agile: 0, tank: 0 };
  for (const enemy of composition.enemies) counts[enemy.type] += 1;
  return (Object.entries(counts) as Array<[EnemyType, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "normal";
}

export function tacticalAdvice(
  style: CombatStyle,
  weapon: WeaponKind,
  composition: WaveComposition,
): TacticalAdvice {
  if (composition.kind === "boss") {
    return {
      plan: "boss_guard",
      preferredWeapon: "mid",
      ja: "BOSS：予兆でGRD → 突進後の隙にSKL。中距離で間合いを保つ",
      en: "BOSS: GRD on tell → SKL after the charge. Keep mid-range spacing",
    };
  }

  if (composition.kind === "swarm") {
    return style === "chain"
      ? {
          plan: "swarm_pressure",
          preferredWeapon: weapon === "ranged" ? "ranged" : "melee",
          ja: "大量発生：連撃を切らさず押し切る。囲まれる前に位置を変える",
          en: "SWARM: Keep the combo alive and reposition before getting surrounded",
        }
      : {
          plan: "agile_spacing",
          preferredWeapon: "ranged",
          ja: "大量発生：距離を作って遠距離。居合は孤立した敵へ",
          en: "SWARM: Create space and use ranged attacks; save Draw strikes for isolated targets",
        };
  }

  const dominant = dominantEnemyType(composition);
  if (dominant === "tank") {
    return {
      plan: "tank_punish",
      preferredWeapon: style === "draw" ? "mid" : "melee",
      ja:
        style === "draw"
          ? "重装多め：1.2秒間合いを作り、居合の一撃を通す"
          : "重装多め：連撃で防御を削り、SKLで押し込む",
      en:
        style === "draw"
          ? "TANKS: Create 1.2s of space, then punish with a Draw strike"
          : "TANKS: Shred defense with chained hits, then press with SKL",
    };
  }

  if (dominant === "agile") {
    return {
      plan: "agile_spacing",
      preferredWeapon: "ranged",
      ja:
        style === "chain"
          ? "敏捷多め：連撃を維持しつつ、遠距離で逃げ道を作る"
          : "敏捷多め：距離を取り、飛び込んだ瞬間に居合を合わせる",
      en:
        style === "chain"
          ? "AGILE: Maintain pressure and use ranged attacks to make space"
          : "AGILE: Create space and time the Draw strike as they rush in",
    };
  }

  return {
    plan: "balanced",
    preferredWeapon: style === "draw" ? "mid" : weapon,
    ja:
      style === "draw"
        ? "通常Wave：間合いを作って居合。硬い敵には中距離を使う"
        : "通常Wave：連撃を維持。敵が散ったら武器を切り替える",
    en:
      style === "draw"
        ? "WAVE: Create space for Draw strikes; use mid-range against tougher targets"
        : "WAVE: Keep the combo flowing and switch weapons when enemies spread out",
  };
}
