import { describe, expect, it } from "vitest";
import {
  ARMOR_TEMPLATES,
  BASE_EQUIPMENT_MAX_LEVEL,
  ITEM_DEFS,
  MAX_ENHANCE_LEVEL,
  MAX_EVOLUTION_STAGE,
  RARITIES,
  RUN_ENHANCE_MAX_STAGE,
  STAGE_BUFF_POOL,
  WEAPON_TEMPLATES,
  assignLoadoutSlot,
  baseEquipmentStats,
  craftAtBlacksmith,
  damageArmor,
  effectiveStats,
  enhanceWeapon,
  evolveWeapon,
  findArmorTemplate,
  findItemDef,
  findTemplate,
  gainProficiency,
  isArmorBroken,
  loadLoadout,
  newLoadout,
  newLoadoutSave,
  openChest,
  proficiencyComboBonus,
  resolveSummon,
  rollStageBuffOptions,
  rollWeaponInstance,
  runEffectiveStats,
  saveLoadout,
  stackRunWeapon,
  summonRunWeapon,
  toWeaponDef,
  useItem,
  type KVStore,
} from "../src/logic/loadout";

describe("rollWeaponInstance", () => {
  it("レア度の品質範囲内でロールされる", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const def = RARITIES.SR;
    expect(inst.baseQuality).toBeGreaterThanOrEqual(def.qualityMin);
    expect(inst.baseQuality).toBeLessThanOrEqual(def.qualityMax);
    expect(inst.enhanceLevel).toBe(0);
    expect(inst.evolutionStage).toBe(0);
  });
  it("rng=0とrng=1でそれぞれ下限・上限になる", () => {
    const lo = rollWeaponInstance("iron_sword", "R", () => 0);
    const hi = rollWeaponInstance("iron_sword", "R", () => 1);
    expect(lo.baseQuality).toBeCloseTo(RARITIES.R.qualityMin);
    expect(hi.baseQuality).toBeCloseTo(RARITIES.R.qualityMax);
  });
});

describe("effectiveStats", () => {
  it("レア度が高いほど総合力（パワー×距離）が高くなる傾向がある", () => {
    const low = rollWeaponInstance("iron_sword", "N", () => 1); // Nの最大品質
    const high = rollWeaponInstance("iron_sword", "UR", () => 0); // URの最小品質
    const lowStats = effectiveStats(low);
    const highStats = effectiveStats(high);
    expect(highStats.power).toBeGreaterThan(lowStats.power);
    expect(highStats.range).toBeGreaterThan(lowStats.range);
  });
  it("距離重視のテンプレート（戦槍）は同品質の剣より距離が長い", () => {
    const spear = rollWeaponInstance("war_spear", "SR", () => 0.5);
    const sword = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    expect(effectiveStats(spear).range).toBeGreaterThan(effectiveStats(sword).range);
  });
  it("未知のテンプレートIDなら例外", () => {
    const bogus = rollWeaponInstance("nope", "N", () => 0.5);
    expect(() => effectiveStats(bogus)).toThrow();
  });
});

describe("enhanceWeapon / evolveWeapon", () => {
  it("強化するとパワーが上がり速さ(ms)が下がる", () => {
    const base = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const enhanced = enhanceWeapon(base);
    expect(enhanced.enhanceLevel).toBe(1);
    expect(effectiveStats(enhanced).power).toBeGreaterThan(effectiveStats(base).power);
    expect(effectiveStats(enhanced).swingSpeedMs).toBeLessThan(effectiveStats(base).swingSpeedMs);
  });
  it("最大強化レベルを超えては上がらない", () => {
    let inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    for (let i = 0; i < MAX_ENHANCE_LEVEL + 5; i++) inst = enhanceWeapon(inst);
    expect(inst.enhanceLevel).toBe(MAX_ENHANCE_LEVEL);
  });
  it("強化最大に達するまでは進化できない", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    expect(evolveWeapon(inst)).toEqual(inst);
  });
  it("強化最大に達すると進化でき、強化レベルは0に戻る", () => {
    let inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    for (let i = 0; i < MAX_ENHANCE_LEVEL; i++) inst = enhanceWeapon(inst);
    const evolved = evolveWeapon(inst);
    expect(evolved.evolutionStage).toBe(1);
    expect(evolved.enhanceLevel).toBe(0);
  });
  it("進化上限を超えては進化しない", () => {
    let inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    for (let cycle = 0; cycle < MAX_EVOLUTION_STAGE + 2; cycle++) {
      for (let i = 0; i < MAX_ENHANCE_LEVEL; i++) inst = enhanceWeapon(inst);
      inst = evolveWeapon(inst);
    }
    expect(inst.evolutionStage).toBe(MAX_EVOLUTION_STAGE);
  });
});

