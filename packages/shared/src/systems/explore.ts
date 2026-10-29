import { TS } from '../constants';
import type { Player } from '../entities/player';
import type { World } from '../world';

/* ---------- Mapa explorado ----------
   Cada personagem guarda, por mapa, quais tiles já viu: uma grade de bits (1 = explorado). Andando, revela um círculo
   de REVEAL tiles em volta. O servidor guarda e salva; o cliente faz a mesma conta para desenhar o mapa sem esperar. */
export const REVEAL = 7;

export const exploredSize = (cols: number, rows: number) => Math.ceil(cols * rows / 8);
export const isExplored = (bits: Uint8Array, cols: number, tx: number, ty: number) => {
  const i = ty * cols + tx;
  return ((bits[i >> 3] ?? 0) & (1 << (i & 7))) !== 0;
};
// Revela o círculo em volta do tile (cx, cy). Devolve true se algo novo apareceu.
export function reveal(bits: Uint8Array, cols: number, rows: number, cx: number, cy: number, r = REVEAL) {
  let changed = false;
  for (let ty = Math.max(0, cy - r); ty <= Math.min(rows - 1, cy + r); ty++)
    for (let tx = Math.max(0, cx - r); tx <= Math.min(cols - 1, cx + r); tx++) {
      if ((tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) > r * r) continue;
      const i = ty * cols + tx, m = 1 << (i & 7);
      if (!(bits[i >> 3] & m)) { bits[i >> 3] |= m; changed = true; }
    }
  return changed;
}
export function exploredOf(w: World, p: Player) {
  const n = exploredSize(w.map.cols, w.map.rows);
  let b = p.explored[w.id];
  if (!b || b.length !== n) b = p.explored[w.id] = new Uint8Array(n);
  return b;
}
// No servidor, a cada poucos passos: revela em volta de cada um.
export function updateExplore(w: World) {
  if (w.tick % 10) return;
  for (const p of w.players.values()) {
    if (p.state === 'dead') continue;
    reveal(exploredOf(w, p), w.map.cols, w.map.rows, Math.floor(p.x / TS), Math.floor(p.y / TS));
  }
}
// Para o banco e para a rede: bits em base64 (escrito aqui para rodar igual no servidor e no navegador).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bitsToBase64(bits: Uint8Array) {
  let s = '';
  for (let i = 0; i < bits.length; i += 3) {
    const n = (bits[i] << 16) | ((bits[i + 1] ?? 0) << 8) | (bits[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bits.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bits.length ? B64[n & 63] : '=');
  }
  return s;
}
// Texto estranho ou curto demais: o que faltar fica inexplorado.
export function base64ToBits(text: string, size: number) {
  const out = new Uint8Array(size), clean = typeof text === 'string' ? text.replace(/[^A-Za-z0-9+/]/g, '') : '';
  for (let i = 0, o = 0; i + 1 < clean.length && o < size; i += 4) {
    const v = [0, 1, 2, 3].map(k => { const c = B64.indexOf(clean[i + k] ?? 'A'); return c < 0 ? 0 : c; });
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out[o++] = (n >> 16) & 255; if (o < size && i + 2 < clean.length) out[o++] = (n >> 8) & 255; if (o < size && i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}
