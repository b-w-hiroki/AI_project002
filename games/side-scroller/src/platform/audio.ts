/**
 * 剣戟の森の軽量SE。
 * 外部音源を持たず Web Audio API で都度合成する。
 * AudioContext はユーザー操作後にしか再生開始できないため遅延初期化する。
 */
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

function chirp(
  from: number,
  to: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0,
): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delaySec;
  const stop = start + durationSec;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, from), start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), stop);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, stop);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(stop);
}

function beep(
  freq: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0,
): void {
  chirp(freq, freq, durationSec, type, gainPeak, delaySec);
}

function noiseHit(durationSec: number, gainPeak: number, delaySec = 0): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const falloff = 1 - i / Math.max(1, bufferSize);
    data[i] = (Math.random() * 2 - 1) * falloff;
  }
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const start = audioCtx.currentTime + delaySec;
  source.buffer = buffer;
  gain.gain.setValueAtTime(Math.max(0.001, gainPeak), start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);
  source.connect(gain).connect(audioCtx.destination);
  source.start(start);
}

export const sfx = {
  slash: () => {
    noiseHit(0.055, 0.045);
    chirp(980, 340, 0.09, "sawtooth", 0.025);
  },
  hit: () => {
    noiseHit(0.085, 0.085);
    chirp(190, 120, 0.08, "square", 0.028);
  },
  hurt: () => {
    noiseHit(0.1, 0.07);
    chirp(150, 85, 0.13, "square", 0.035);
  },
  guard: () => {
    beep(720, 0.055, "triangle", 0.04);
    beep(1040, 0.07, "sine", 0.035, 0.025);
  },
  skill: () => {
    chirp(280, 880, 0.16, "sawtooth", 0.045);
    beep(1180, 0.08, "sine", 0.025, 0.09);
  },
  bossCharge: () => {
    chirp(170, 72, 0.28, "sawtooth", 0.04);
    noiseHit(0.16, 0.035, 0.08);
  },
  waveClear: () => {
    beep(523, 0.11, "sine", 0.055);
    beep(659, 0.11, "sine", 0.055, 0.09);
    beep(784, 0.18, "sine", 0.06, 0.18);
  },
};
