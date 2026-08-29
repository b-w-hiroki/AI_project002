/**
 * 効果音は外部音源を使わず Web Audio API で都度合成する（アセット0・軽量）。
 * AudioContext はユーザー操作後にしか開始できないブラウザ制約があるため遅延初期化する。
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, durationSec: number, type: OscillatorType, gainPeak: number, delaySec = 0): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const startAt = audioCtx.currentTime + delaySec;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

export const sfx = {
  tap: () => beep(500, 0.05, "square", 0.04),
  encounter: () => beep(440, 0.08, "sine", 0.05),
  treasure: () => {
    beep(660, 0.09, "triangle", 0.06);
    beep(880, 0.14, "triangle", 0.06, 0.08);
  },
  battleWin: () => {
    beep(523, 0.1, "sine", 0.07);
    beep(784, 0.16, "sine", 0.07, 0.1);
  },
  battleLose: () => beep(260, 0.16, "sawtooth", 0.05),
  gachaDraw: () => beep(500, 0.1, "triangle", 0.06),
  gachaRare: () => {
    beep(660, 0.1, "sine", 0.07);
    beep(880, 0.14, "sine", 0.07, 0.09);
    beep(1108, 0.2, "sine", 0.07, 0.18);
  },
  breed: () => beep(420, 0.12, "triangle", 0.06),
};
