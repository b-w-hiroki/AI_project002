import { describe, expect, it } from "vitest";
import { detectLang, t, writingModeLabel } from "../src/logic/i18n";

describe("Color Match i18n", () => {
  it("uses Japanese only for Japanese browser locales and English otherwise", () => {
    expect(detectLang("", "ja-JP")).toBe("ja");
    expect(detectLang("", "en-US")).toBe("en");
    expect(detectLang("", "fr-FR")).toBe("en");
  });

  it("query parameter overrides browser locale for QA", () => {
    expect(detectLang("?lang=en", "ja-JP")).toBe("en");
    expect(detectLang("?lang=ja", "en-US")).toBe("ja");
  });

  it("provides English UI labels and writing mode names", () => {
    expect(t("en", "title")).toBe("Color Match");
    expect(t("en", "challenge")).toBe("60-Second Challenge");
    expect(writingModeLabel("en", "kanji")).toBe("Kanji");
  });
});
