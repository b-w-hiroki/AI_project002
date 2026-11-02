import type { Page } from "@playwright/test";
import type Phaser from "phaser";

// Test-only observation: never advance, pause, or rescale the product clock.
export async function startBattleTiming(page: Page) {
  await page.evaluate(() => {
    const game = window.__qaGame;
    const scene = game.scene.getScene("GameScene");
    const clock = scene.time;
    const started = performance.now();
    let frames = 0, rawTotal = 0, deltaTotal = 0, clockDeltaTotal = 0;
    let maxFrameGap = 0, previousFrame = started, lastSample = -Infinity;
    let previousState = "", stopped = false;
    const timers = (key: string) => (Reflect.get(clock, key) as Phaser.Time.TimerEvent[] | undefined)?.map(t => ({
      delay: t.delay, elapsed: t.elapsed, paused: t.paused, timeScale: t.timeScale,
      hasDispatched: t.hasDispatched,
    })) ?? null;
    const snapshot = () => ({
      wallMs: performance.now() - started, frame: game.loop.frame, frames,
      // Clock.now is the incoming frame timestamp, NOT accumulated timer time.
      frameTimestamp: clock.now, rawTotal, deltaTotal, clockDeltaTotal, maxFrameGap,
      phase: Reflect.get(scene, "phase"), result: !!Reflect.get(scene, "currentBattleResult"),
      active: timers("_active"), pending: timers("_pendingInsertion"), removing: timers("_pendingRemoval"),
      clockPaused: clock.paused, clockScale: clock.timeScale,
      sceneActive: scene.sys.isActive(), scenePaused: scene.sys.isPaused(),
      rawDelta: game.loop.rawDelta, delta: game.loop.delta, fps: game.loop.actualFps,
      cooldown: Reflect.get(game.loop, "_coolDown"), smoothStep: game.loop.smoothStep,
      loopRunning: game.loop.running, loopFocus: game.loop.inFocus,
      visible: document.visibilityState, focused: document.hasFocus(),
    });
    const samples: ReturnType<typeof snapshot>[] = [];
    const milestones: ReturnType<typeof snapshot>[] = [];
    const interruptions: { event: string; wallMs: number }[] = [];
    const initial = snapshot();
    const observe = () => {
      const now = performance.now();
      frames++;
      rawTotal += game.loop.rawDelta;
      deltaTotal += game.loop.delta;
      clockDeltaTotal += clock.paused ? 0 : game.loop.delta * clock.timeScale;
      maxFrameGap = Math.max(maxFrameGap, now - previousFrame);
      previousFrame = now;
      const state = `${Reflect.get(scene, "phase")}:${!!Reflect.get(scene, "currentBattleResult")}`;
      if (state !== previousState) {
        milestones.push(snapshot());
        previousState = state;
      }
      if (now - lastSample >= 100) {
        samples.push(snapshot());
        if (samples.length > 80) samples.shift();
        lastSample = now;
      }
    };
    const interrupt = (event: Event) => {
      interruptions.push({ event: event.type, wallMs: performance.now() - started });
      if (interruptions.length > 40) interruptions.shift();
    };
    scene.events.on("postupdate", observe);
    document.addEventListener("visibilitychange", interrupt);
    window.addEventListener("blur", interrupt);
    window.addEventListener("focus", interrupt);
    Reflect.set(window, "__battleTiming", {
      read: () => ({ initial, final: snapshot(), milestones, samples, interruptions }),
      stop: () => {
        if (stopped) return;
        stopped = true;
        scene.events.off("postupdate", observe);
        document.removeEventListener("visibilitychange", interrupt);
        window.removeEventListener("blur", interrupt);
        window.removeEventListener("focus", interrupt);
      },
    });
  });
}

export async function finishBattleTiming(page: Page) {
  return page.evaluate(() => {
    const probe = Reflect.get(window, "__battleTiming");
    probe.stop();
    return probe.read();
  });
}
