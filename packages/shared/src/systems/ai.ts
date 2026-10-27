import { D, TS } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { move } from '../world/collision';
import { bfs, distAt, lineOfSight, nextLower, tileOf, type DistMap } from '../world/pathfinding';
import type { World } from '../world';
import { sfx } from './fx';
import { inSafeZone } from './pvp';
import { monsterSafe } from './invasion';
import { createEnemy, onEnemyDead } from './spawner';
import { updateKing } from './boss';
import { ticks } from '../constants';

// Monstro anda como qualquer corpo, mas não entra em zona segura (se já estava dentro, pode sair).
function moveEnemy(w: World, e: Enemy, dx: number, dy: number) {
  const ox = e.x, oy = e.y, hit = move(w.map, e, dx, dy);
  if (monsterSafe(w, e.x, e.y) && !monsterSafe(w, ox, oy)) { e.x = ox; e.y = oy; return true; }
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
      const p = nearest(w, e, 110), [cx, cy] = tileOf(w.map, e.x, e.y);
      // mira dois tiles adiante no caminho, com um pouco de ruído
      const along = (map: DistMap, gx: number, gy: number) => {
        const n = nextLower(map, cx, cy), m = n && nextLower(map, n[0], n[1]), t = m || n;
        ang = Math.atan2((t ? t[1] * TS + 8 : gy) - e.y, (t ? t[0] * TS + 8 : gx) - e.x) + w.rng.range(-0.45, 0.45);
      };
      const flow = e.invader ? w.invasion?.flow : null;   // geleca da invasão: marcha até a zona invadida
      if (p && w.flow && distAt(w.flow, cx, cy) <= 14) along(w.flow, p.x, p.y);
      else if (flow && distAt(flow, cx, cy) > 0 && isFinite(distAt(flow, cx, cy))) along(flow, e.x, e.y);
      e.vx = Math.cos(ang) * 1.05; e.vy = Math.sin(ang) * 1.05; e.mode = 'hop'; e.timer = 26;
    }
  } else {
    moveEnemy(w, e, e.vx, e.vy); e.timer--;
    e.z = Math.sin(Math.PI * (1 - e.timer / 26)) * 7;
    if (e.timer <= 0) { e.mode = 'idle'; e.z = 0; e.timer = (e.invader ? w.rng.range(15, 40) : w.rng.range(30, 80)) | 0; }
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
  e.slowed = (e.slowUntil ?? 0) > w.tick;
  if (e.hurtT > 0) {
    e.hurtT--; moveEnemy(w, e, e.kx, e.ky); e.kx *= 0.82; e.ky *= 0.82;
    if (e.hurtT === 0 && e.dying) { w.emit({ t: 'poof', x: e.x, y: e.y - 4 }); sfx(w, 'poof', e); e.dead = true; onEnemyDead(w, e); }
    if (e.type !== 'king' || e.dying) return;   // o rei apanha sem parar o que estava fazendo
  }
  if (e.slowed && w.tick % 2) return;   // lento (sombra): age em passos alternados
  if (e.type === 'king') { updateKing(w, e); return; }
  if (e.type === 'slime') updateSlime(w, e); else if (e.type === 'bat') updateBat(w, e); else if (e.type === 'chicken') updateChicken(w, e); else updateBeetle(w, e);
}
/* ---------- Morcego: voa por cima de água, arbustos e pedras; dá um rasante em quem está perto e recua ---------- */
const FLY_BLOCK = new Set(['T', 'W', 'o', 'c']);   // árvores, paredes, pilares e paredões param o voo
function flyBlocked(w: World, x: number, y: number) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  return !w.map.inBounds(tx, ty) || FLY_BLOCK.has(w.map.tiles[ty][tx]) || monsterSafe(w, x, y);
}
function fly(w: World, e: Enemy) {
  if (!flyBlocked(w, e.x + e.vx, e.y)) e.x += e.vx; else e.vx = -e.vx;
  if (!flyBlocked(w, e.x, e.y + e.vy)) e.y += e.vy; else e.vy = -e.vy;
}
function updateBat(w: World, e: Enemy) {
  const target = nearest(w, e, 90, p => !p.safe);
  if (e.mode === 'chase' && target) {                 // rasante: acelera na direção do alvo, baixo o bastante para acertar e ser acertado
    const a = Math.atan2(target.y - 4 - e.y, target.x - e.x);
    e.vx += Math.cos(a) * 0.14; e.vy += Math.sin(a) * 0.14;
    const sp = Math.hypot(e.vx, e.vy); if (sp > 1.9) { e.vx *= 1.9 / sp; e.vy *= 1.9 / sp; }
    e.z += (2 - e.z) * 0.2;
    if (--e.timer <= 0 || Math.hypot(target.x - e.x, target.y - e.y) < 8) { e.mode = 'hop'; e.timer = 45; e.vx = -Math.cos(a) * 1.3; e.vy = -Math.sin(a) * 1.3; }
  } else if (e.mode === 'hop') {                      // recua alto depois do rasante
    e.z += (11 - e.z) * 0.15;
    if (--e.timer <= 0) { e.mode = 'idle'; e.timer = 30; }
  } else {                                            // voo à toa
    e.mode = 'idle';
    e.z += (8 + Math.sin(e.anim / 5) * 2 - e.z) * 0.2;
    if (--e.timer <= 0) { const a = w.rng.range(0, Math.PI * 2); e.vx = Math.cos(a) * 0.6; e.vy = Math.sin(a) * 0.6; e.timer = w.rng.range(20, 50) | 0; }
    if (target && w.rng.next() < 0.03) { e.mode = 'chase'; e.timer = 60; }
  }
  fly(w, e);
}
/* ---------- Galinha: cisca à toa; apanhou, foge; apanhou demais do mesmo jogador, chama o bando ---------- */
export function chickenHit(w: World, e: Enemy, sx: number, sy: number, by?: Player) {
  if (e.swarm) return;                                   // as do bando não ligam para golpes
  const a = Math.atan2(e.y - sy, e.x - sx);
  e.vx = Math.cos(a) * 1.5; e.vy = Math.sin(a) * 1.5; e.mode = 'hop'; e.timer = 40;   // sai correndo
  sfx(w, 'cluck', e);
  if (!by) return;
  if (by.id !== e.angerBy || w.tick - e.angerAt > ticks(20)) e.anger = 0;
  e.anger++; e.angerBy = by.id; e.angerAt = w.tick;
  if (e.anger >= w.rules.fun.chickenAnger) { e.anger = 0; summonSwarm(w, by); }
}
function summonSwarm(w: World, target: Player) {
  const r = w.rules.fun, until = w.tick + ticks(r.swarmTime);
  for (let i = 0; i < r.swarmSize; i++) {
    const at = swarmSpot(w, target, (i / r.swarmSize) * Math.PI * 2 + w.rng.range(-0.3, 0.3));
    if (!at) continue;
    const c = createEnemy(w, 'chicken', 0, 0, -1);
    c.x = at.x; c.y = at.y; c.z = 10;
    c.swarm = { target: target.id, until }; c.mode = 'chase'; c.timer = i * 4;   // chegam em leva
    w.enemies.push(c);
  }
  w.emit({ t: 'notice', to: target.id, text: 'As galinhas vieram se vingar! Corra para a Clareira!' });
  sfx(w, 'swarm', target);
}
// De onde vem cada galinha do bando: longe do alvo, dentro do mapa e fora de zona segura (chega mais perto se precisar).
function swarmSpot(w: World, target: Player, angle: number) {
  for (let d = 170; d >= 40; d -= 30) for (let k = 0; k < 8; k++) {
    const a = angle + k * 0.8, x = target.x + Math.cos(a) * d, y = target.y + Math.sin(a) * d;
    if (x > 8 && y > 8 && x < w.map.width - 8 && y < w.map.height - 8 && !inSafeZone(w, x, y)) return { x, y };
  }
  return null;
}
function updateChicken(w: World, e: Enemy) {
  if (Math.abs(e.vx) > 0.05) e.dir = e.vx < 0 ? 2 : 3;   // olha para o lado em que anda
  if (e.swarm) {
    const t = w.players.get(e.swarm.target);
    if (!t || t.state === 'dead' || w.tick > e.swarm.until) {   // vingança cumprida (ou o alvo sumiu): vão embora
      e.mode = 'idle'; e.z += 0.6; e.y -= 1.2;
      if (e.z > 40) e.dead = true;
      return;
    }
    if (e.timer > 0) { e.timer--; return; }
    const a = Math.atan2(t.y - e.y, t.x - e.x) + Math.sin((w.tick + e.id * 17) / 9) * 0.5;   // ziguezague
    e.vx += Math.cos(a) * 0.25; e.vy += Math.sin(a) * 0.25;
    const sp = Math.hypot(e.vx, e.vy); if (sp > 2.3) { e.vx *= 2.3 / sp; e.vy *= 2.3 / sp; }
    e.z += (3 + Math.sin(e.anim / 3) * 2 - e.z) * 0.2;
    fly(w, e);
    return;
  }
  if (e.mode === 'hop') {                                  // fugindo
    moveEnemy(w, e, e.vx, e.vy);
    if (--e.timer <= 0) { e.mode = 'idle'; e.timer = w.rng.range(30, 90) | 0; }
    return;
  }
  if (--e.timer <= 0) {                                    // cisca: anda um pouco, para, bica o chão
    const a = w.rng.range(0, Math.PI * 2);
    e.vx = Math.cos(a) * 0.4; e.vy = Math.sin(a) * 0.4; e.timer = w.rng.range(40, 120) | 0;
    if (w.rng.next() < 0.4) { e.vx = 0; e.vy = 0; }
  }
  moveEnemy(w, e, e.vx, e.vy);
}
export function separate(w: World) {
  const es = w.enemies.filter(e => e.type !== 'bat' && e.type !== 'king' && !e.swarm);   // o rei é pesado demais para ser empurrado   // morcegos voam, não se empurram com quem está no chão
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 13) { const k = (13 - d) * 0.08 / d; moveEnemy(w, a, -dx * k, -dy * k); moveEnemy(w, b, dx * k, dy * k); }
  }
}
