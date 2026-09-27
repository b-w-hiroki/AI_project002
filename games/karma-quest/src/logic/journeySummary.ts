import type { Faction } from "./karma";
import type { requestOutcome } from "./requestOutcome";

export type ChoiceRecord = {
  year: number;
  outcome: ReturnType<typeof requestOutcome>;
};

export type JourneyStyle = "supportive" | "selective" | "balanced";

export interface JourneySummary {
  total: number;
  supported: number;
  declined: number;
  style: JourneyStyle;
  leadingFaction: Faction | null;
}

export function summarizeJourney(history: readonly ChoiceRecord[]): JourneySummary {
  let supported = 0;
  let declined = 0;
  const factionSupport: Record<Faction, number> = {
    warrior: 0,
    merchant: 0,
    outlaw: 0,
    mage: 0,
  };

  for (const entry of history) {
    const accepted = entry.outcome.title !== "支援を見送りました";
    if (accepted) {
      supported += 1;
      factionSupport[entry.outcome.faction] += 1;
    } else {
      declined += 1;
    }
  }

  const style: JourneyStyle =
    supported >= declined + 2
      ? "supportive"
      : declined >= supported + 2
        ? "selective"
        : "balanced";

  const ranked = (Object.entries(factionSupport) as Array<[Faction, number]>)
    .sort((a, b) => b[1] - a[1]);
  const leadingFaction = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : null;

  return {
    total: history.length,
    supported,
    declined,
    style,
    leadingFaction,
  };
}

export function replayPrompt(summary: JourneySummary): { ja: string; en: string } {
  if (summary.style === "supportive") {
    return {
      ja: "次の旅：断る選択を増やし、別の勢力図を試そう",
      en: "NEXT RUN: Decline more requests and shape a different world",
    };
  }
  if (summary.style === "selective") {
    return {
      ja: "次の旅：支援を増やし、別の勇者像を試そう",
      en: "NEXT RUN: Support more requests and shape a different hero",
    };
  }
  if (summary.leadingFaction) {
    return {
      ja: "次の旅：別の派閥を優先し、結末の差を確かめよう",
      en: "NEXT RUN: Favor another faction and compare the ending",
    };
  }
  return {
    ja: "次の旅：選択方針を一つ決めて、結末を変えてみよう",
    en: "NEXT RUN: Commit to a different strategy and change the ending",
  };
}
