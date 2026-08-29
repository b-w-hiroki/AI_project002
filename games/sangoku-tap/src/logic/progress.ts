/** ゲーム内通貨・最高進撃距離・所持装備の永続化（localStorage）。Phaser非依存の純粋関数として分離 */

import { EquipRarity } from "./breeding";

const CURRENCY_KEY = "sangoku_tap_currency_v1";
const BEST_DISTANCE_KEY = "sangoku_tap_best_distance_v1";
const EQUIPMENT_INVENTORY_KEY = "sangoku_tap_equipment_inventory_v1";

function loadNumber(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function loadCurrency(): number {
  return loadNumber(CURRENCY_KEY);
}

export function addCurrency(amount: number): number {
  const next = Math.max(0, loadCurrency() + amount);
  localStorage.setItem(CURRENCY_KEY, String(next));
  return next;
}

export function spendCurrency(amount: number): boolean {
  const current = loadCurrency();
  if (current < amount) return false;
  localStorage.setItem(CURRENCY_KEY, String(current - amount));
  return true;
}

export function loadBestDistance(): number {
  return loadNumber(BEST_DISTANCE_KEY);
}

export function saveBestDistance(distance: number): void {
  if (distance > loadBestDistance()) {
    localStorage.setItem(BEST_DISTANCE_KEY, String(distance));
  }
}

export type EquipmentInventory = Record<EquipRarity, number>;

function emptyInventory(): EquipmentInventory {
  return { Common: 0, Rare: 0, Epic: 0 };
}

/** 合成で得た装備は個体差を持たせず、レアリティごとの所持数のみを積み上げる簡略実装 */
export function loadEquipmentInventory(): EquipmentInventory {
  const raw = localStorage.getItem(EQUIPMENT_INVENTORY_KEY);
  if (!raw) return emptyInventory();
  try {
    const parsed = JSON.parse(raw) as Partial<EquipmentInventory>;
    return {
      Common: Number.isFinite(parsed.Common) ? Number(parsed.Common) : 0,
      Rare: Number.isFinite(parsed.Rare) ? Number(parsed.Rare) : 0,
      Epic: Number.isFinite(parsed.Epic) ? Number(parsed.Epic) : 0,
    };
  } catch {
    return emptyInventory();
  }
}

export function addEquipment(rarity: EquipRarity): EquipmentInventory {
  const inventory = loadEquipmentInventory();
  inventory[rarity] += 1;
  localStorage.setItem(EQUIPMENT_INVENTORY_KEY, JSON.stringify(inventory));
  return inventory;
}
