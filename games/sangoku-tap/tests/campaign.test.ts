import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyCampaign,
  isUnlocked,
  train,
  trainingCost,
  trainedTroop,
  recordExpedition,
  campaignReward,
  loadCampaign,
  saveCampaign,
  CAMPAIGN_KEY,
} from "../src/logic/campaign";
import {
  newExpedition,
  advanceExpedition,
  victoryChance,
  type Expedition,
} from "../src/logic/expedition";
import { loadExpedition, saveExpedition } from "../src/logic/expeditionSave";
import { REGIONS } from "../src/logic/regions";
const troop = {
  ids: ["gen_soujin"],
  power: 100,
  guard: 0,
  scout: 0,
  merchant: 1,
};
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
const clear = (regionId: Expedition["regionId"] = "plains"): Expedition => ({
  ...newExpedition(troop, regionId),
  status: "clear",
  step: 10,
});
describe("地域攻略と鍛錬", () => {
  it("最初は街道のみ開放", () =>
    expect(REGIONS.map((r) => isUnlocked(emptyCampaign(), r.id))).toEqual([
      true,
      false,
      false,
    ]));
  it("踏破すると次章を開放し初回功績を与える", () => {
    const c = recordExpedition(emptyCampaign(), clear());
    expect(c.merit).toBe(8);
    expect(c.cleared).toEqual(["plains"]);
    expect(isUnlocked(c, "pass")).toBe(true);
    expect(isUnlocked(c, "citadel")).toBe(false);
  });
  it("初踏破ボーナスは同じ地域で一度だけ", () => {
    const c = recordExpedition(emptyCampaign(), clear());
    expect(recordExpedition(c, clear()).merit).toBe(11);
  });
  it("同じ遠征の報告は重複しない", () => {
    const r = clear(),
      c = recordExpedition(emptyCampaign(), r);
    expect(recordExpedition(c, r)).toBe(c);
    expect(campaignReward(c, r)).toBe(0);
  });
  it("未開放地域の報告と進行中の報告は無効", () => {
    const c = emptyCampaign();
    expect(recordExpedition(c, clear("citadel"))).toBe(c);
    expect(recordExpedition(c, newExpedition(troop))).toBe(c);
  });
  it("帰還も敗走も3地点ごとに功績を持ち帰るが開放しない", () => {
    for (const status of ["retreat", "defeat"] as const) {
      const c = recordExpedition(emptyCampaign(), {
        ...clear(),
        step: 7,
        status,
      });
      expect(c.merit).toBe(2);
      expect(c.cleared).toEqual([]);
    }
  });
  it("全地域を順に踏破できる", () => {
    let c = emptyCampaign();
    for (const r of REGIONS) c = recordExpedition(c, clear(r.id));
    expect(c.cleared).toHaveLength(3);
    expect(c.merit).toBe(24);
  });
  it("功績を消費して鍛錬し不足時は変化しない", () => {
    const c = { ...emptyCampaign(), merit: 4 },
      upgraded = train(c);
    expect(upgraded.training).toBe(1);
    expect(upgraded.merit).toBe(0);
    expect(train(upgraded)).toBe(upgraded);
    expect(c.training).toBe(0);
  });
  it("鍛錬は5段階で停止し戦力最大40%増", () => {
    let c = { ...emptyCampaign(), merit: 100 };
    for (let i = 0; i < 5; i++) c = train(c);
    expect(c.training).toBe(5);
    expect(train(c)).toBe(c);
    expect(trainedTroop(troop, c).power).toBe(140);
    expect(trainingCost(4)).toBe(12);
  });
  it("鍛錬は出発時の戦力を変更せず新しい部隊へ反映", () => {
    const run = newExpedition(trainedTroop(troop, emptyCampaign()));
    expect(trainedTroop(troop, { ...emptyCampaign(), training: 1 }).power).toBe(
      108,
    );
    expect(run.troop.power).toBe(100);
  });
  it("後半の地域は敵が強く報酬も高い", () => {
    const a = newExpedition(troop),
      b = newExpedition(troop, "citadel");
    expect(victoryChance(b)).toBeLessThan(victoryChance(a));
    expect(advanceExpedition(b, () => 0.99).loot).toBeGreaterThan(
      advanceExpedition(a, () => 0.99).loot,
    );
  });
  it("攻略データは再読み込みで維持", () => {
    const c = recordExpedition(emptyCampaign(), clear());
    saveCampaign(c);
    expect(loadCampaign()).toEqual(c);
  });
  it("不正な鍛錬値や飛び級セーブを防ぐ", () => {
    localStorage.setItem(
      CAMPAIGN_KEY,
      JSON.stringify({ ...emptyCampaign(), training: -1 }),
    );
    expect(loadCampaign()).toEqual(emptyCampaign());
    localStorage.setItem(
      CAMPAIGN_KEY,
      JSON.stringify({ ...emptyCampaign(), cleared: ["citadel"] }),
    );
    expect(loadCampaign().cleared).toEqual([]);
  });
  it("旧遠征セーブは街道へ移行し識別子を補完", () => {
    const old = { ...newExpedition(troop) } as Partial<Expedition>;
    delete old.regionId;
    delete old.id;
    localStorage.setItem("sangoku_expedition_v1", JSON.stringify(old));
    const run = loadExpedition()!;
    expect(run.regionId).toBe("plains");
    expect(run.id).toBeTruthy();
    saveExpedition(run);
    expect(loadExpedition()).toEqual(run);
  });
});
