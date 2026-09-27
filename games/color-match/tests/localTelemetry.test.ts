import { describe, expect, it } from "vitest";
import {
  emptyLocalTelemetry,
  loadLocalTelemetry,
  recordLocalActiveTime,
  recordLocalFirstAction,
  recordLocalSessionStart,
  telemetryKey,
  type TelemetryStore,
} from "../../shared/localTelemetry";

function memoryStore(initial: Record<string, string> = {}): TelemetryStore {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

describe("local telemetry", () => {
  it("starts empty", () => {
    expect(loadLocalTelemetry("color-match", memoryStore())).toEqual(emptyLocalTelemetry());
  });
  it("records sessions, first actions and active time", () => {
    const store = memoryStore();
    recordLocalSessionStart("color-match", 1000, store);
    recordLocalFirstAction("color-match", 1100, store);
    recordLocalActiveTime("color-match", 2500, 3600, store);
    expect(loadLocalTelemetry("color-match", store)).toEqual({
      sessions: 1, firstActions: 1, totalActiveMs: 2500, lastStartedAt: 1000, lastActiveAt: 3600,
    });
  });
  it("normalizes corrupt stored values", () => {
    const store = memoryStore({ [telemetryKey("color-match")]: JSON.stringify({ sessions: -5, firstActions: "x", totalActiveMs: -1 }) });
    expect(loadLocalTelemetry("color-match", store)).toEqual(emptyLocalTelemetry());
  });
});
