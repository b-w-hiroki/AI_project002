import { describe, expect, it } from "vitest";
import {
  detectLang,
  fighterName,
  gachaName,
  moveLabel,
  opponentName,
  storyTitle,
  tr,
} from "../src/logic/i18n";

describe("Fist Legend i18n", () => {
  it("uses Japanese only for Japanese locales and English otherwise", () => {
    expect(detectLang("", "ja-JP")).toBe("ja");
    expect(detectLang("", "en-US")).toBe("en");
    expect(detectLang("", "fr-FR")).toBe("en");
  });

  it("supports query override for QA", () => {
    expect(detectLang("?lang=en", "ja-JP")).toBe("en");
    expect(detectLang("?lang=ja", "en-US")).toBe("ja");
  });

  it("localizes gameplay names without changing ids", () => {
    expect(fighterName("en", "renka")).toBe("Renka");
    expect(opponentName("en", "rush")).toBe("Gaku the Aggressor");
    expect(moveLabel("en", "ki")).toBe("Ki");
    expect(gachaName("en", "ougi_hyakuretsu", "百裂拳")).toBe("Hundred Fists");
    expect(storyTitle("en", "dojo_breaker", "第一章・道場破り")).toContain("Chapter 1");
    expect(tr("en", "勝利", "Victory")).toBe("Victory");
  });
});


describe("CrazyGames locale priority", () => {
  it("prefers SDK locale over browser locale while query override stays highest", () => {
    expect(detectLang("", "en-US", "ja-JP")).toBe("ja");
    expect(detectLang("", "ja-JP", "en-US")).toBe("en");
    expect(detectLang("?lang=ja", "en-US", "en-US")).toBe("ja");
  });
});
