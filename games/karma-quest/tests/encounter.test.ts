import { describe, expect, it } from "vitest";
import { applyEncounterChoice, ENCOUNTERS, rollEncounter, rollEncounterOccurs } from "../src/logic/encounter";
import { initialKarma } from "../src/logic/karma";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("rollEncounterOccurs", () => {
  it("低い乱数値では発生する", () => {
    expect(rollEncounterOccurs(sequentialRng([0.01]))).toBe(true);
  });

  it("高い乱数値では発生しない", () => {
    expect(rollEncounterOccurs(sequentialRng([0.99]))).toBe(false);
  });
});

describe("rollEncounter", () => {
  it("ENCOUNTERSの中から1件選ばれる", () => {
    const encounter = rollEncounter(sequentialRng([0.3]));
    expect(ENCOUNTERS).toContain(encounter);
  });

  it("同じrngシードなら再現できる", () => {
    const a = rollEncounter(sequentialRng([0.6]));
    const b = rollEncounter(sequentialRng([0.6]));
    expect(a).toBe(b);
  });
});

describe("applyEncounterChoice", () => {
  it("選択した派閥のカルマだけが上がる", () => {
    const karma = initialKarma();
    const encounter = ENCOUNTERS[0]!;
    const next = applyEncounterChoice(karma, encounter.choiceA);
    expect(next[encounter.choiceA.karmaFaction]).toBe(karma[encounter.choiceA.karmaFaction] + encounter.choiceA.karmaDelta);
    for (const key of Object.keys(karma) as (keyof typeof karma)[]) {
      if (key !== encounter.choiceA.karmaFaction) expect(next[key]).toBe(karma[key]);
    }
  });
});
