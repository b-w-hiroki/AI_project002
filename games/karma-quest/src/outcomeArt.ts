// Explicit story mapping keeps accepted and declined scenes distinct.
export const OUTCOME_ART: Readonly<Record<string, readonly [string, string]>> = {
  warrior_iron: ["kq-outcome-warrior_iron-accept-v2", "kq-outcome-warrior_iron-decline-v2"],
  warrior_train: ["kq-outcome-warrior_train-accept-v2", "kq-outcome-warrior_train-decline-v2"],
  merchant_monster: ["kq-bg-merchant-market-v1", "kq-outcome-merchant_monster-decline-v1"],
  merchant_toll: ["kq-outcome-merchant_toll-accept-v1", "kq-outcome-merchant_toll-decline-v1"],
  outlaw_gold: ["kq-bg-outlaw-courtyard-v1", "kq-outcome-outlaw_gold-decline-v1"],
  outlaw_fight: ["kq-outcome-outlaw_fight-accept-v1", "kq-outcome-outlaw_fight-decline-v1"],
  mage_stone: ["kq-bg-mage-study-v1", "kq-outcome-mage_stone-decline-v1"],
  mage_book: ["kq-outcome-mage_book-accept-v1", "kq-outcome-mage_book-decline-v1"],
  village_food: ["kq-bg-village-reaction", "kq-bg-capital-home-v3"],
};

export function outcomeArtKey(requestId: string, accepted: boolean): string {
  return OUTCOME_ART[requestId]?.[accepted ? 0 : 1] ?? "kq-bg-capital-home-v3";
}
