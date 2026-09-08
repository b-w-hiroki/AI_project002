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
} from "../src/logic/expedition";
const owned = { gen_soujin: 1, gen_kohei: 1, gen_ashigaru: 1, gen_suzaku: 1 };
const troop = buildTroop(
  ["gen_soujin", "gen_kohei", "gen_ashigaru"],
  owned,
  {},
);
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
});
