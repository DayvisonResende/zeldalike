import { TS, ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { EnemyType } from '../rules';
import type { World } from '../world';
import { inSafeZone } from './pvp';

export interface Spawn { type: EnemyType; tx: number; ty: number; alive: number | null; at: number }

export function createEnemy(w: World, type: EnemyType, tx: number, ty: number, spawn: number): Enemy {
  const r = w.rng;
  return { id: w.nextId++, type, spawn, x: tx * TS + 8, y: ty * TS + 10, hw: 6, hh: type === 'slime' ? 4 : 5, hp: w.rules.enemies[type].hp, hurtT: 0, kx: 0, ky: 0, z: 0,
    anim: r.int(60), mode: type === 'slime' ? 'idle' : 'patrol', timer: r.range(20, 80) | 0, dir: r.int(4) as Enemy['dir'], vx: 0, vy: 0, dying: false, dead: false,
    next: null, alert: 0, lost: 0, lastSeen: null, searchMap: null, search: 0 };
}
export function onEnemyDead(w: World, e: Enemy) {
  const s = w.spawns[e.spawn];
  if (s) { s.alive = null; s.at = w.tick + ticks(w.rules.enemies[e.type].respawn); }
}
// Renasce no ponto de origem quando o tempo passa, mas nunca na cara de alguém.
export function updateSpawns(w: World) {
  if (w.tick % 30) return;
  w.spawns.forEach((s, i) => {
    if (s.alive !== null || w.tick < s.at) return;
    const x = s.tx * TS + 8, y = s.ty * TS + 10;
    if (inSafeZone(w, x, y)) return;   // a zona pode ter virado segura pela config
    for (const p of w.players.values()) if (Math.hypot(p.x - x, p.y - y) < 48) return;
    const e = createEnemy(w, s.type, s.tx, s.ty, i);
    w.enemies.push(e); s.alive = e.id;
    w.emit({ t: 'poof', x, y: y - 4 });
  });
}
