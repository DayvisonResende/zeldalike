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
  down: () => { tone('triangle', 440, 70, 0.6, 0.14); noise(0.3, 0.2, 400, 'lowpass'); },
  pickup: () => { tone('square', 880, 880, 0.05, 0.06); setTimeout(() => tone('square', 1320, 1320, 0.07, 0.06), 55); },
  use: () => { tone('sine', 300, 600, 0.12, 0.12); setTimeout(() => tone('sine', 450, 900, 0.12, 0.1), 90); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('square', f, f, 0.12, 0.07), i * 90)); },
  // achou épico: arpejo brilhante; lendário: arpejo mais longo e um acorde final que fica soando
  rare: () => { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone('triangle', f, f * 1.01, 0.16, 0.09), i * 70)); },
  legend: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.14, 0.09), i * 75));
    setTimeout(() => [1047, 1319, 1568].forEach(f => tone('sine', f, f, 0.9, 0.06)), 460);
  },
  // convite para grupo: dois toques de campainha, para não passar despercebido
  invite: () => { [988, 1319].forEach((f, i) => setTimeout(() => tone('sine', f, f, 0.22, 0.12), i * 160)); setTimeout(() => [988, 1319].forEach((f, i) => setTimeout(() => tone('sine', f, f, 0.22, 0.09), i * 160)), 900); },
  cluck: () => { tone('square', 700, 520, 0.05, 0.07); setTimeout(() => tone('square', 760, 560, 0.05, 0.07), 70); },
  swarm: () => { for (let i = 0; i < 6; i++) setTimeout(() => tone('square', 600 + i * 60, 450, 0.06, 0.06), i * 55); },
  fuse: () => noise(0.5, 0.06, 5000, 'highpass'),
  boom: () => { noise(0.7, 0.55, 300, 'lowpass'); tone('sawtooth', 110, 30, 0.6, 0.18); },
  fire: () => { noise(0.28, 0.22, 1200, 'lowpass'); tone('sawtooth', 240, 120, 0.2, 0.06); },
  heal: () => { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone('sine', f, f, 0.18, 0.06), i * 60)); },
  shadow: () => { tone('sine', 220, 110, 0.35, 0.12); tone('triangle', 330, 165, 0.35, 0.05); },
  scrape: () => { noise(0.35, 0.22, 380, 'lowpass'); tone('square', 70, 55, 0.3, 0.05); },
  cast: () => { noise(0.2, 0.15, 2400, 'highpass'); setTimeout(() => noise(0.12, 0.18, 900), 220); },
  bite: () => { tone('square', 880, 660, 0.06, 0.09); setTimeout(() => tone('square', 880, 660, 0.06, 0.09), 110); },
  chest: () => { noise(0.18, 0.2, 700, 'lowpass'); [659, 784, 988].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.14, 0.08), 120 + i * 80)); }
};
export function sfx(n: Sfx) { if (muted || !AC) return; try { if (AC.state === 'suspended') AC.resume(); SFX[n](); } catch { } }
