import {
  generateRound,
  type JudgeMode,
  type Round,
  type RoundResult,
} from "./round";
export const CHALLENGE_MS = 60000;
export function judgeAt(elapsed: number): JudgeMode {
  if (elapsed < 15000) return "content";
  if (elapsed < 30000) return "color";
  if (elapsed < 45000)
    return Math.floor((elapsed - 30000) / 5000) % 2 === 0 ? "content" : "color";
  return Math.floor((elapsed - 45000) / 3000) % 2 === 0 ? "content" : "color";
}
export function nextSwitchAt(elapsed: number): number {
  if (elapsed < 15000) return 15000;
  if (elapsed < 30000) return 30000;
  if (elapsed < 45000)
    return Math.min(
      45000,
      30000 + (Math.floor((elapsed - 30000) / 5000) + 1) * 5000,
    );
  return Math.min(
    CHALLENGE_MS,
    45000 + (Math.floor((elapsed - 45000) / 3000) + 1) * 3000,
  );
}
export function challengeRound(
  elapsed: number,
  rng: () => number = Math.random,
): Round {
  const round = generateRound(rng);
  const judgeMode = judgeAt(elapsed);
  return {
    ...round,
    judgeMode,
    correctColorId:
      judgeMode === "content" ? round.promptWord : round.promptInk,
  };
}
export interface ChallengeResult extends RoundResult {
  mode: JudgeMode;
  switched: boolean;
}
export function accuracyFor(
  results: readonly ChallengeResult[],
  group: JudgeMode | "switch",
): string {
  const samples = results.filter((r) =>
    group === "switch" ? r.switched : r.mode === group,
  );
  return samples.length
    ? `${Math.round((samples.filter((r) => r.correct).length / samples.length) * 100)}% (${samples.length}問)`
    : "— (出題なし)";
}