describe("proficiency", () => {
  it("熟練度が閾値に達するとコンボボーナスが増える", () => {
    let inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    expect(proficiencyComboBonus(inst)).toBe(0);
    inst = gainProficiency(inst, 500);
    expect(proficiencyComboBonus(inst)).toBe(1);
  });
  it("コンボボーナスには上限がある", () => {
    let inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    inst = gainProficiency(inst, 100000);
    expect(proficiencyComboBonus(inst)).toBeLessThanOrEqual(3);
  });
});

describe("findTemplate / WEAPON_TEMPLATES", () => {
  it("既知のIDでテンプレートが取得できる", () => {
    expect(findTemplate("iron_sword")?.kind).toBe("melee");
  });
  it("各武器種別に複数のテンプレートがある", () => {
    for (const kind of ["melee", "mid", "ranged"] as const) {
      expect(WEAPON_TEMPLATES.filter((t) => t.kind === kind).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("openChest / craftAtBlacksmith", () => {
  it("宝箱はテンプレートとレア度をロールして個体を返す", () => {
    const inst = openChest(WEAPON_TEMPLATES, undefined, () => 0.99);
    expect(findTemplate(inst.templateId)).toBeDefined();
    expect(RARITIES[inst.rarity]).toBeDefined();
  });
  it("鍛治は通貨が足りなければ null", () => {
    expect(craftAtBlacksmith("iron_sword", "UR", 0)).toBeNull();
  });
  it("鍛治は通貨が足りれば確定入手できる", () => {
    const result = craftAtBlacksmith("iron_sword", "R", 10000, () => 0.5);
    expect(result).not.toBeNull();
    expect(result?.instance.templateId).toBe("iron_sword");
    expect(result?.instance.rarity).toBe("R");
  });
});

describe("Loadout", () => {
  it("初期状態は全スロット未設定", () => {
    const lo = newLoadout();
    expect(lo.melee).toBeNull();
    expect(lo.mid).toBeNull();
    expect(lo.ranged).toBeNull();
  });
  it("所持している個体をスロットに設定できる", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const lo = assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id);
    expect(lo.melee).toBe(inst.id);
  });
  it("種別が一致しない個体は設定できない", () => {
    const inst = rollWeaponInstance("war_spear", "SR", () => 0.5); // mid武器
    const lo = assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id);
    expect(lo.melee).toBeNull();
  });
  it("所持していない個体IDは設定できない", () => {
    const lo = assignLoadoutSlot(newLoadout(), [], "melee", "not_owned");
    expect(lo.melee).toBeNull();
  });
  it("nullを渡すとスロットを解除できる", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    let lo = assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id);
    lo = assignLoadoutSlot(lo, [inst], "melee", null);
    expect(lo.melee).toBeNull();
  });
});

describe("baseEquipmentStats", () => {
  it("ロードアウト武器の最高品質より弱い", () => {
    const base = baseEquipmentStats("melee", BASE_EQUIPMENT_MAX_LEVEL);
    const topLoadout = effectiveStats(rollWeaponInstance("iron_sword", "UR", () => 1));
    expect(base.power).toBeLessThan(topLoadout.power);
  });
  it("レベルが上がるほど強くなる", () => {
    const lv0 = baseEquipmentStats("melee", 0);
    const lvMax = baseEquipmentStats("melee", BASE_EQUIPMENT_MAX_LEVEL);
    expect(lvMax.power).toBeGreaterThan(lv0.power);
  });
});

describe("インゲーム内重複強化（RunWeaponState）", () => {
  it("召喚直後はstage0", () => {
    expect(summonRunWeapon("id1").stage).toBe(0);
  });
  it("SR未満のレア度はアルティメット化（stage3）できない", () => {
    let state = summonRunWeapon("id1");
    state = stackRunWeapon(state, "R");
    state = stackRunWeapon(state, "R");
    state = stackRunWeapon(state, "R"); // stage3への遷移はブロックされる
    expect(state.stage).toBe(2);
  });
  it("SR以上ならアルティメット化（stage3）まで到達できる", () => {
    let state = summonRunWeapon("id1");
    state = stackRunWeapon(state, "SR");
    state = stackRunWeapon(state, "SR");
    state = stackRunWeapon(state, "SR");
    expect(state.stage).toBe(RUN_ENHANCE_MAX_STAGE);
  });
  it("最大段階を超えては伸びない", () => {
    let state = summonRunWeapon("id1");
    for (let i = 0; i < 10; i++) state = stackRunWeapon(state, "SR");
    expect(state.stage).toBe(RUN_ENHANCE_MAX_STAGE);
  });
  it("段階が進むほどパワーが上がり速さ(ms)が下がる", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const stats = effectiveStats(inst);
    const s0 = runEffectiveStats(stats, summonRunWeapon("id1"));
    const s3 = runEffectiveStats(stats, { instanceId: "id1", stage: 3 });
    expect(s3.power).toBeGreaterThan(s0.power);
    expect(s3.swingSpeedMs).toBeLessThan(s0.swingSpeedMs);
    expect(s3.comboHits).toBeGreaterThanOrEqual(s0.comboHits);
  });
});

