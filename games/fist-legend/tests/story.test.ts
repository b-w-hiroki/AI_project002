import { describe, expect, it } from "vitest";
import { STORY_CHAPTERS, storyChapterAt, storyStartIndex } from "../src/logic/story";

describe("story mode", () => {
  it("has three ordered chapters with distinct opponents", () => {
    expect(STORY_CHAPTERS).toHaveLength(3);
    expect(STORY_CHAPTERS.map(chapter => chapter.opponent)).toEqual(["rush", "counter", "charge"]);
  });

  it("starts from the first uncleared chapter", () => {
    expect(storyStartIndex(0)).toBe(0);
    expect(storyStartIndex(1)).toBe(1);
    expect(storyStartIndex(2)).toBe(2);
    expect(storyStartIndex(3)).toBe(0);
  });

  it("clamps chapter lookup safely", () => {
    expect(storyChapterAt(-1).id).toBe(STORY_CHAPTERS[0]!.id);
    expect(storyChapterAt(99).id).toBe(STORY_CHAPTERS[2]!.id);
  });
});
