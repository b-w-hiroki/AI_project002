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

function beep(freq: number, durationSec: number, type: OscillatorType, gainPeak: number): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(gainPeak, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationSec);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + durationSec);
}

export const sfx = {
  click: () => beep(440, 0.08, "sine", 0.06),
  buy: () => beep(660, 0.12, "triangle", 0.08),
  prestige: () => beep(880, 0.4, "sawtooth", 0.05),
  achievement: () => {
    beep(523, 0.1, "sine", 0.07);
    setTimeout(() => beep(784, 0.15, "sine", 0.07), 90);
  },
};