describe("toWeaponDef", () => {
  it("BaseWeaponStats を WeaponDef 形式に変換する", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const stats = effectiveStats(inst);
    const def = toWeaponDef(stats, "melee");
    expect(def.range).toBe(stats.range);
    expect(def.damage).toBe(stats.power);
    expect(def.cooldownMs).toBe(stats.swingSpeedMs);
    expect(def.projectile).toBe(false);
  });
  it("遠距離は projectile: true になる", () => {
    const inst = rollWeaponInstance("short_bow", "SR", () => 0.5);
    const def = toWeaponDef(effectiveStats(inst), "ranged");
    expect(def.projectile).toBe(true);
  });
});

describe("resolveSummon", () => {
  it("スロットが未設定なら null", () => {
    expect(resolveSummon(newLoadout(), [], "melee", undefined)).toBeNull();
  });
  it("所持していない個体を指しているなら null", () => {
    const lo = { melee: "not_owned", mid: null, ranged: null };
    expect(resolveSummon(lo, [], "melee", undefined)).toBeNull();
  });
  it("初回召喚は stage0", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const lo = assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id);
    const result = resolveSummon(lo, [inst], "melee", undefined);
    expect(result?.runState.stage).toBe(0);
    expect(result?.instance.id).toBe(inst.id);
  });
  it("同じ個体を再度召喚すると重複強化が進む", () => {
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const lo = assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id);
    const first = resolveSummon(lo, [inst], "melee", undefined)!;
    const second = resolveSummon(lo, [inst], "melee", first.runState)!;
    expect(second.runState.stage).toBe(1);
    expect(second.stats.power).toBeGreaterThan(first.stats.power);
  });
  it("別の個体を召喚した場合は重複強化にならず新規stage0になる", () => {
    const swordA = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const swordB = rollWeaponInstance("greatsword", "SR", () => 0.5);
    const lo = assignLoadoutSlot(newLoadout(), [swordB], "melee", swordB.id);
    const result = resolveSummon(lo, [swordB], "melee", summonRunWeapon(swordA.id));
    expect(result?.runState.stage).toBe(0);
    expect(result?.runState.instanceId).toBe(swordB.id);
  });
});

