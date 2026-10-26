import { SPIN, SWING, TS } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { tileOf } from '../world/pathfinding';
import type { World } from '../world';
import { startSearch } from './ai';
import { burst, sfx } from './fx';
import { breakTile } from './regrowth';
import { harmPlayer } from './pvp';

export interface SwordPose { ox: number; oy: number; ang: number; len: number }

export function swordPose(p: Pick<Player, 'x' | 'y' | 'aim' | 'state' | 't'>): SwordPose | null {
  const ox = p.x + Math.cos(p.aim) * 3, oy = p.y - 6 + Math.sin(p.aim) * 2;
  if (p.state === 'swing') {
    const t = p.t / SWING, e = 1 - Math.pow(1 - Math.min(1, t * 1.15), 3);
    const st = p.aim - 1.7, en = p.aim + 0.9;
    return { ox, oy, ang: st + (en - st) * e, len: 7 + 6 * Math.min(1, t * 2.2) };
  }
  if (p.state === 'charge' || p.state === 'dash') return { ox, oy, ang: p.aim, len: 12 };
  if (p.state === 'spin') return { ox: p.x, oy: p.y - 6, ang: p.aim + (p.t / SPIN) * Math.PI * 2, len: 13 };
  return null;
}
const along = (s: SwordPose, f: number): [number, number] => [s.ox + Math.cos(s.ang) * s.len * f, s.oy + Math.sin(s.ang) * s.len * f + 5];
// Ponto de golpe dentro do corpo (com folga para a altura do sprite). Serve para monstros e jogadores.
export function hitsBody(e: { x: number; y: number; hw: number; hh: number; z: number }, x: number, y: number) { return x > e.x - e.hw - 3 && x < e.x + e.hw + 3 && y > e.y - e.hh - 9 - e.z && y < e.y + e.hh + 3; }
export const hitsEnemy = hitsBody;

export function cutAt(w: World, x: number, y: number, by?: string) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  if (!w.map.inBounds(tx, ty)) return;
  const c = w.map.tiles[ty][tx];
  if (c === 'b') { breakTile(w, tx, ty, '.'); burst(w, tx * TS + 8, ty * TS + 9, 'leaf', 12, { s: 1.4, z: 6 }, by); sfx(w, 'cut', { x, y }, by); }
  else if (c === 'g') { breakTile(w, tx, ty, '.'); burst(w, tx * TS + 8, ty * TS + 10, 'grass', 8, { s: 1, z: 3 }, by); sfx(w, 'cut', { x, y }, by); }
}
export function swordHits(w: World, p: Player) {
  const s = swordPose(p); if (!s) return;
  for (const f of [0.5, 0.8, 1.05]) {
    const [x, y] = along(s, f);
    cutAt(w, x, y, p.id);
    for (const e of w.enemies) {
      if (e.dying || p.hit.has(e.id)) continue;
      if (hitsEnemy(e, x, y)) { p.hit.add(e.id); damage(w, e, p.state === 'spin' ? 2 : 1, p.x, p.y, p); }
    }
    for (const o of w.players.values()) {
      if (o === p || p.hit.has(o.id) || !hitsBody(o, x, y)) continue;
      if (harmPlayer(w, p, o, p.state === 'spin' ? 'spin' : 'sword')) p.hit.add(o.id);
    }
  }
}
// Espada em riste enquanto carrega o giro: a ponta fere quem encostar.
export function pokeTip(w: World, p: Player) {
  const s = swordPose(p); if (!s) return;
  const [x, y] = along(s, 1);
  for (const e of w.enemies) if (!e.dying && e.hurtT === 0 && hitsEnemy(e, x, y)) damage(w, e, 1, p.x, p.y, p);
  for (const o of w.players.values()) if (o !== p && hitsBody(o, x, y)) harmPlayer(w, p, o, 'sword');
}
export function dashHits(w: World, p: Player) {
  const s = swordPose(p); if (!s) return;
  for (const f of [0.6, 1.0]) {
    const [x, y] = along(s, f);
    cutAt(w, x, y, p.id);
    for (const e of w.enemies) if (!e.dying && e.hurtT === 0 && hitsEnemy(e, x, y)) damage(w, e, 2, p.x, p.y, p);
    for (const o of w.players.values()) if (o !== p && hitsBody(o, x, y)) harmPlayer(w, p, o, 'dash');
  }
}
export function damage(w: World, e: Enemy, n: number, sx: number, sy: number, by?: Player) {
  if (e.hurtT > 0) return;
  e.hp -= n; e.hurtT = 16;
  const a = Math.atan2(e.y - sy, e.x - sx);
  e.kx = Math.cos(a) * 3.2; e.ky = Math.sin(a) * 3.2;
  if (e.type === 'slime') { e.mode = 'idle'; e.z = 0; e.timer = 30; }
  // besouro atingido sem ter visto ninguém vai procurar quem bateu
  if (e.type === 'beetle' && e.hp > 0 && e.mode !== 'chase' && by) { e.lastSeen = tileOf(w.map, by.x, by.y); e.alert = 36; startSearch(w, e); }
  sfx(w, 'hit', e);
  if (e.hp <= 0) e.dying = true;
}
