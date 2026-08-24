import { describe, expect, it } from "vitest";
import {
  addOfflineCapBonus,
  applyOfflineProgress,
  buyClickUpgrade,
  buyClickUpgrades,
  buyGenerator,
  buyOfflineExtension,
  click,
  clickUpgradeCost,
  clickUpgradeCostForQuantity,
  essenceMultiplier,
  essenceOnPrestige,
  formatNumber,
  GENERATORS,
  generatorCost,
  maxAffordableClickUpgrades,
  newGame,
  OFFLINE_CAP_BASE_SEC,
  OFFLINE_CAP_MAX_SEC,
  offlineCapSec,
  OFFLINE_EXT_MAX_LEVEL,
  offlineExtensionCost,
  prestige,
  PRESTIGE_UNLOCK,
  productionPerSec,
  setOfflineCapBonus,
  tick,
} from "../src/logic/economy";
import { exportSaveJson, load, parseSaveJson, save, KVStore } from "../src/logic/save";
import { ACHIEVEMENTS, checkNewAchievements, unlockAchievements } from "../src/logic/achievements";

const apprentice = GENERATORS[0]!;

describe("generatorCost", () => {
  it("初回は baseCost", () => {
    expect(generatorCost(apprentice, 0)).toBe(15);
  });
  it("所持数に応じて costGrowth 倍で増える", () => {
    expect(generatorCost(apprentice, 1)).toBe(Math.ceil(15 * 1.15));
    expect(generatorCost(apprentice, 10)).toBe(Math.ceil(15 * 1.15 ** 10));
  });
});

describe("click / tick / production", () => {
  it("クリックで clickPower ぶん増える", () => {
    const s = click(newGame());
    expect(s.potions).toBe(1);
    expect(s.totalBrewed).toBe(1);
  });
  it("設備なしでは生産ゼロ", () => {
    expect(productionPerSec(newGame())).toBe(0);
    expect(tick(newGame(), 60).potions).toBe(0);
  });
  it("設備があれば baseRate × 台数 × dt で増える", () => {
    const s = { ...newGame(), counts: { ...newGame().counts, apprentice: 4 } };
    expect(productionPerSec(s)).toBeCloseTo(2);
    expect(tick(s, 10).potions).toBeCloseTo(20);
  });
});

describe("buyGenerator", () => {
  it("資金不足なら null", () => {
    expect(buyGenerator(newGame(), "apprentice")).toBeNull();
  });
  it("購入するとコストが引かれ台数が増える", () => {
    const s = buyGenerator({ ...newGame(), potions: 20 }, "apprentice")!;
    expect(s.potions).toBe(5);
    expect(s.counts["apprentice"]).toBe(1);
  });
  it("存在しないIDは null", () => {
    expect(buyGenerator({ ...newGame(), potions: 1e9 }, "nope")).toBeNull();
  });
});

describe("applyOfflineProgress", () => {
  const base = { ...newGame(), counts: { ...newGame().counts, apprentice: 2 } }; // 1/sec

  it("離席時間ぶん生産される", () => {
    const { state, gained } = applyOfflineProgress(base, 600);
    expect(gained).toBeCloseTo(600);
    expect(state.potions).toBeCloseTo(600);
  });
  it("拡張していなければ基本上限（12時間）でキャップされる", () => {
    const { gained } = applyOfflineProgress(base, OFFLINE_CAP_BASE_SEC * 10);
    expect(gained).toBeCloseTo(OFFLINE_CAP_BASE_SEC);
  });
  it("負の経過時間は無視", () => {
    expect(applyOfflineProgress(base, -100).gained).toBe(0);
  });
});

describe("save / load", () => {
  function memStore(): KVStore {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => m.set(k, v),
    };
  }

  it("保存して復元できる", () => {
    const store = memStore();
    const s = { ...newGame(), potions: 123, totalBrewed: 456 };
    save(s, store, 1_000_000);
    const loaded = load(store)!;
    expect(loaded.state.potions).toBe(123);
    expect(loaded.savedAt).toBe(1_000_000);
  });
  it("セーブが無ければ null", () => {
    expect(load(memStore())).toBeNull();
  });
  it("壊れたセーブは null", () => {
    const store = memStore();
    store.setItem("ai_project002_save_v1", "{broken");
    expect(load(store)).toBeNull();
  });
});

describe("formatNumber", () => {
  it("1000未満はそのまま", () => expect(formatNumber(999)).toBe("999"));
  it("小数は1桁まで表示", () => expect(formatNumber(0.5)).toBe("0.5"));
  it("K/M表記", () => {
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(2_300_000)).toBe("2.3M");
  });
});

