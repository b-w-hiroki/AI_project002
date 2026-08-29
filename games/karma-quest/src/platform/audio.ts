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
  buttonTap: () => beep(440, 0.06, "sine", 0.05),
  karmaUp: () => beep(700, 0.14, "triangle", 0.07),
  karmaDown: () => beep(320, 0.12, "sine", 0.05),
  battleWin: () => {
    beep(523, 0.1, "sine", 0.07);
    beep(659, 0.12, "sine", 0.07, 0.1);
    beep(880, 0.18, "sine", 0.07, 0.2);
  },
  battleLose: () => {
    beep(280, 0.18, "sawtooth", 0.05);
    beep(210, 0.24, "sawtooth", 0.05, 0.14);
  },
  reportSubmit: () => beep(600, 0.16, "triangle", 0.06),
};
