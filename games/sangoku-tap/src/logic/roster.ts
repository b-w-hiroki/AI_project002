/**
 * 所持武将・装備の武将への装着ロジック（Phaser非依存の純粋関数）。
 * 企画書にあった「武将ガチャで集めた武将に装備を装着して強化する」を、
 * 個体差を持たせないシンプルな「1武将につき1つまで装備」の装着として実装する。
 */

import { EquipRarity } from "./breeding";
import { General } from "./general";

export type OwnedGenerals = Readonly<Record<string, number>>;

export function emptyRoster(): OwnedGenerals {
  return {};
}

export function addOwnedGeneral(roster: OwnedGenerals, generalId: string): OwnedGenerals {
  return { ...roster, [generalId]: (roster[generalId] ?? 0) + 1 };
}

export function isOwned(roster: OwnedGenerals, generalId: string): boolean {
  return (roster[generalId] ?? 0) > 0;
}

/** レアリティごとの装備によるATK加算量 */
const EQUIPMENT_ATK_BONUS: Readonly<Record<EquipRarity, number>> = {
  Common: 5,
  Rare: 15,
  Epic: 40,
};

export type EquippedMap = Readonly<Record<string, EquipRarity>>;

export function emptyEquipped(): EquippedMap {
  return {};
}

/** 武将に装備を装着する（既に何か装着していれば置き換える）。装備一覧の増減は呼び出し側で行う */
export function equipToGeneral(equipped: EquippedMap, generalId: string, rarity: EquipRarity): EquippedMap {
  return { ...equipped, [generalId]: rarity };
}

/** 武将の装備を外す */
export function unequipGeneral(equipped: EquippedMap, generalId: string): EquippedMap {
  const next = { ...equipped };
  delete next[generalId];
  return next;
}

/** 装備込みの実効ATKを算出する */
export function effectiveAtk(general: General, equipped: EquippedMap): number {
  const rarity = equipped[general.id];
  const bonus = rarity ? EQUIPMENT_ATK_BONUS[rarity] : 0;
  return general.atk + bonus;
}
