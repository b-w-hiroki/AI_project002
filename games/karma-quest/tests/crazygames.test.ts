import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["gameplayStart", "gameplayStop", "happytime", "loadingStart", "loadingStop"] as const)("isolates a failing %s hook and disables further notifications", async hook => {
  const fail = vi.fn(() => { throw new Error("Portal unavailable"); });
  vi.stubGlobal("window", { CrazyGames: { SDK: {
    init: async () => {}, user: { systemInfo: { locale: "ja" } }, game: { [hook]: fail },
  } } });
  const { initCrazyGames, cg } = await import("../src/platform/crazygames");
  expect(await initCrazyGames()).toBe(true);
  expect(() => cg[hook]()).not.toThrow();
  expect(() => cg[hook]()).not.toThrow();
  expect(fail).toHaveBeenCalledOnce();
  const { getPortalLocale } = await import("../../shared/locale");
  expect(getPortalLocale()).toBe("ja");
});

it("continues without SDK when initialization stalls, ignoring its late completion", async () => {
  let release!: () => void;
  const start = vi.fn();
  vi.stubGlobal("window", {
    location: { hostname: "localhost" },
    CrazyGames: { SDK: {
      init: () => new Promise<void>(resolve => { release = resolve; }),
      user: { systemInfo: { locale: "en" } },
      game: { gameplayStart: start },
    } },
  });
  const { initCrazyGames, cg } = await import("../src/platform/crazygames");
  const settled = vi.fn();
  const result = initCrazyGames().then(settled);
  await vi.advanceTimersByTimeAsync(8001);
  expect(settled).toHaveBeenCalledWith(false);
  release();
  await result;
  await Promise.resolve();
  cg.gameplayStart();
  expect(start).not.toHaveBeenCalled();
  const { getPortalLocale } = await import("../../shared/locale");
  expect(getPortalLocale()).toBeUndefined();
});

it("continues when the SDK script never responds and removes its listeners", async () => {
  const script = { src: "", onload: null, onerror: null, remove: vi.fn() };
  vi.stubGlobal("window", { location: { hostname: "www.crazygames.com" } });
  vi.stubGlobal("document", { referrer: "", createElement: () => script, head: { appendChild: vi.fn() } });
  const { initCrazyGames } = await import("../src/platform/crazygames");
  const settled = vi.fn();
  const result = initCrazyGames().then(settled);
  await vi.advanceTimersByTimeAsync(8001);
  expect(settled).toHaveBeenCalledWith(false);
  await result;
  expect(script.onload).toBeNull();
  expect(script.onerror).toBeNull();
});

it("keeps portal locale and gameplay hooks when initialization succeeds", async () => {
  const start = vi.fn();
  vi.stubGlobal("window", { location: { hostname: "localhost" }, CrazyGames: { SDK: {
    init: async () => {}, user: { systemInfo: { locale: "en-US" } }, game: { gameplayStart: start },
  } } });
  const { initCrazyGames, cg } = await import("../src/platform/crazygames");
  expect(await initCrazyGames()).toBe(true);
  cg.gameplayStart();
  expect(start).toHaveBeenCalledOnce();
  const { getPortalLocale } = await import("../../shared/locale");
  expect(getPortalLocale()).toBe("en-US");
  expect(vi.getTimerCount()).toBe(0);
});
