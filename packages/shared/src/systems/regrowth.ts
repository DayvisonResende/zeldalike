import { ticks } from '../constants';
import { overlapsTile } from '../world/collision';
import { SOLID } from '../world/tiles';
import type { World } from '../world';

// Tiles que voltam ao normal: o arbusto cortado cresce de novo, a pedra levantada reaparece.
const KIND = { b: 'bush', g: 'tallGrass', r: 'rock', X: 'secret', Y: 'secret' } as const;
export interface Regrow { tx: number; ty: number; orig: keyof typeof KIND; at: number }

export function breakTile(w: World, tx: number, ty: number, to: string) {
  const orig = w.map.get(tx, ty), k = tx + ',' + ty;
  w.setTile(tx, ty, to);
  if (!w.regrow.has(k) && orig in KIND) {
    const o = orig as keyof typeof KIND;
    w.regrow.set(k, { tx, ty, orig: o, at: w.tick + ticks(w.rules.regrow[KIND[o]]) });
  }
}
export function updateRegrowth(w: World) {
  if (w.tick % 30) return;
  for (const [k, r] of w.regrow) {
    if (w.tick < r.at) continue;
    // não nasce em cima de ninguém: tenta de novo na próxima checagem
    if (SOLID.has(r.orig) && [...w.players.values(), ...w.enemies].some(b => overlapsTile(b, r.tx, r.ty))) continue;
    w.setTile(r.tx, r.ty, r.orig);
    w.regrow.delete(k);
  }
}
