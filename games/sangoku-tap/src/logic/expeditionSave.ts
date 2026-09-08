import { newExpedition, type Expedition } from "./expedition";
import { addEquipment, loadOwnedGenerals, saveOwnedGeneral } from "./progress";
import { regionById } from "./regions";
const KEY = "sangoku_expedition_v1";
const STARTER = "sangoku_starter_v1";
const PARTY = "sangoku_party_v1";
export function ensureStarter(): void {
  if (localStorage.getItem(STARTER)) return;
  const owned = loadOwnedGenerals();
  for (const id of ["gen_soujin", "gen_kohei", "gen_ashigaru"])
    if (!((owned[id] ?? 0) > 0)) saveOwnedGeneral(id);
  addEquipment("Common");
  addEquipment("Common");
  localStorage.setItem(STARTER, "1");
}
export function loadParty(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PARTY) ?? "null");
    return Array.isArray(v)
      ? v.filter((id): id is string => typeof id === "string")
      : ["gen_soujin", "gen_kohei", "gen_ashigaru"];
  } catch {
    return ["gen_soujin", "gen_kohei", "gen_ashigaru"];
  }
}
export function saveParty(ids: string[]): void {
  localStorage.setItem(PARTY, JSON.stringify(ids));
}
export function saveExpedition(run: Expedition | null): void {
  if (run) localStorage.setItem(KEY, JSON.stringify(run));
  else localStorage.removeItem(KEY);
}
export function loadExpedition(): Expedition | null {
  try {
    const v = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
    ) as Expedition | null;
    if (
      !v ||
      v.status !== "active" ||
      !Array.isArray(v.troop?.ids) ||
      !v.troop.ids.length ||
      ![
        v.step,
        v.hp,
        v.loot,
        v.troop.power,
        v.troop.guard,
        v.troop.scout,
        v.troop.merchant,
      ].every(Number.isFinite) ||
      v.step < 0 ||
      v.step >= 10 ||
      v.hp <= 0 ||
      v.hp > 100 ||
      v.loot < 0
    )
      return null;
    return {
      ...newExpedition(v.troop),
      ...v,
      regionId: regionById(v.regionId).id,
      id: typeof v.id === "string" && v.id ? v.id : crypto.randomUUID(),
    };
  } catch {
    return null;
  }
}
