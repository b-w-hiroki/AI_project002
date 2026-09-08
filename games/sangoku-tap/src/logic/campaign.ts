import type { Expedition, Troop } from "./expedition";
import { REGIONS, type RegionId, regionById } from "./regions";
export interface Campaign {
  merit: number;
  training: number;
  cleared: RegionId[];
  lastRunId: string;
}
export const CAMPAIGN_KEY = "sangoku_campaign_v1";
export const MAX_TRAINING = 5;
export function emptyCampaign(): Campaign {
  return { merit: 0, training: 0, cleared: [], lastRunId: "" };
}
export function loadCampaign(): Campaign {
  try {
    const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? "null");
    if (
      !v ||
      !Number.isSafeInteger(v.merit) ||
      v.merit < 0 ||
      !Number.isInteger(v.training) ||
      v.training < 0 ||
      v.training > MAX_TRAINING ||
      !Array.isArray(v.cleared)
    )
      return emptyCampaign();
    // Progress is sequential; a corrupt save cannot skip prerequisite chapters.
    const cleared: RegionId[] = [];
    for (const r of REGIONS) {
      if (!v.cleared.includes(r.id)) break;
      cleared.push(r.id);
    }
    return {
      merit: v.merit,
      training: v.training,
      cleared,
      lastRunId: typeof v.lastRunId === "string" ? v.lastRunId : "",
    };
  } catch {
    return emptyCampaign();
  }
}
export function saveCampaign(campaign: Campaign): void {
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
}
export function isUnlocked(campaign: Campaign, id: RegionId): boolean {
  const index = REGIONS.findIndex((r) => r.id === id);
  return (
    index === 0 ||
    (index > 0 && campaign.cleared.includes(REGIONS[index - 1]!.id))
  );
}
export function trainingCost(level: number): number {
  return 4 + level * 2;
}
export function train(campaign: Campaign): Campaign {
  const cost = trainingCost(campaign.training);
  if (campaign.training >= MAX_TRAINING || campaign.merit < cost)
    return campaign;
  return {
    ...campaign,
    merit: campaign.merit - cost,
    training: campaign.training + 1,
  };
}
export function trainedTroop(troop: Troop, campaign: Campaign): Troop {
  return {
    ...troop,
    power: Math.round(troop.power * (1 + campaign.training * 0.08)),
  };
}
export function campaignReward(campaign: Campaign, run: Expedition): number {
  if (
    run.status === "active" ||
    campaign.lastRunId === run.id ||
    !isUnlocked(campaign, run.regionId)
  )
    return 0;
  const first =
    run.status === "clear" && !campaign.cleared.includes(run.regionId);
  return Math.floor(run.step / 3) + (first ? 5 : 0);
}
export function recordExpedition(
  campaign: Campaign,
  run: Expedition,
): Campaign {
  if (
    run.status === "active" ||
    campaign.lastRunId === run.id ||
    !isUnlocked(campaign, run.regionId)
  )
    return campaign;
  const id = regionById(run.regionId).id;
  return {
    ...campaign,
    merit: campaign.merit + campaignReward(campaign, run),
    lastRunId: run.id,
    cleared:
      run.status === "clear" && !campaign.cleared.includes(id)
        ? [...campaign.cleared, id]
        : campaign.cleared,
  };
}
