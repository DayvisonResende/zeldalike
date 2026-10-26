import { D, TS } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { move } from '../world/collision';
import { bfs, distAt, lineOfSight, nextLower, tileOf, type DistMap } from '../world/pathfinding';
import type { World } from '../world';
import { sfx } from './fx';
import { inSafeZone } from './pvp';
import { onEnemyDead } from './spawner';

// Monstro anda como qualquer corpo, mas não entra em zona segura (se já estava dentro, pode sair).
function moveEnemy(w: World, e: Enemy, dx: number, dy: number) {
  const ox = e.x, oy = e.y, hit = move(w.map, e, dx, dy);
  if (inSafeZone(w, e.x, e.y) && !inSafeZone(w, ox, oy)) { e.x = ox; e.y = oy; return true; }
  return hit;
}

/* ---------- Mapa de fluxo: setas apontando para a jogadora mais próxima ---------- */
const FLOW_RADIUS = 32;   // tiles; inimigos mais longe que isso de qualquer jogador não perseguem
export function refreshFlow(w: World) {
  const src = [...w.players.values()].filter(p => p.state !== 'dead').map(p => tileOf(w.map, p.x, p.y));
  const key = w.map.version + '|' + src.map(s => s.join(',')).sort().join(';');
  if (key === w.flowKey) return;
  const changed = !w.flowKey.startsWith(w.map.version + '|');
  w.flow = bfs(w.map, src, FLOW_RADIUS); w.flowKey = key;
  if (changed) for (const e of w.enemies) if (e.mode === 'search' && e.lastSeen) e.searchMap = bfs(w.map, [e.lastSeen], FLOW_RADIUS);
}
export function startSearch(w: World, e: Enemy) { e.mode = 'search'; e.search = 300; e.next = null; e.searchMap = bfs(w.map, [e.lastSeen!], FLOW_RADIUS); }

function nearest(w: World, e: Enemy, maxDist: number, test?: (p: Player) => boolean) {
  let best: Player | null = null, bd = maxDist;
  for (const p of w.players.values()) { if (p.state === 'dead') continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd && (!test || test(p))) { bd = d; best = p; } }
  return best;
}
function steer(w: World, e: Enemy, tx: number, ty: number, sp: number) {
  const dx = tx - e.x, dy = ty - e.y;
  if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  if (moveEnemy(w, e, Math.max(-sp, Math.min(sp, dx)), Math.max(-sp, Math.min(sp, dy)))) e.next = null;
  return Math.abs(dx) < 2 && Math.abs(dy) < 2;
}
// Anda de centro em centro de tile, descendo o mapa de distâncias. Retorna true ao chegar (ou se não houver caminho).
function followMap(w: World, e: Enemy, map: DistMap | null, gx: number, gy: number, sp: number) {
  if (!map) return true;
  if (e.next && Math.abs(e.x - e.next.x) <= sp + 0.05 && Math.abs(e.y - e.next.y) <= sp + 0.05) { e.x = e.next.x; e.y = e.next.y; e.next = null; }
  const [cx, cy] = tileOf(w.map, e.x, e.y), v = distAt(map, cx, cy);
  if (!isFinite(v)) return true;
  if (!e.next) {
    if (v === 0) return steer(w, e, gx, gy, sp);
    const ctrX = cx * TS + 8, ctrY = cy * TS + 8;
    if (Math.abs(e.x - ctrX) > 1 || Math.abs(e.y - ctrY) > 1) e.next = { x: ctrX, y: ctrY };
    else { const n = nextLower(map, cx, cy); if (!n) return true; e.next = { x: n[0] * TS + 8, y: n[1] * TS + 8 }; }
  }
  steer(w, e, e.next.x, e.next.y, sp);
  return false;
}

function updateSlime(w: World, e: Enemy) {
  if (e.mode === 'idle') {
    if (--e.timer <= 0) {
      let ang = w.rng.range(0, Math.PI * 2);
      const p = nearest(w, e, 110);
      if (p && w.flow) {
        const [cx, cy] = tileOf(w.map, e.x, e.y);
        if (distAt(w.flow, cx, cy) <= 14) {   // mira dois tiles adiante no caminho, com um pouco de ruído
          const n = nextLower(w.flow, cx, cy), m = n && nextLower(w.flow, n[0], n[1]), t = m || n;
          ang = Math.atan2((t ? t[1] * TS + 8 : p.y) - e.y, (t ? t[0] * TS + 8 : p.x) - e.x) + w.rng.range(-0.45, 0.45);
        }
      }
      e.vx = Math.cos(ang) * 1.05; e.vy = Math.sin(ang) * 1.05; e.mode = 'hop'; e.timer = 26;
    }
  } else {
    moveEnemy(w, e, e.vx, e.vy); e.timer--;
    e.z = Math.sin(Math.PI * (1 - e.timer / 26)) * 7;
    if (e.timer <= 0) { e.mode = 'idle'; e.z = 0; e.timer = w.rng.range(30, 80) | 0; }
  }
}

// Besouro: patrulha → vê alguém (alcance + linha de visão + caminho curto) → persegue → perde de vista → procura → patrulha
function updateBeetle(w: World, e: Enemy) {
  if (e.alert > 0) e.alert--;
  const [ex, ey] = tileOf(w.map, e.x, e.y), pathLen = w.flow ? distAt(w.flow, ex, ey) : Infinity;
  const seen = pathLen <= 18 ? nearest(w, e, 96, p => lineOfSight(w.map, e.x, e.y - 2, p.x, p.y - 4)) : null;
  if (seen) {
    if (e.mode !== 'chase') { e.alert = 36; e.next = null; }
    e.mode = 'chase'; e.lastSeen = tileOf(w.map, seen.x, seen.y); e.lost = 0;
  }
  if (e.mode === 'chase') {
    if (!seen) e.lost++;
    if (e.lost > 24) startSearch(w, e);
    else { const p = seen ?? nearest(w, e, Infinity); followMap(w, e, w.flow, p ? p.x : e.x, p ? p.y : e.y, 0.9); return; }
  }
  if (e.mode === 'search') {
    const [lx, ly] = e.lastSeen!;
    const done = followMap(w, e, e.searchMap, lx * TS + 8, ly * TS + 8, 0.65);
    if (done || --e.search <= 0) { e.mode = 'patrol'; e.timer = 40; e.next = null; }
    return;
  }
  if (--e.timer <= 0) { e.dir = w.rng.int(4) as Enemy['dir']; e.timer = w.rng.range(50, 140) | 0; }
  const [mx, my] = D[e.dir];
  if (moveEnemy(w, e, mx * 0.5, my * 0.5)) e.dir = w.rng.int(4) as Enemy['dir'];
}

export function updateEnemy(w: World, e: Enemy) {
  e.anim++;
  if (e.hurtT > 0) {
    e.hurtT--; moveEnemy(w, e, e.kx, e.ky); e.kx *= 0.82; e.ky *= 0.82;
    if (e.hurtT === 0 && e.dying) { w.emit({ t: 'poof', x: e.x, y: e.y - 4 }); sfx(w, 'poof', e); e.dead = true; onEnemyDead(w, e); }
    return;
  }
  if (e.type === 'slime') updateSlime(w, e); else updateBeetle(w, e);
}
export function separate(w: World) {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 13) { const k = (13 - d) * 0.08 / d; moveEnemy(w, a, -dx * k, -dy * k); moveEnemy(w, b, dx * k, dy * k); }
  }
}
