import { GENERAL_POOL } from "./general";
import { regionById, type RegionId } from "./regions";
import { effectiveAtk, type EquippedMap, type OwnedGenerals } from "./roster";
export type Role = "猛将" | "守将" | "軍師" | "商才";
export const ROLES: Record<string, Role> = {
  gen_hakuen: "猛将",
  gen_soujin: "猛将",
  gen_guren: "商才",
  gen_genbu: "守将",
  gen_suzaku: "軍師",
  gen_seiryu: "軍師",
  gen_kohei: "商才",
  gen_ashigaru: "守将",
};
export const ROLE_HINTS: Record<Role, string> = {
  猛将: "戦力 +15%",
  守将: "損耗 -25%",
  軍師: "山道の勝率 +12%",
  商才: "収穫 +20%",
};
export interface Troop {
  ids: string[];
  power: number;
  guard: number;
  scout: number;
  merchant: number;
}
export function validParty(
  ids: readonly string[],
  owned: OwnedGenerals,
): string[] {
  return [...new Set(ids)]
    .filter(
      (id) => GENERAL_POOL.some((g) => g.id === id) && (owned[id] ?? 0) > 0,
    )
    .slice(0, 3);
}
export function buildTroop(
  ids: readonly string[],
  owned: OwnedGenerals,
  equipped: EquippedMap,
): Troop {
  const party = validParty(ids, owned);
  const count = (role: Role) => party.filter((id) => ROLES[id] === role).length;
  const base = party.reduce(
    (n, id) =>
      n +
      effectiveAtk(
        GENERAL_POOL.find((g) => g.id === id)!,
        equipped,
      ),
    0,
  );
  return {
    ids: party,
    power: Math.round(base * (1 + count("猛将") * 0.15)),
    guard: Math.min(0.6, count("守将") * 0.25),
    scout: Math.min(0.3, count("軍師") * 0.12),
    merchant: 1 + count("商才") * 0.2,
  };
}
export type Route = "road" | "mountain";
export interface Expedition {
  id: string;
  regionId: RegionId;
  troop: Troop;
  step: number;
  hp: number;
  loot: number;
  route: Route;
  fork: boolean;
  status: "active" | "clear" | "retreat" | "defeat";
  message: string;
}
export function newExpedition(
  troop: Troop,
  regionId: RegionId = "plains",
): Expedition {
  return {
    id: crypto.randomUUID(),
    regionId,
    troop,
    step: 0,
    hp: 100,
    loot: 0,
    route: "road",
    fork: false,
    status: "active",
    message: `${regionById(regionId).name}へ出発。10地点先の関門を目指そう。`,
  };
}
export function chooseRoute(run: Expedition, route: Route): Expedition {
  return run.status === "active" && run.fork
    ? {
        ...run,
        route,
        fork: false,
        message:
          route === "road"
            ? "街道へ。安全を優先して進む。"
            : "山道へ。強敵の先には多くの財宝。",
      }
    : run;
}
export function victoryChance(run: Expedition): number {
  const threat =
    70 +
    regionById(run.regionId).threat +
    (run.step + 1) * 11 +
    (run.route === "mountain" ? 35 : 0) +
    (run.step === 9 ? 30 : 0);
  return Math.max(
    0.15,
    Math.min(
      0.92,
      run.troop.power / (run.troop.power + threat) +
        0.22 +
        (run.route === "mountain" ? run.troop.scout : 0),
    ),
  );
}
export function advanceExpedition(
  run: Expedition,
  rng: () => number = Math.random,
): Expedition {
  if (run.status !== "active" || run.fork || !run.troop.ids.length) return run;
  const step = run.step + 1;
  const battle = step === 10 || rng() < 0.55;
  const won = !battle || rng() < victoryChance(run);
  const loss = battle ? Math.ceil((won ? 9 : 32) * (1 - run.troop.guard)) : 0;
  const hp = Math.max(0, run.hp - loss);
  const earned = won
    ? Math.round(
        (12 + step * 4) *
          (run.route === "mountain" ? 1.7 : 1) *
          run.troop.merchant *
          regionById(run.regionId).reward,
      )
    : 0;
  const status =
    hp === 0 ? "defeat" : step === 10 ? (won ? "clear" : "retreat") : "active";
  return {
    ...run,
    step,
    hp,
    loot: run.loot + earned,
    fork: status === "active" && (step === 3 || step === 7),
    status,
    message: battle
      ? `${step === 10 ? "関門戦" : "小競り合い"}：${won ? "勝利" : "撤退"}。兵力 -${loss}${earned ? ` ／ +${earned} 銭` : ""}`
      : `街道の財宝を発見。+${earned} 銭`,
  };
}
export function returnExpedition(run: Expedition): Expedition {
  return run.status === "active"
    ? {
        ...run,
        status: "retreat",
        fork: false,
        message: "無理せず帰還。収穫を次の遠征へ。",
      }
    : run;
}
export function expeditionReward(run: Expedition): number {
  return run.status === "active"
    ? 0
    : Math.floor(run.loot * (run.status === "defeat" ? 0.5 : 1));
}
