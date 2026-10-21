/// <reference types="node" />
import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { loadOutcome } from "../src/outcomeLoader";

function fixture() {
  const load = Object.assign(new EventEmitter(), { image: vi.fn(), isLoading: () => false, start: vi.fn() });
  const events = new EventEmitter();
  const scene = { load, events, textures: { exists: () => false } } as unknown as Phaser.Scene;
  return { scene, load, events };
}

it.each(["image", "start"] as const)("allows retry after synchronous %s failure and removes listeners", async method => {
  const { scene, load, events } = fixture();
  load[method].mockImplementationOnce(() => { throw new Error("Loader failed"); });
  await expect(loadOutcome(scene, "art")).resolves.toBe(false);
  expect(load.listenerCount("loaderror")).toBe(0);
  expect(events.listenerCount("shutdown")).toBe(0);
  const retry = loadOutcome(scene, "art");
  load.emit("filecomplete-image-art");
  await expect(retry).resolves.toBe(true);
});

it("shares pending requests and clears them on shutdown", async () => {
  const { scene, load, events } = fixture();
  const first = loadOutcome(scene, "art");
  expect(loadOutcome(scene, "art")).toBe(first);
  expect(load.image).toHaveBeenCalledOnce();
  events.emit("shutdown");
  await expect(first).resolves.toBe(false);
  expect(load.listenerCount("loaderror")).toBe(0);
  const retry = loadOutcome(scene, "art");
  load.emit("filecomplete-image-art");
  await expect(retry).resolves.toBe(true);
});

it("does not retain a failure emitted synchronously during start", async () => {
  const { scene, load } = fixture();
  load.start.mockImplementationOnce(() => load.emit("loaderror", { key: "art" }));
  await expect(loadOutcome(scene, "art")).resolves.toBe(false);
  const retry = loadOutcome(scene, "art");
  load.emit("filecomplete-image-art");
  await expect(retry).resolves.toBe(true);
});
