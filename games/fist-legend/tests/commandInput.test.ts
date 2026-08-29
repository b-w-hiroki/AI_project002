import { describe, expect, it } from "vitest";
import { HIDDEN_COMMAND, matchesSequence, pushMoveEvent } from "../src/logic/commandInput";

describe("pushMoveEvent", () => {
  it("バッファに手を積み増していく", () => {
    let buf = pushMoveEvent([], "punch", 0);
    buf = pushMoveEvent(buf, "kick", 100);
    expect(buf).toEqual([
      { move: "punch", time: 0 },
      { move: "kick", time: 100 },
    ]);
  });

  it("バッファウィンドウより古い入力は間引かれる", () => {
    let buf = pushMoveEvent([], "punch", 0);
    buf = pushMoveEvent(buf, "kick", 5000);
    expect(buf).toEqual([{ move: "kick", time: 5000 }]);
  });
});

describe("matchesSequence", () => {
  it("拳拳拳気の順で入力すると一致する", () => {
    let buf: ReturnType<typeof pushMoveEvent> = [];
    buf = pushMoveEvent(buf, "punch", 0);
    buf = pushMoveEvent(buf, "punch", 300);
    buf = pushMoveEvent(buf, "punch", 600);
    buf = pushMoveEvent(buf, "ki", 900);
    expect(matchesSequence(buf, HIDDEN_COMMAND)).toBe(true);
  });

  it("順番が違うと一致しない", () => {
    let buf: ReturnType<typeof pushMoveEvent> = [];
    buf = pushMoveEvent(buf, "punch", 0);
    buf = pushMoveEvent(buf, "punch", 300);
    buf = pushMoveEvent(buf, "ki", 600);
    buf = pushMoveEvent(buf, "punch", 900);
    expect(matchesSequence(buf, HIDDEN_COMMAND)).toBe(false);
  });

  it("入力間隔が空きすぎると不成立", () => {
    let buf: ReturnType<typeof pushMoveEvent> = [];
    buf = pushMoveEvent(buf, "punch", 0);
    buf = pushMoveEvent(buf, "punch", 300);
    buf = pushMoveEvent(buf, "punch", 600);
    buf = pushMoveEvent(buf, "ki", 2500);
    expect(matchesSequence(buf, HIDDEN_COMMAND)).toBe(false);
  });

  it("バッファがシーケンスより短ければ不成立", () => {
    let buf: ReturnType<typeof pushMoveEvent> = [];
    buf = pushMoveEvent(buf, "punch", 0);
    buf = pushMoveEvent(buf, "ki", 300);
    expect(matchesSequence(buf, HIDDEN_COMMAND)).toBe(false);
  });

  it("先頭に余分な入力があっても末尾が一致すれば成立する", () => {
    let buf: ReturnType<typeof pushMoveEvent> = [];
    buf = pushMoveEvent(buf, "kick", 0);
    buf = pushMoveEvent(buf, "punch", 300);
    buf = pushMoveEvent(buf, "punch", 600);
    buf = pushMoveEvent(buf, "punch", 900);
    buf = pushMoveEvent(buf, "ki", 1200);
    expect(matchesSequence(buf, HIDDEN_COMMAND)).toBe(true);
  });
});
