import { afterEach, expect, it, vi } from "vitest";
import { loadSoundPreference, saveSoundPreference } from "../src/logic/soundPreference";

afterEach(() => vi.unstubAllGlobals());

it.each([null, "on", "invalid"])("defaults to enabled for %s", value => {
  vi.stubGlobal("localStorage", { getItem: () => value });
  expect(loadSoundPreference()).toBe(true);
});

it("restores mute and persists both states under the existing key", () => {
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => "off", setItem });
  expect(loadSoundPreference()).toBe(false);
  expect(saveSoundPreference(false)).toBe(true);
  expect(setItem).toHaveBeenLastCalledWith("karma_quest_sound_v1", "off");
  expect(saveSoundPreference(true)).toBe(true);
  expect(setItem).toHaveBeenLastCalledWith("karma_quest_sound_v1", "on");
});

it("contains read and write failures without claiming persistence", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("QuotaExceededError"); },
  });
  expect(loadSoundPreference()).toBe(true);
  expect(saveSoundPreference(false)).toBe(false);
});

it("handles unavailable storage", () => {
  vi.stubGlobal("localStorage", undefined);
  expect(loadSoundPreference()).toBe(true);
  expect(saveSoundPreference(true)).toBe(false);
});
