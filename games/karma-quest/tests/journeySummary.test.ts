import { describe, expect, it } from "vitest";
import { replayPrompt, summarizeJourney, type ChoiceRecord } from "../src/logic/journeySummary";

const record = (year: number, faction: "warrior" | "merchant" | "outlaw" | "mage", accepted: boolean): ChoiceRecord => ({
  year,
  outcome: {
    faction,
    requestId: "qa",
    title: accepted ? "支援しました" : "支援を見送りました",
    body: "",
    quote: "",
    deltas: [0, 0, 0, 0],
  },
});

describe("journey summary", () => {
  it("distinguishes support-heavy and decline-heavy runs", () => {
    const support = summarizeJourney([
      record(1, "warrior", true),
      record(2, "warrior", true),
      record(3, "mage", true),
      record(4, "merchant", false),
    ]);
    const selective = summarizeJourney([
      record(1, "warrior", false),
      record(2, "mage", false),
      record(3, "merchant", false),
      record(4, "outlaw", true),
    ]);
    expect(support.style).toBe("supportive");
    expect(selective.style).toBe("selective");
    expect(replayPrompt(support).ja).not.toBe(replayPrompt(selective).ja);
  });

  it("tracks the most supported faction for balanced runs", () => {
    const summary = summarizeJourney([
      record(1, "mage", true),
      record(2, "mage", true),
      record(3, "warrior", false),
      record(4, "merchant", false),
    ]);
    expect(summary.style).toBe("balanced");
    expect(summary.leadingFaction).toBe("mage");
  });
});
