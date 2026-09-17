import { describe, expect, it } from "vitest";
import { PORTRAIT_BLUEPRINT, PORTRAIT_CANVAS, overlaps, rectGap, type UiRect } from "./portraitBlueprint";

const insideCanvas = (rect: UiRect) => rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= PORTRAIT_CANVAS.width
  && rect.y + rect.height <= PORTRAIT_CANVAS.height;

describe("portrait screen blueprint", () => {
  it("keeps every UI region inside the design canvas", () => {
    for (const screen of Object.values(PORTRAIT_BLUEPRINT)) {
      for (const rect of Object.values(screen)) expect(insideCanvas(rect)).toBe(true);
    }
  });

  it("keeps the choice copy, people, and actions in separate vertical lanes", () => {
    const choice = PORTRAIT_BLUEPRINT.choice;
    expect(overlaps(choice.request, choice.playerPortrait)).toBe(false);
    expect(overlaps(choice.request, choice.npcPortrait)).toBe(false);
    expect(overlaps(choice.playerPortrait, choice.accept)).toBe(false);
    expect(overlaps(choice.npcPortrait, choice.accept)).toBe(false);
    expect(rectGap(choice.npcPortrait, choice.accept).vertical).toBeGreaterThanOrEqual(12);
    expect(rectGap(choice.accept, choice.decline).vertical).toBeGreaterThanOrEqual(16);
    expect(rectGap(choice.decline, choice.tagline).vertical).toBeGreaterThanOrEqual(16);
  });

  it("reserves independent reading and action areas on the final screen", () => {
    const final = PORTRAIT_BLUEPRINT.final;
    expect(overlaps(final.heading, final.event)).toBe(false);
    expect(overlaps(final.event, final.locked)).toBe(false);
    expect(overlaps(final.locked, final.city)).toBe(false);
    expect(overlaps(final.growth, final.replay)).toBe(false);
    expect(rectGap(final.growth, final.replay).vertical).toBeGreaterThanOrEqual(23);
  });
});
