import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function installStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  });
  return map;
}

beforeEach(() => installStorage());
afterEach(() => vi.unstubAllGlobals());

import {
  loadBestDistance,
  loadCurrency,
  loadEquipmentInventory,
  loadEquippedMap,
  loadOwnedGenerals,
} from "../src/logic/progress";

describe("progress durability", () => {
  it("negative/invalid numeric saves fall back safely", () => {
    installStorage({
      sangoku_tap_currency_v1: "-20",
      sangoku_tap_best_distance_v1: "Infinity",
    });
    expect(loadCurrency()).toBe(0);
    expect(loadBestDistance()).toBe(0);
  });

  it("inventory counts are clamped to non-negative integers", () => {
    installStorage({
      sangoku_tap_equipment_inventory_v1: JSON.stringify({ Common: -3, Rare: 2.9, Epic: "bad" }),
    });
    expect(loadEquipmentInventory()).toEqual({ Common: 0, Rare: 2, Epic: 0 });
  });

  it("owned generals ignore invalid counts", () => {
    installStorage({
      sangoku_tap_owned_generals_v1: JSON.stringify({ good: 2.8, bad: -1, nope: "x" }),
    });
    expect(loadOwnedGenerals()).toEqual({ good: 2 });
  });

  it("equipped map ignores invalid rarities", () => {
    installStorage({
      sangoku_tap_equipped_map_v1: JSON.stringify({ a: "Rare", b: "Legendary", c: "Epic" }),
    });
    expect(loadEquippedMap()).toEqual({ a: "Rare", c: "Epic" });
  });
});
