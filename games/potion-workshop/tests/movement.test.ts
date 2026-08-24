import { describe, expect, it } from "vitest";
import { clampToBounds } from "../src/logic/movement";

const bounds = { width: 800, height: 600, margin: 20 };

describe("clampToBounds", () => {
  it("範囲内の位置はそのまま返す", () => {
    expect(clampToBounds({ x: 400, y: 300 }, bounds)).toEqual({ x: 400, y: 300 });
  });

  it("左上にはみ出したら margin にクランプされる", () => {
    expect(clampToBounds({ x: -10, y: -10 }, bounds)).toEqual({ x: 20, y: 20 });
  });

  it("右下にはみ出したら width/height - margin にクランプされる", () => {
    expect(clampToBounds({ x: 900, y: 700 }, bounds)).toEqual({ x: 780, y: 580 });
  });
});