describe("prestige", () => {
  it("100万未満では転生できない", () => {
    const s = { ...newGame(), totalBrewed: PRESTIGE_UNLOCK - 1 };
    expect(essenceOnPrestige(s)).toBe(0);
    expect(prestige(s)).toBeNull();
  });

  it("100万でエッセンス1、400万で2（平方根スケール）", () => {
    expect(essenceOnPrestige({ ...newGame(), totalBrewed: PRESTIGE_UNLOCK })).toBe(1);
    expect(essenceOnPrestige({ ...newGame(), totalBrewed: PRESTIGE_UNLOCK * 4 })).toBe(2);
  });

  it("転生で進行がリセットされエッセンスが積み上がる", () => {
    const s = {
      ...newGame(),
      potions: 999,
      totalBrewed: PRESTIGE_UNLOCK * 4,
      essence: 3,
      prestigeCount: 1,
      counts: { ...newGame().counts, apprentice: 10 },
    };
    const next = prestige(s)!;
    expect(next.potions).toBe(0);
    expect(next.counts["apprentice"]).toBe(0);
    expect(next.essence).toBe(5);
    expect(next.prestigeCount).toBe(2);
  });

  it("エッセンスで生産とクリックが+10%/個される", () => {
    const s = {
      ...newGame(),
      essence: 5,
      counts: { ...newGame().counts, apprentice: 2 }, // base 1/sec
    };
    expect(essenceMultiplier(s)).toBeCloseTo(1.5);
    expect(productionPerSec(s)).toBeCloseTo(1.5);
    expect(click({ ...newGame(), essence: 5 }).potions).toBeCloseTo(1.5);
  });
});

describe("buyClickUpgrade", () => {
  it("初回コストは50", () => {
    expect(clickUpgradeCost(newGame())).toBe(50);
  });
  it("資金不足なら null", () => {
    expect(buyClickUpgrade(newGame())).toBeNull();
  });
  it("購入で clickPower が+1しコストが増える", () => {
    const s1 = buyClickUpgrade({ ...newGame(), potions: 100 })!;
    expect(s1.clickPower).toBe(2);
    expect(s1.potions).toBe(50);
    expect(clickUpgradeCost(s1)).toBe(Math.ceil(50 * 1.6));
  });
});

describe("buyClickUpgrades（一括購入）", () => {
  it("qtyぶんのコスト合計は等比級数で計算される", () => {
    const s = newGame();
    const c1 = clickUpgradeCost(s); // 50
    const c2 = Math.ceil(50 * 1.6); // 2回目のコスト
    expect(clickUpgradeCostForQuantity(s, 2)).toBe(c1 + c2);
  });
  it("資金が足りる分だけ買え、余りは繰り越されない端数消費", () => {
    const total3 = clickUpgradeCostForQuantity(newGame(), 3);
    const s = buyClickUpgrades({ ...newGame(), potions: total3 }, 3)!;
    expect(s.clickPower).toBe(4); // 1 + 3
    expect(s.potions).toBe(0);
  });
  it("qtyより所持金が少なければ買える分だけ購入する（部分約定）", () => {
    const c1 = clickUpgradeCost(newGame()); // 50
    const s = buyClickUpgrades({ ...newGame(), potions: c1 }, 100)!;
    expect(s.clickPower).toBe(2); // 1回ぶんしか買えない
  });
  it("1回も買えなければ null", () => {
    expect(buyClickUpgrades(newGame(), 5)).toBeNull();
  });
  it("Infinity（MAX）を渡すと買えるだけ買う", () => {
    const s = buyClickUpgrades({ ...newGame(), potions: 100_000 }, Infinity)!;
    expect(s.clickPower).toBeGreaterThan(1);
    // 使い切っているか、次の1回が買えない額まで使っていることを確認
    expect(clickUpgradeCost(s)).toBeGreaterThan(s.potions);
  });
  it("maxAffordableClickUpgrades は実際に buyClickUpgrades(Infinity) と一致する", () => {
    const start = { ...newGame(), potions: 5_000 };
    const n = maxAffordableClickUpgrades(start);
    const bought = buyClickUpgrades(start, Infinity)!;
    expect(bought.clickPower).toBe(1 + n);
  });
});

