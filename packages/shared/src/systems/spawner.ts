import { TS, ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { EnemyType } from '../rules';
import type { World } from '../world';
import { inSafeZone } from './pvp';
import { isNight } from './daynight';
import { dropLoot } from './loot';
import { shareXp } from './progress';
import { onInvaderDead } from './invasion';
import { onKingDead } from './boss';
import { deathBlast } from './effects';

export interface Spawn { type: EnemyType; tx: number; ty: number; alive: number | null; at: number; when?: 'day' | 'night'; mini?: boolean }

export function createEnemy(w: World, type: EnemyType, tx: number, ty: number, spawn: number): Enemy {
  const r = w.rng, mini = !!w.spawns?.[spawn]?.mini, hp = w.rules.enemies[type].hp * (mini ? 6 : 1);
  return { id: w.nextId++, type, spawn, ...(mini ? { mini } : {}), x: tx * TS + 8, y: ty * TS + 10, hw: type === 'king' ? 12 : 6, hh: type === 'king' ? 8 : type === 'beetle' ? 5 : 4, hp, maxHp: hp, hurtT: 0, kx: 0, ky: 0, z: type === 'bat' ? 8 : 0,
    lastHitBy: null, anger: 0, angerBy: null, angerAt: 0, swarm: null, anim: r.int(60), mode: type === 'slime' ? 'idle' : 'patrol', timer: r.range(20, 80) | 0, dir: r.int(4) as Enemy['dir'], vx: 0, vy: 0, dying: false, dead: false,
    next: null, alert: 0, lost: 0, lastSeen: null, searchMap: null, search: 0 };
}
export function onEnemyDead(w: World, e: Enemy) {
  const killer = e.lastHitBy ? w.players.get(e.lastHitBy) : undefined;
  if (e.type === 'king') onKingDead(w, e);
  else { if (killer) shareXp(w, killer, w.rules.enemies[e.type].xp * (e.mini ? 5 : 1)); dropLoot(w, e, killer); }
  deathBlast(w, e, killer);
  if (e.invader) onInvaderDead(w, killer?.id);
  const s = w.spawns[e.spawn];
  if (s) { s.alive = null; s.at = w.tick + ticks(w.rules.enemies[e.type].respawn); }
}
// Renasce no ponto de origem quando o tempo passa, mas nunca na cara de alguém.
// Monstro só de noite (ou só de dia) fora do seu período: some numa nuvem e volta quando o período chegar.
export const inPeriod = (w: World, s: Spawn) => !s.when || (s.when === 'night') === isNight(w);
export function updateSpawns(w: World) {
  if (w.tick % 30) return;
  for (const e of w.enemies) {
    const s = w.spawns[e.spawn];
    if (s && !e.dying && !inPeriod(w, s)) { e.dead = true; s.alive = null; s.at = w.tick; w.emit({ t: 'poof', x: e.x, y: e.y - 4 }); }
  }
  if (w.instance) return;   // masmorra: o que foi derrubado fica derrubado (a cópia é do grupo e some quando esvazia)
  w.spawns.forEach((s, i) => {
    if (s.alive !== null || w.tick < s.at || !inPeriod(w, s)) return;
    const x = s.tx * TS + 8, y = s.ty * TS + 10;
    if (inSafeZone(w, x, y)) return;   // a zona pode ter virado segura pela config
    for (const p of w.players.values()) if (Math.hypot(p.x - x, p.y - y) < 48) return;
    const e = createEnemy(w, s.type, s.tx, s.ty, i);
    w.enemies.push(e); s.alive = e.id;
    w.emit({ t: 'poof', x, y: y - 4 });
    if (s.type === 'king') w.emit({ t: 'announce', text: `O Rei Geleca despertou: ${w.map.data.name} treme!` });
  });
}
