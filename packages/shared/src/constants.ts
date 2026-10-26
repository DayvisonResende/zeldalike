export const TS = 16;                  // tamanho do tile em pixels
export const TICK_RATE = 60;           // passos de simulação por segundo; as velocidades são "por passo"
export const VIEW_W = 256, VIEW_H = 224;
export const SWING = 13, SPIN = 26;

export type Dir = 0 | 1 | 2 | 3;       // 0 baixo, 1 cima, 2 esquerda, 3 direita
export const D: readonly (readonly [number, number])[] = [[0, 1], [0, -1], [-1, 0], [1, 0]];
export const FACE = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];

export function angDir(a: number): Dir { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) > Math.abs(s) ? (c < 0 ? 2 : 3) : (s < 0 ? 1 : 0); }
export const ticks = (seconds: number) => Math.max(1, Math.round(seconds * TICK_RATE));
