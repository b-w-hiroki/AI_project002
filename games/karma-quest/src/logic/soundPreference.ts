const SOUND_PREF_KEY = "karma_quest_sound_v1";

export function loadSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Persistence is optional: the current session must still be able to mute. */
export function saveSoundPreference(enabled: boolean): boolean {
  try {
    localStorage.setItem(SOUND_PREF_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}
