import { describe, expect, it } from "vitest";
import {
  addOwnedGeneral,
  effectiveAtk,
  emptyEquipped,
  emptyRoster,
  equipToGeneral,
  isOwned,
  unequipGeneral,
} from "../src/logic/roster";
import { GENERAL_POOL } from "../src/logic/general";

const hakuen = GENERAL_POOL.find((g) => g.id === "gen_hakuen")!;

describe("roster", () => {
  it("初期状態では何も所持していない", () => {
    expect(isOwned(emptyRoster(), hakuen.id)).toBe(false);
  });

  it("addOwnedGeneralで所持数が増える", () => {
    let roster = emptyRoster();
    roster = addOwnedGeneral(roster, hakuen.id);
    expect(isOwned(roster, hakuen.id)).toBe(true);
    expect(roster[hakuen.id]).toBe(1);
    roster = addOwnedGeneral(roster, hakuen.id);
    expect(roster[hakuen.id]).toBe(2);
  });
});

describe("equipToGeneral / unequipGeneral", () => {
  it("装備すると装着状態になる", () => {
    const equipped = equipToGeneral(emptyEquipped(), hakuen.id, "Rare");
    expect(equipped[hakuen.id]).toBe("Rare");
  });

  it("装備を外すと装着状態が消える", () => {
    let equipped = equipToGeneral(emptyEquipped(), hakuen.id, "Rare");
    equipped = unequipGeneral(equipped, hakuen.id);
    expect(equipped[hakuen.id]).toBeUndefined();
  });

  it("装備を置き換えると新しい方だけが反映される", () => {
    let equipped = equipToGeneral(emptyEquipped(), hakuen.id, "Common");
    equipped = equipToGeneral(equipped, hakuen.id, "Epic");
    expect(equipped[hakuen.id]).toBe("Epic");
  });
});

describe("effectiveAtk", () => {
  it("未装備なら素のATKのまま", () => {
    expect(effectiveAtk(hakuen, emptyEquipped())).toBe(hakuen.atk);
  });

  it("レアリティが高いほど加算量が大きい", () => {
    const withCommon = effectiveAtk(hakuen, equipToGeneral(emptyEquipped(), hakuen.id, "Common"));
    const withRare = effectiveAtk(hakuen, equipToGeneral(emptyEquipped(), hakuen.id, "Rare"));
    const withEpic = effectiveAtk(hakuen, equipToGeneral(emptyEquipped(), hakuen.id, "Epic"));
    expect(withRare).toBeGreaterThan(withCommon);
    expect(withEpic).toBeGreaterThan(withRare);
  });
});
