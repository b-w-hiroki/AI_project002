import { advanceRaid, loadRaid, raidReward, type RaidStore } from "./raid";

export const CLAIM_KEY = "karma_quest_raid_claim_v1";
const RAID = "karma_quest_solo_raid_v1";
const TOTAL = "karma_quest_total_eval_v1";
type Store = RaidStore & { removeItem(key: string): void };
type Claim = { raid: string; total: string };

/** The single journal write commits both values. Legacy keys are only mirrors
 * while a journal remains, so a failed mirror write cannot repeat a reward.
 * Runtime callers wrap read/modify/write operations in the shared save lock.
 */
export function createClaimStorage(getStore: () => Store = () => localStorage) {
  function pending(store: Store): Claim | null {
    const raw = store.getItem(CLAIM_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") throw new Error("Invalid claim journal");
    const { raid, total } = data as Partial<Claim>;
    if (typeof raid !== "string" || typeof total !== "string"
      || !Number.isSafeInteger(Number(total)) || Number(total) < 0
      // Journals are written as canonical decimal strings. Coercing empty or
      // alternate numeric notation could silently replace a committed total.
      || String(Number(total)) !== total) throw new Error("Invalid claim journal");
    const parsed = JSON.parse(raid);
    const normalized = loadRaid({ getItem: () => raid, setItem: () => undefined });
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) throw new Error("Invalid claim raid");
    return { raid, total };
  }
  function mirror(store: Store, claim: Claim) {
    try {
      store.setItem(RAID, claim.raid);
      store.setItem(TOTAL, claim.total);
      store.removeItem(CLAIM_KEY);
    } catch { /* The durable journal remains authoritative until a later write. */ }
  }
  const storage: RaidStore = {
    getItem(key) {
      const store = getStore();
      if (key === RAID || key === TOTAL) {
        const claim = pending(store);
        if (claim) return key === RAID ? claim.raid : claim.total;
      }
      return store.getItem(key);
    },
    setItem(key, value) {
      const store = getStore();
      const claim = (key === RAID || key === TOTAL) ? pending(store) : null;
      if (!claim) { store.setItem(key, value); return; }
      const next = { ...claim, [key === RAID ? "raid" : "total"]: value };
      store.setItem(CLAIM_KEY, JSON.stringify(next));
      mirror(store, next);
    },
  };
  function claimReward() {
    const state = loadRaid(storage);
    if (state.hp > 0) return null;
    const raw = Number(storage.getItem(TOTAL));
    const total = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
    const reward = raidReward(state);
    const next = advanceRaid(state);
    const record = { raid: JSON.stringify(next), total: String(total + Math.min(reward, Number.MAX_SAFE_INTEGER - total)) };
    const store = getStore();
    store.setItem(CLAIM_KEY, JSON.stringify(record));
    mirror(store, record);
    return { next, reward };
  }
  return { storage, claimReward };
}
export const { storage: claimStorage, claimReward } = createClaimStorage();
