import { describe, expect, it } from "vitest";
import {
  armorName,
  detectLang,
  itemName,
  stageBuffText,
  tr,
  weaponLabel,
  weaponName,
} from "../src/logic/i18n";

describe("Blade Woods i18n", () => {
  it("falls back to English outside Japanese locales and supports QA overrides", () => {
    expect(detectLang("", "ja-JP")).toBe("ja");
    expect(detectLang("", "en-US")).toBe("en");
    expect(detectLang("", "fr-FR")).toBe("en");
    expect(detectLang("?lang=en", "ja-JP")).toBe("en");
    expect(detectLang("?lang=ja", "en-US")).toBe("ja");
  });

  it("localizes gameplay equipment vocabulary", () => {
    expect(weaponLabel("en", "melee")).toBe("Melee");
    expect(weaponName("en", "greatsword")).toBe("Greatsword");
    expect(armorName("en", "plate")).toBe("Plate Armor");
    expect(itemName("en", "power_charm")).toBe("Power Charm");
    expect(stageBuffText("en", "doubleJump", "", "").label).toBe("Double Jump");
    expect(tr("en", "開始", "Start")).toBe("Start");
  });
});


describe("CrazyGames locale priority", () => {
  it("prefers SDK locale over browser locale while query override stays highest", () => {
    expect(detectLang("", "en-US", "ja-JP")).toBe("ja");
    expect(detectLang("", "ja-JP", "en-US")).toBe("en");
    expect(detectLang("?lang=ja", "en-US", "en-US")).toBe("ja");
  });
});
