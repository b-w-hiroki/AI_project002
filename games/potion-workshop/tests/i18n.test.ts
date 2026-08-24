import { describe, expect, it } from "vitest";
import { detectLang, generatorName, t, toggleLang } from "../src/logic/i18n";

describe("t", () => {
  it("言語ごとの文言を返す", () => {
    expect(t("ja", "brew")).toBe("調合！");
    expect(t("en", "brew")).toBe("Brew!");
  });
  it("プレースホルダを置換する", () => {
    expect(t("ja", "welcomeBack", { n: "1.5K" })).toContain("1.5K");
    expect(t("en", "welcomeBack", { n: "42" })).toBe(
      "Welcome back! You brewed 42 potions while away",
    );
  });
});

describe("generatorName", () => {
  it("設備名を翻訳する", () => {
    expect(generatorName("ja", "apprentice")).toBe("見習い錬金術師");
    expect(generatorName("en", "apprentice")).toBe("Apprentice Alchemist");
  });
  it("未知のIDはそのまま返す", () => {
    expect(generatorName("en", "unknown")).toBe("unknown");
  });
});

describe("detectLang / toggleLang", () => {
  it("ja系は ja、それ以外は en", () => {
    expect(detectLang("ja")).toBe("ja");
    expect(detectLang("ja-JP")).toBe("ja");
    expect(detectLang("en-US")).toBe("en");
    expect(detectLang("fr")).toBe("en");
  });
  it("トグルで切り替わる", () => {
    expect(toggleLang("ja")).toBe("en");
    expect(toggleLang("en")).toBe("ja");
  });
});