describe("消耗品（防具/アイテム）", () => {
  it("被弾で防具の耐久が減り、0で破損扱いになる", () => {
    let armor = { id: "a1", name: "革の鎧", durability: 2, maxDurability: 2 };
    armor = damageArmor(armor);
    expect(isArmorBroken(armor)).toBe(false);
    armor = damageArmor(armor);
    expect(isArmorBroken(armor)).toBe(true);
  });
  it("アイテムは使用すると1個減り、無ければ null", () => {
    let inv: Record<string, number> = { potion: 1 };
    const next = useItem(inv, "potion");
    expect(next?.potion).toBe(0);
    inv = next!;
    expect(useItem(inv, "potion")).toBeNull();
  });
});

describe("永続データ（アウトゲームのセーブ）", () => {
  function memoryStore(): KVStore {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
    };
  }

  it("未セーブなら初期状態を返す", () => {
    const data = loadLoadout(memoryStore());
    expect(data).toEqual(newLoadoutSave());
  });
  it("保存した内容を読み込める", () => {
    const store = memoryStore();
    const inst = rollWeaponInstance("iron_sword", "SR", () => 0.5);
    const data = {
      ...newLoadoutSave(),
      inventory: [inst],
      loadout: assignLoadoutSlot(newLoadout(), [inst], "melee", inst.id),
      currency: 300,
    };
    saveLoadout(data, store);
    const loaded = loadLoadout(store);
    expect(loaded.inventory).toHaveLength(1);
    expect(loaded.loadout.melee).toBe(inst.id);
    expect(loaded.currency).toBe(300);
  });
  it("壊れたJSONなら初期状態にフォールバックする", () => {
    const store = memoryStore();
    store.setItem("ai_project002_sideScroller_loadout_v1", "{not json");
    expect(loadLoadout(store)).toEqual(newLoadoutSave());
  });
  it("初期状態の防具選択は「なし」", () => {
    expect(newLoadoutSave().selectedArmorId).toBe("none");
  });
});

describe("防具（ARMOR_TEMPLATES）", () => {
  it("「なし」は耐久0・コスト0", () => {
    const none = findArmorTemplate("none");
    expect(none.maxDurability).toBe(0);
    expect(none.cost).toBe(0);
  });
  it("Tierが上がるほど耐久・コストが高い", () => {
    for (let i = 1; i < ARMOR_TEMPLATES.length; i++) {
      expect(ARMOR_TEMPLATES[i]!.maxDurability).toBeGreaterThan(ARMOR_TEMPLATES[i - 1]!.maxDurability);
      expect(ARMOR_TEMPLATES[i]!.cost).toBeGreaterThan(ARMOR_TEMPLATES[i - 1]!.cost);
    }
  });
  it("未知のidは「なし」にフォールバックする", () => {
    expect(findArmorTemplate("bogus").id).toBe("none");
  });
});

describe("アイテム（ITEM_DEFS）", () => {
  it("複数種類のアイテムが定義されている", () => {
    expect(ITEM_DEFS.length).toBeGreaterThanOrEqual(3);
  });
  it("findItemDef で取得できる", () => {
    expect(findItemDef("potion")?.name).toBe("ポーション");
    expect(findItemDef("bogus")).toBeUndefined();
  });
});

describe("ステージバフ（rollStageBuffOptions）", () => {
  it("指定件数を重複なく返す", () => {
    const options = rollStageBuffOptions(3, STAGE_BUFF_POOL, () => 0.5);
    expect(options).toHaveLength(3);
    const kinds = new Set(options.map((o) => o.kind));
    expect(kinds.size).toBe(3);
  });
  it("プールより多い件数を要求してもプール分だけ返す", () => {
    const options = rollStageBuffOptions(10, STAGE_BUFF_POOL, () => 0.5);
    expect(options).toHaveLength(STAGE_BUFF_POOL.length);
  });
  it("rngが0でもエラーにならない", () => {
    expect(() => rollStageBuffOptions(3, STAGE_BUFF_POOL, () => 0)).not.toThrow();
  });
});
