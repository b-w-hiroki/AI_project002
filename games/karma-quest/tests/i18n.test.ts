import { describe, expect, it } from "vitest";
import {
  choiceLabel,
  deityName,
  deityWish,
  detectLang,
  encounterText,
  factionLabel,
  factionShort,
  legendTitleText,
  mandateLabel,
  requestText,
} from "../src/logic/i18n";
import { ENCOUNTERS } from "../src/logic/encounter";
import { KARMA_REQUESTS } from "../src/logic/karma";

describe("Karma Quest i18n", () => {
  it("uses Japanese by default and supports QA overrides", () => {
    expect(detectLang("", "ja-JP")).toBe("ja");
    expect(detectLang("", "en-US")).toBe("ja");
    expect(detectLang("", "fr-FR")).toBe("ja");
    expect(detectLang("?lang=en", "ja-JP")).toBe("en");
    expect(detectLang("?lang=ja", "en-US")).toBe("ja");
  });

  it("localizes the core decision vocabulary", () => {
    expect(factionLabel("en", "warrior")).toBe("Warrior Faction");
    expect(factionShort("en", "mage")).toBe("Mage");
    expect(requestText("en", KARMA_REQUESTS[0]!)).toContain("iron");
    expect(encounterText("en", ENCOUNTERS[0]!)).toContain("wounded traveler");
    expect(choiceLabel("en", ENCOUNTERS[0]!, ENCOUNTERS[0]!.choiceA)).toBe("Help the traveler");
  });

  it("localizes deity, mandate and legend copy", () => {
    expect(deityName("en", "valor")).toBe("God of Valor");
    expect(deityWish("en", "mercy")).toContain("survival");
    expect(mandateLabel("en", "軍神の試練：強敵 +1段階／加護")).toContain("Trial of Valor");
    expect(legendTitleText("en", 10, 2)).toContain("Battle");
  });
});


describe("CrazyGames locale priority", () => {
  it("prefers SDK locale over browser locale while query override stays highest", () => {
    expect(detectLang("", "en-US", "ja-JP")).toBe("ja");
    expect(detectLang("", "ja-JP", "en-US")).toBe("en");
    expect(detectLang("?lang=ja", "en-US", "en-US")).toBe("ja");
  });
});

it("final report guidance preserves preferences without promising another year", () => {
  for (const deity of ["valor", "mercy"] as const) {
    expect(deityWish("ja", deity, true)).toContain("最後の報告を、年代記へ");
    expect(deityWish("ja", deity, true)).not.toContain("次年");
    expect(deityWish("en", deity, true)).toContain("final report");
    expect(deityWish("en", deity, true)).not.toContain("Next year");
    expect(deityWish("ja", deity)).toContain("次年");
    expect(deityWish("en", deity)).toContain("Next year");
  }
});
