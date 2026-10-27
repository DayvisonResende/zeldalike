import { TS } from '../constants';
import type { Carryable, Player } from '../entities/player';
import { blocksShot } from '../world/tiles';
import type { World } from '../world';
import { damage } from './combat';
import { canHarm, harmPlayer } from './pvp';
import { explode } from './bombs';
import { burst, sfx } from './fx';

export interface Thrown { id: number; owner: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; type: Carryable; fuse?: number; dead?: boolean }
export interface Arrow { id: number; owner: string; x: number; y: number; ang: number; vx: number; vy: number; stuck: number; life: number; dead?: boolean }

export function shatter(w: World, x: number, y: number, type: Carryable, z = 0) {
  if (type === 'bomb' || type === 'player') return;
  burst(w, x, y, type === 'b' ? 'leaf' : 'rock', type === 'b' ? 12 : 10, { s: 1.5, z: z + 2 });
  sfx(w, type === 'b' ? 'cut' : 'break', { x, y });
}
export function updateThrown(w: World) {
  for (const o of w.thrown) {
    o.x += o.vx; o.y += o.vy; o.vz -= 0.11; o.z += o.vz;
    const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS);
    if (!w.map.inBounds(tx, ty)) { o.dead = true; continue; }
    const c = w.map.tiles[ty][tx];
    if (o.type === 'bomb') { flyBomb(w, o, c); continue; }
    if (blocksShot(c)) { shatter(w, o.x - o.vx, o.y - o.vy, o.type, o.z); o.dead = true; continue; }
    for (const e of w.enemies) {
      if (!e.dying && o.z < 24 && Math.abs(e.x - o.x) < e.hw + 6 && Math.abs(e.y - o.y) < e.hh + 7) {
        damage(w, e, 2, o.x - o.vx * 3, o.y - o.vy * 3, w.players.get(o.owner)); shatter(w, o.x, o.y, o.type, o.z); o.dead = true; break;
      }
    }
    if (o.dead) continue;
    const thrower = w.players.get(o.owner);
    if (thrower && o.z < 24) for (const v of w.players.values()) {
      if (Math.abs(v.x - o.x) < v.hw + 6 && Math.abs(v.y - o.y) < v.hh + 7 && canHarm(w, thrower, v) && v.inv === 0) {
        harmPlayer(w, thrower, v, 'thrown'); shatter(w, o.x, o.y, o.type, o.z); o.dead = true; break;
      }
    }
    if (o.dead) continue;
    if (o.z <= 0) {
      if (c === 'w') { burst(w, o.x, o.y, 'water', 12, { s: 0.9, z: 0, up: 2.4 }); sfx(w, 'splash', o); }
      else shatter(w, o.x, o.y, o.type);
      o.dead = true;
    }
  }
  w.thrown = w.thrown.filter(o => !o.dead);
}
// Bomba arremessada: o pavio continua; bate e para (sem quebrar); na água, apaga.
function flyBomb(w: World, o: Thrown, c: string) {
  if (--o.fuse! <= 0) { explode(w, o.x, o.y, o.owner); o.dead = true; return; }
  const hitEnemy = w.enemies.some(e => !e.dying && o.z < 20 && Math.abs(e.x - o.x) < e.hw + 4 && Math.abs(e.y - o.y) < e.hh + 5);
  if (blocksShot(c) || hitEnemy || o.z <= 0) {
    o.dead = true;
    if (c === 'w' && !blocksShot(c)) { burst(w, o.x, o.y, 'water', 10, { s: 0.9, z: 0, up: 2.2 }); sfx(w, 'splash', o); return; }
    const back = blocksShot(c) ? 1 : 0;
    w.bombs.push({ id: w.nextId++, owner: o.owner, x: o.x - o.vx * back, y: o.y - o.vy * back, fuse: o.fuse! });
  }
}
export function fireArrow(w: World, p: Player) {
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  w.arrows.push({ id: w.nextId++, owner: p.id, x: p.x + ca * 6, y: p.y + sa * 4, ang: p.aim, vx: ca * 4.6, vy: sa * 4.6, stuck: 0, life: 90 });
  sfx(w, 'bow', p, p.id);
}
export function updateArrows(w: World) {
  for (const a of w.arrows) {
    if (a.stuck) { if (--a.stuck <= 0) a.dead = true; continue; }
    a.x += a.vx; a.y += a.vy;
    if (--a.life <= 0) { a.dead = true; continue; }
    const tx = a.x + Math.cos(a.ang) * 5, ty = a.y + Math.sin(a.ang) * 5;
    const cx = Math.floor(tx / TS), cy = Math.floor(ty / TS);
    if (!w.map.inBounds(cx, cy)) { a.dead = true; continue; }
    if (blocksShot(w.map.tiles[cy][cx])) { a.stuck = 30; sfx(w, 'thunk', { x: tx, y: ty }); burst(w, tx, ty, 'splinter', 3, { s: 0.6, z: 6 }); continue; }
    // inimigo ainda atordoado do último golpe não segura a flecha: ela passa direto
    for (const e of w.enemies) {
      if (!e.dying && e.hurtT === 0 && Math.abs(e.x - tx) < e.hw + 2 && Math.abs(e.y - ty) < e.hh + 5) {
        damage(w, e, 1, a.x - a.vx * 2, a.y - a.vy * 2, w.players.get(a.owner)); a.dead = true; break;
      }
    }
    // jogador fora do PvP não segura a flecha: ela passa por ele
    const archer = w.players.get(a.owner);
    if (!a.dead && archer) for (const v of w.players.values()) {
      if (Math.abs(v.x - tx) < v.hw + 2 && Math.abs(v.y - ty) < v.hh + 5 && canHarm(w, archer, v) && v.inv === 0) { harmPlayer(w, archer, v, 'arrow'); a.dead = true; break; }
    }
  }
  w.arrows = w.arrows.filter(a => !a.dead);
}
