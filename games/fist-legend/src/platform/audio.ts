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

function noiseHit(durationSec: number, gainPeak: number): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(gainPeak, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationSec);
  source.connect(gain).connect(audioCtx.destination);
  source.start();
}

export const sfx = {
  buttonTap: () => beep(420, 0.06, "sine", 0.05),
  hitAdvantage: () => {
    noiseHit(0.12, 0.14);
    beep(220, 0.1, "square", 0.05);
  },
  hitDisadvantage: () => beep(180, 0.08, "sine", 0.04),
  hitClash: () => noiseHit(0.08, 0.08),
  ougi: () => {
    beep(300, 0.18, "sawtooth", 0.08);
    beep(600, 0.22, "sawtooth", 0.06, 0.08);
  },
  win: () => {
    beep(523, 0.12, "sine", 0.08);
    beep(659, 0.12, "sine", 0.08, 0.11);
    beep(784, 0.2, "sine", 0.08, 0.22);
  },
  lose: () => {
    beep(300, 0.2, "sawtooth", 0.06);
    beep(220, 0.3, "sawtooth", 0.06, 0.15);
  },
  gachaDraw: () => beep(500, 0.1, "triangle", 0.06),
  gachaRare: () => {
    beep(660, 0.1, "sine", 0.07);
    beep(880, 0.14, "sine", 0.07, 0.09);
    beep(1108, 0.2, "sine", 0.07, 0.18);
  },
};
