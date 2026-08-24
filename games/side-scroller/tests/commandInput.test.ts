import { describe, expect, it } from "vitest";
import {
  HIOUGI_COMMAND,
  matchesSequence,
  OUGI_COMMAND,
  pushCommandEvent,
} from "../src/logic/commandInput";

function typeSequence(tokens: readonly string[], startTime: number, gapMs: number) {
  let buffer: ReturnType<typeof pushCommandEvent> = [];
  let time = startTime;
  for (const token of tokens) {
    buffer = pushCommandEvent(buffer, token as never, time);
    time += gapMs;
  }
  return buffer;
}

describe("pushCommandEvent", () => {
  it("古い入力（バッファ窓の外）は間引かれる", () => {
    let buffer = pushCommandEvent([], "down", 0);
    buffer = pushCommandEvent(buffer, "forward", 10_000); // 十分に時間が経過
    expect(buffer).toHaveLength(1);
    expect(buffer[0]!.token).toBe("forward");
  });
});

describe("matchesSequence — 奥義コマンド（↓→X）", () => {
  it("素早く順番通り入力すると成立する", () => {
    const buffer = typeSequence(OUGI_COMMAND, 1000, 100);
    expect(matchesSequence(buffer, OUGI_COMMAND)).toBe(true);
  });
  it("順番が違うと成立しない", () => {
    const buffer = typeSequence(["forward", "down", "attack"], 1000, 100);
    expect(matchesSequence(buffer, OUGI_COMMAND)).toBe(false);
  });
  it("トークン間が開きすぎると成立しない", () => {
    const buffer = typeSequence(OUGI_COMMAND, 1000, 1000); // gap が COMMAND_TOKEN_GAP_MS 超過
    expect(matchesSequence(buffer, OUGI_COMMAND)).toBe(false);
  });
  it("余分な入力が前にあっても末尾が一致すれば成立する", () => {
    let buffer = pushCommandEvent([], "attack", 500);
    buffer = pushCommandEvent(buffer, "down", 1000);
    buffer = pushCommandEvent(buffer, "forward", 1100);
    buffer = pushCommandEvent(buffer, "attack", 1200);
    expect(matchesSequence(buffer, OUGI_COMMAND)).toBe(true);
  });
});

describe("matchesSequence — 秘奥義コマンド（↓→↓→X）", () => {
  it("2連続の↓→を素早く入力すると成立する", () => {
    const buffer = typeSequence(HIOUGI_COMMAND, 1000, 100);
    expect(matchesSequence(buffer, HIOUGI_COMMAND)).toBe(true);
  });
  it("奥義コマンド（短い方）だけでは秘奥義コマンドに一致しない", () => {
    const buffer = typeSequence(OUGI_COMMAND, 1000, 100);
    expect(matchesSequence(buffer, HIOUGI_COMMAND)).toBe(false);
  });
});
