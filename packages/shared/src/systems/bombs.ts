import { TS, ticks } from '../constants';
import type { Player } from '../entities/player';
import { takeItem } from '../items';
import type { World } from '../world';
import { damage } from './combat';
import { burst, sfx } from './fx';
import { canHarm, harmPlayer } from './pvp';
import { shatter } from './projectiles';
import { dropCarried } from './throwing';
import { breakTile } from './regrowth';
import { nearCave } from '../world/tiles';

/* ---------- Bombas ----------
   Ficam no chão com o pavio queimando; dá para levantar (E) uma bomba acesa e arremessar. Segurar demais: explode na mão.
   A explosão abre paredes rachadas, destrói arbustos, mato e pedras, fere monstros e empurra todo mundo;
   em outro jogador só causa dano se as regras de PvP deixarem. */
export interface Bomb { id: number; owner: string; x: number; y: number; fuse: number }
export const FUSE = 150;           // 2,5 s
export const BLAST = 26;           // raio da explosão (px)

export function placeBomb(w: World, p: Player, x: number, y: number, fuse = FUSE) {
  w.bombs.push({ id: w.nextId++, owner: p.id, x, y, fuse });
  sfx(w, 'fuse', { x, y });
}
// Usar a bomba do inventário: põe uma acesa na frente.
export function useBomb(w: World, p: Player, slot: number) {
  takeItem(p.bag, slot); p.bagVersion++;
  const dx = p.dir === 2 ? -10 : p.dir === 3 ? 10 : 0, dy = p.dir === 0 ? 8 : p.dir === 1 ? -6 : 2;
  placeBomb(w, p, p.x + dx, p.y + dy);
}
// Bomba na frente de quem apertou E? Levanta.
export function liftBomb(w: World, p: Player, fx: number, fy: number) {
  const i = w.bombs.findIndex(b => Math.abs(b.x - fx) < 10 && Math.abs(b.y - fy) < 10);
  if (i < 0) return false;
  const b = w.bombs[i]; w.bombs.splice(i, 1);
  p.carry = 'bomb'; p.carryFuse = b.fuse; p.liftFrom = { x: b.x, y: b.y }; p.state = 'lift'; p.t = 0;
  sfx(w, 'lift', p, p.id);
  return true;
}

export function explode(w: World, x: number, y: number, ownerId: string) {
  const owner = w.players.get(ownerId);
  // tiles em volta: rachaduras abrem, arbustos/mato/pedras quebram
  for (let ty = Math.floor((y - BLAST) / TS); ty <= Math.floor((y + BLAST) / TS); ty++)
    for (let tx = Math.floor((x - BLAST) / TS); tx <= Math.floor((x + BLAST) / TS); tx++) {
      if (!w.map.inBounds(tx, ty) || Math.hypot(tx * TS + 8 - x, ty * TS + 8 - y) > BLAST + 6) continue;
      const c = w.map.tiles[ty][tx], cave = nearCave((a, b) => w.map.get(a, b), tx, ty);
      if (c === 'X') breakTile(w, tx, ty, 'd');
      else if (c === 'Y') breakTile(w, tx, ty, 'q');
      else if (c === 'b' || c === 'g') breakTile(w, tx, ty, cave ? 'q' : '.');
      else if (c === 'r') { breakTile(w, tx, ty, cave ? 'q' : 'd'); shatter(w, tx * TS + 8, ty * TS + 8, 'r'); continue; }
      else continue;
      burst(w, tx * TS + 8, ty * TS + 8, c === 'X' || c === 'Y' ? 'rock' : 'leaf', 10, { s: 1.6, z: 6 });
    }
  for (const e of w.enemies) if (!e.dying && Math.hypot(e.x - x, e.y - y) < BLAST + e.hw) damage(w, e, w.rules.weapons.bomb, x, y, owner);
  for (const p of w.players.values()) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 120) w.emit({ t: 'shake', to: p.id, n: d < BLAST * 2 ? 12 : 5 });
    if (d >= BLAST + p.hw || p.state === 'dead') continue;
    if (owner && p !== owner && canHarm(w, owner, p) && p.inv === 0) { harmPlayer(w, owner, p, 'bomb'); continue; }
    blastPush(w, p, x, y);   // sem PvP (ou você mesmo): só o empurrão
  }
  burst(w, x, y, 'spark', 16, { s: 2.2, z: 4, up: 2.6 }); burst(w, x, y, 'dust', 12, { s: 1.8, z: 2, up: 1.6 });
  w.emit({ t: 'poof', x, y: y - 4 });
  sfx(w, 'boom', { x, y });
}
function blastPush(w: World, p: Player, x: number, y: number) {
  if (p.state === 'hop' || p.state === 'held' || p.state === 'flying') return;
  const a = Math.atan2(p.y - y, p.x - x || 0.01);
  dropCarried(w, p); p.fish = null;
  p.kx = Math.cos(a) * 4; p.ky = Math.sin(a) * 4; p.state = 'hurt'; p.t = 12;
}

// Uma vez por passo: pavios queimando (no chão, voando e na mão de alguém).
export function updateBombs(w: World) {
  for (const b of w.bombs) if (--b.fuse <= 0) explode(w, b.x, b.y, b.owner);
  w.bombs = w.bombs.filter(b => b.fuse > 0);
  for (const p of w.players.values()) if (p.carry === 'bomb' && --p.carryFuse <= 0) {
    p.carry = null; if (p.state === 'carry' || p.state === 'lift') p.state = 'walk';
    explode(w, p.x, p.y - 8, p.id);   // segurou demais
  }
}
export const fuseTicks = (seconds: number) => ticks(seconds);
