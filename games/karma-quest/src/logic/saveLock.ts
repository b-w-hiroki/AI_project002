/** All cooperating tabs serialize read/modify/write transactions, not just writes. */
export const SAVE_LOCK = "karma_quest_progress_v1";
export async function withSaveLock<T>(action: () => T): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) throw new Error("Save locking unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    return await navigator.locks.request(SAVE_LOCK, { signal: controller.signal }, () => action());
  } finally {
    clearTimeout(timeout);
  }
}