describe("GENERATORS", () => {
  it("8種類の設備がある", () => {
    expect(GENERATORS.length).toBe(8);
  });
  it("ID重複が無い", () => {
    const ids = GENERATORS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("achievements", () => {
  it("初期状態では何も解除されていない", () => {
    expect(checkNewAchievements(newGame())).toEqual([]);
  });
  it("条件を満たすと新規実績として検出される", () => {
    const s = { ...newGame(), totalClicks: 1 };
    expect(checkNewAchievements(s)).toContain("first_click");
  });
  it("既に解除済みなら再検出しない", () => {
    const s = { ...newGame(), totalClicks: 1, unlockedAchievements: ["first_click"] };
    expect(checkNewAchievements(s)).not.toContain("first_click");
  });
  it("unlockAchievements で状態に反映される", () => {
    const s = unlockAchievements(newGame(), ["first_click", "click_100"]);
    expect(s.unlockedAchievements).toEqual(["first_click", "click_100"]);
  });
  it("全設備所持の実績はどれか1つでも0台なら満たさない", () => {
    const counts = Object.fromEntries(GENERATORS.map((g) => [g.id, 1]));
    counts[GENERATORS[0]!.id] = 0;
    const s = { ...newGame(), counts };
    expect(ACHIEVEMENTS.find((a) => a.id === "all_generators")!.check(s)).toBe(false);
  });
  it("転生してもlifetimeBrewedベースの実績は保持される", () => {
    const s = {
      ...newGame(),
      totalBrewed: PRESTIGE_UNLOCK,
      lifetimeBrewed: PRESTIGE_UNLOCK,
      unlockedAchievements: ["brewed_1m"],
    };
    const next = prestige(s)!;
    expect(next.unlockedAchievements).toEqual(["brewed_1m"]);
    expect(next.lifetimeBrewed).toBe(PRESTIGE_UNLOCK);
  });
});

describe("save export/import", () => {
  it("エクスポートしたJSONをインポートできる", () => {
    const s = { ...newGame(), potions: 42 };
    const json = exportSaveJson(s, 1000);
    const parsed = parseSaveJson(json)!;
    expect(parsed.state.potions).toBe(42);
    expect(parsed.savedAt).toBe(1000);
  });
  it("壊れたJSONは null", () => {
    expect(parseSaveJson("not json")).toBeNull();
  });
});

describe("オフライン上限（柔軟な拡張の仕組み）", () => {
  it("初期状態は基本上限（12時間）", () => {
    expect(offlineCapSec(newGame())).toBe(OFFLINE_CAP_BASE_SEC);
  });

  it("ソースを追加すると加算される", () => {
    const s = setOfflineCapBonus(newGame(), "buff_equipment", 3600);
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_BASE_SEC + 3600);
  });

  it("複数ソースは合算される（課金/強化/バフなど別々に管理できる）", () => {
    let s = setOfflineCapBonus(newGame(), "purchase", 3600 * 6);
    s = setOfflineCapBonus(s, "prestige_breakthrough", 3600 * 4);
    s = setOfflineCapBonus(s, "buff_equipment", 3600 * 2);
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_BASE_SEC + 3600 * 12);
  });

  it("同じソースを再設定しても二重加算されない（上書き）", () => {
    let s = setOfflineCapBonus(newGame(), "purchase", 3600 * 6);
    s = setOfflineCapBonus(s, "purchase", 3600 * 6); // 同じ値で再設定
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_BASE_SEC + 3600 * 6);
  });

  it("addOfflineCapBonus は既存の値に加算する", () => {
    let s = addOfflineCapBonus(newGame(), "buff_equipment", 1000);
    s = addOfflineCapBonus(s, "buff_equipment", 500);
    expect(s.offlineCapBonuses["buff_equipment"]).toBe(1500);
  });

  it("どれだけ加算しても絶対上限（72時間）を超えない", () => {
    const s = setOfflineCapBonus(newGame(), "purchase", 1_000_000);
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_MAX_SEC);
  });

  it("applyOfflineProgress は offlineCapSec の値でキャップする", () => {
    const base = {
      ...newGame(),
      counts: { ...newGame().counts, apprentice: 2 }, // 1/sec
    };
    const extended = setOfflineCapBonus(base, "buff_equipment", 3600);
    const { gained } = applyOfflineProgress(extended, (OFFLINE_CAP_BASE_SEC + 3600) * 10);
    expect(gained).toBeCloseTo(OFFLINE_CAP_BASE_SEC + 3600);
  });
});

describe("buyOfflineExtension", () => {
  it("essence不足なら null", () => {
    expect(buyOfflineExtension(newGame())).toBeNull();
  });

  it("購入するとレベルが上がりオフライン上限が伸びる", () => {
    const cost = offlineExtensionCost(newGame())!;
    const s = buyOfflineExtension({ ...newGame(), essence: cost })!;
    expect(s.offlineExtLevel).toBe(1);
    expect(s.essence).toBe(0);
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_BASE_SEC + 6 * 3600);
  });

  it("最大レベルに到達すると購入不可（null）になる", () => {
    let s = { ...newGame(), essence: 1_000_000_000 };
    for (let i = 0; i < OFFLINE_EXT_MAX_LEVEL; i++) {
      s = buyOfflineExtension(s)!;
      expect(s).not.toBeNull();
    }
    expect(s.offlineExtLevel).toBe(OFFLINE_EXT_MAX_LEVEL);
    expect(offlineExtensionCost(s)).toBeNull();
    expect(buyOfflineExtension(s)).toBeNull();
    // 満レベルでちょうど絶対上限（72時間）に到達する設計
    expect(offlineCapSec(s)).toBe(OFFLINE_CAP_MAX_SEC);
  });

  it("転生してもオフライン拡張レベル・ボーナスは保持される", () => {
    const cost = offlineExtensionCost(newGame())!;
    const extended = buyOfflineExtension({ ...newGame(), essence: cost })!;
    const s = {
      ...extended,
      totalBrewed: PRESTIGE_UNLOCK,
    };
    const next = prestige(s)!;
    expect(next.offlineExtLevel).toBe(1);
    expect(offlineCapSec(next)).toBe(OFFLINE_CAP_BASE_SEC + 6 * 3600);
  });
});
