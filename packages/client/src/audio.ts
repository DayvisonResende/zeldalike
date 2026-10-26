import type { Sfx } from '@vale/shared';

/* ---------- Som (sintetizado) ---------- */
let AC: AudioContext | null = null, NB: AudioBuffer | null = null;
export let muted = false;
export function setMuted(v: boolean) { muted = v; }
export function ensureAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    NB = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { AC = null; }
}
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number) {
  const ac = AC!, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol: number, freq: number, ft: BiquadFilterType = 'bandpass') {
  const ac = AC!, t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = NB; f.type = ft; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + dur);
}
const SFX: Record<Sfx, () => void> = {
  swing: () => noise(0.12, 0.22, 2600, 'highpass'),
  cut: () => noise(0.14, 0.3, 1300),
  hit: () => tone('square', 520, 140, 0.12, 0.1),
  lift: () => tone('triangle', 220, 440, 0.12, 0.14),
  throw: () => noise(0.18, 0.18, 900),
  break: () => noise(0.25, 0.38, 600, 'lowpass'),
  splash: () => noise(0.32, 0.28, 1800),
  charge: () => tone('sine', 880, 1320, 0.16, 0.1),
  spin: () => { tone('sawtooth', 300, 900, 0.3, 0.05); noise(0.3, 0.18, 3000, 'highpass'); },
  bump: () => tone('square', 170, 80, 0.15, 0.1),
  poof: () => noise(0.3, 0.28, 500, 'lowpass'),
  sign: () => tone('triangle', 660, 660, 0.06, 0.08),
  bow: () => { tone('triangle', 520, 180, 0.1, 0.12); noise(0.1, 0.12, 3200, 'highpass'); },
  step: () => noise(0.04, 0.16, 700, 'lowpass'),
  dash: () => { tone('sawtooth', 200, 520, 0.14, 0.05); noise(0.16, 0.14, 2200, 'highpass'); },
  bonk: () => { tone('square', 120, 45, 0.22, 0.16); noise(0.15, 0.3, 500, 'lowpass'); },
  hop: () => tone('triangle', 260, 560, 0.14, 0.12),
  land: () => noise(0.12, 0.26, 420, 'lowpass'),
  thunk: () => tone('square', 220, 110, 0.07, 0.08),
  down: () => { tone('triangle', 440, 70, 0.6, 0.14); noise(0.3, 0.2, 400, 'lowpass'); }
};
export function sfx(n: Sfx) { if (muted || !AC) return; try { if (AC.state === 'suspended') AC.resume(); SFX[n](); } catch { } }
