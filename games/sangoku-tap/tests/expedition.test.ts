import { describe, it, expect } from "vitest";
import {
  validParty,
  buildTroop,
  newExpedition,
  advanceExpedition,
  chooseRoute,
  returnExpedition,
  expeditionReward,
  victoryChance,
  rollRegionEvent,
} from "../src/logic/expedition";
const owned = { gen_soujin: 1, gen_kohei: 1, gen_ashigaru: 1, gen_suzaku: 1 };
const troop = buildTroop(
  ["gen_soujin", "gen_kohei", "gen_ashigaru"],
  owned,
  {},
);

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
describe("遠征の選択と報酬", () => {
  it("未所持・重複を除き3人まで", () =>
    expect(
      validParty(
        [
          "gen_hakuen",
          "gen_soujin",
          "gen_soujin",
          "gen_kohei",
          "gen_ashigaru",
          "gen_suzaku",
        ],
        owned,
      ),
    ).toEqual(["gen_soujin", "gen_kohei", "gen_ashigaru"]));
  it("装備が同じ相手への勝率に反映される", () =>
    expect(
      victoryChance(
        newExpedition(buildTroop(troop.ids, owned, { gen_soujin: "Epic" })),
      ),
    ).toBeGreaterThan(victoryChance(newExpedition(troop))));
  it("3地点で停止し、分岐選択後だけ進む", () => {
    let r = newExpedition(troop);
    for (let i = 0; i < 3; i++) r = advanceExpedition(r, () => 0.99);
    expect(r.fork).toBe(true);
    expect(advanceExpedition(r)).toBe(r);
    expect(chooseRoute(r, "mountain").fork).toBe(false);
  });
  it("守将が敗戦の損耗を減らす", () => {
    const r = newExpedition(troop);
    let i = 0;
    const guarded = advanceExpedition(r, () => (i++ === 0 ? 0 : 0.99));
    i = 0;
    const bare = advanceExpedition(
      { ...r, troop: { ...troop, guard: 0 } },
      () => (i++ === 0 ? 0 : 0.99),
    );
    expect(guarded.hp).toBeGreaterThan(bare.hp);
  });
  it("敗走は今回の収穫だけ半減、途中帰還は全額", () => {
    const r = { ...newExpedition(troop), loot: 101 };
    expect(expeditionReward(r)).toBe(0);
    expect(expeditionReward(returnExpedition(r))).toBe(101);
    expect(expeditionReward({ ...r, status: "defeat" })).toBe(50);
  });
  it("関門勝利で終了し、終了後は進めない", () => {
    const r = advanceExpedition({ ...newExpedition(troop), step: 9 }, () => 0);
    expect(r.status).toBe("clear");
    expect(advanceExpedition(r)).toBe(r);
  });
  it("空の編成では進めない", () => {
    const r = newExpedition(buildTroop([], owned, {}));
    expect(advanceExpedition(r)).toBe(r);
  });

  it("地域ごとに固有イベントが異なる", () => {
    expect(rollRegionEvent("plains", sequence([0.1, 0]))?.id).toBe("merchant_caravan");
    expect(rollRegionEvent("pass", sequence([0.1, 0.99]))?.id).toBe("rockfall");
    expect(rollRegionEvent("citadel", sequence([0.1, 0]))?.id).toBe("hidden_store");
    expect(rollRegionEvent("plains", sequence([0.9]))).toBeNull();
  });

  it("非戦闘マスの地域イベントが兵力と収穫へ反映される", () => {
    const r = { ...newExpedition(troop, "pass"), hp: 50 };
    // 0.99=非戦闘、0.1=イベント発生、0=薬草地
    const next = advanceExpedition(r, sequence([0.99, 0.1, 0]));
    expect(next.hp).toBe(64);
    expect(next.message).toContain("峠の薬草地");
    expect(next.loot).toBeGreaterThan(0);
  });

  it("城塞の火計跡は損耗と追加収穫が同時に発生する", () => {
    const r = { ...newExpedition(troop, "citadel"), hp: 100 };
    const next = advanceExpedition(r, sequence([0.99, 0.1, 0.99]));
    expect(next.hp).toBe(88);
    expect(next.message).toContain("火計跡");
    expect(next.loot).toBeGreaterThan(0);
  });
});

describe("遠征バランス帯", () => {
  it("標準編成の平原序盤は75〜85%で安定する", () => {
    const chance = victoryChance(newExpedition(troop, "plains"));
    expect(chance).toBeGreaterThanOrEqual(0.75);
    expect(chance).toBeLessThanOrEqual(0.85);
  });

  it("標準編成の城塞関門は40〜55%で強化余地を残す", () => {
    const run = { ...newExpedition(troop, "citadel"), step: 9 };
    const chance = victoryChance(run);
    expect(chance).toBeGreaterThanOrEqual(0.4);
    expect(chance).toBeLessThanOrEqual(0.55);
  });

  it("軍師なしの山道は街道より危険になる", () => {
    const road = { ...newExpedition(troop, "pass"), route: "road" as const };
    const mountain = { ...road, route: "mountain" as const };
    expect(victoryChance(mountain)).toBeLessThan(victoryChance(road));
  });

  it("軍師を入れると山道の勝率補正がリスクを上回る", () => {
    const strategistOwned = {
      gen_soujin: 1,
      gen_suzaku: 1,
      gen_ashigaru: 1,
    };
    const strategistTroop = buildTroop(
      ["gen_soujin", "gen_suzaku", "gen_ashigaru"],
      strategistOwned,
      {},
    );
    const road = { ...newExpedition(strategistTroop, "pass"), route: "road" as const };
    const mountain = { ...road, route: "mountain" as const };
    expect(victoryChance(mountain)).toBeGreaterThan(victoryChance(road));
  });
});

