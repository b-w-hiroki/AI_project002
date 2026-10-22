import type Phaser from "phaser";

const pending = new WeakMap<Phaser.Scene, Map<string, Promise<boolean>>>();

/** Load only the selected scene; retain successful images for subsequent visits. */
export function loadOutcome(scene: Phaser.Scene, key: string): Promise<boolean> {
  if (scene.textures.exists(key)) return Promise.resolve(true);
  let jobs = pending.get(scene);
  if (!jobs) { jobs = new Map(); pending.set(scene, jobs); }
  const existing = jobs.get(key);
  if (existing) return existing;
  let resolve!: (success: boolean) => void;
  const job = new Promise<boolean>(done => { resolve = done; });
  // Register before starting: loader events can fire synchronously.
  jobs.set(key, job);
  const event = `filecomplete-image-${key}`;
  let settled = false;
  const finish = (success: boolean) => {
    if (settled) return;
    settled = true;
    scene.load.off(event, complete);
    scene.load.off("loaderror", error);
    scene.events.off("shutdown", shutdown);
    jobs.delete(key);
    resolve(success);
  };
  const complete = () => finish(true);
  const error = (file: Phaser.Loader.File) => { if (file.key === key) finish(false); };
  const shutdown = () => finish(false);
  scene.load.once(event, complete);
  scene.load.on("loaderror", error);
  scene.events.once("shutdown", shutdown);
  try {
    scene.load.image(key, `images/delivery/${key}.webp`, { responseType: "blob", timeout: 15000 });
    if (!scene.load.isLoading()) scene.load.start();
  } catch {
    finish(false);
  }
  return job;
}
