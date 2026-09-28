import { summarizeSession } from "./round";
import type { ChallengeResult } from "./challenge";

export type ImprovementFocus = "switch" | "content" | "color" | "speed" | "flow";

function accuracy(samples: readonly ChallengeResult[]): number {
  if (samples.length === 0) return 1;
  return samples.filter(result => result.correct).length / samples.length;
}

/**
 * 60秒の結果から、次の1プレイで意識する課題を1つだけ返す。
 * 永続成績や報酬には触れず、同じラウンド結果なら同じ助言になる。
 */
export function improvementFocus(results: readonly ChallengeResult[]): ImprovementFocus {
  if (results.length === 0) return "content";

  const switched = results.filter(result => result.switched);
  const content = results.filter(result => result.mode === "content");
  const color = results.filter(result => result.mode === "color");

  if (switched.length >= 2 && accuracy(switched) < 0.85) return "switch";

  const contentAccuracy = accuracy(content);
  const colorAccuracy = accuracy(color);
  if (content.length > 0 && color.length > 0) {
    if (contentAccuracy + 0.05 < colorAccuracy) return "content";
    if (colorAccuracy + 0.05 < contentAccuracy) return "color";
  } else if (content.length > 0 && contentAccuracy < 0.85) {
    return "content";
  } else if (color.length > 0 && colorAccuracy < 0.85) {
    return "color";
  }

  const summary = summarizeSession(results);
  if (summary.accuracy >= 0.85 && summary.avgReactionMs > 1000) return "speed";
  if (summary.accuracy < 0.85) {
    return contentAccuracy <= colorAccuracy ? "content" : "color";
  }
  return "flow";
}
