import { describe, expect, it } from "vitest";
import {
  detectLang,
  expeditionMessage,
  generalName,
  regionText,
  roleName,
  tr,
} from "../src/logic/i18n";
import { regionById } from "../src/logic/regions";

describe("Sangoku Tap i18n", () => {
  it("uses English outside Japanese locales and supports QA overrides", () => {
    expect(detectLang("", "ja-JP")).toBe("ja");
    expect(detectLang("", "en-US")).toBe("en");
    expect(detectLang("", "fr-FR")).toBe("en");
    expect(detectLang("?lang=en", "ja-JP")).toBe("en");
    expect(detectLang("?lang=ja", "en-US")).toBe("ja");
  });

  it("localizes generals, roles, regions and expedition messages", () => {
    expect(generalName("en", "gen_hakuen", "白炎")).toBe("Hakuen");
    expect(roleName("en", "守将")).toBe("Guardian");
    expect(regionText("en", regionById("citadel")).name).toBe("Crimson Citadel");
    expect(expeditionMessage("en", "街道へ。安全を優先して進む。")).toBe(
      "Take the road and prioritize safety.",
    );
    expect(tr("en", "進軍", "Advance")).toBe("Advance");
  });
});
