import { expeditionReward, type Expedition } from "./expedition";
import { tr, type Lang } from "./i18n";

/** Presentation only: settlement remains the expedition scene's responsibility. */
export function resultRewards(run: Expedition, merit: number, lang: Lang) {
  const gear = run.status === "clear" ? "Rare" : run.status !== "defeat" && run.step >= 3 ? "Common" : null;
  const coins = expeditionReward(run);
  return [
    { kind: "gear", earned: gear !== null, text: gear ? `${gear}${tr(lang, "装備", " Gear")} +1` : tr(lang, "装備報酬なし", "No Gear Reward") },
    { kind: "merit", earned: merit > 0, text: `${tr(lang, "功績", "Merit")} +${merit}` },
    { kind: "coins", earned: coins > 0, text: `${coins} ${tr(lang, "持帰り銭", "Coins Secured")}` },
  ].sort((a, b) => Number(b.earned) - Number(a.earned));
}
