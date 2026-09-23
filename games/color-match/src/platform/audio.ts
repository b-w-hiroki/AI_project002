/** Color Matchの軽量フィードバック音。常時BGMは使わず、集中を邪魔しない短音だけを合成する。 */
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(
  frequency: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType = "sine",
  delaySec = 0,
): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delaySec;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + durationSec);
}

export const sfx = {
  correct: () => tone(660, 0.055, 0.025, "triangle"),
  miss: () => tone(180, 0.07, 0.02, "sine"),
  flowEnter: () => {
    tone(440, 0.08, 0.035, "triangle");
    tone(660, 0.09, 0.035, "triangle", 0.06);
    tone(880, 0.12, 0.04, "sine", 0.12);
  },
  flowPulse: (streak: number) => {
    const step = Math.min(5, Math.max(0, streak - 5));
    tone(520 + step * 55, 0.055, 0.018, "sine");
  },
  flowBreak: () => tone(260, 0.08, 0.018, "triangle"),
};
