import { TS, ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { World } from '../world';
import { nearCave } from '../world/tiles';
import { burst, sfx } from './fx';
import { damagePlayer } from './life';
import { spawnLoot } from './loot';
import { shatter } from './projectiles';
import { breakTile } from './regrowth';
import { gainXp } from './progress';
import { createEnemy } from './spawner';

/* ---------- Chefão: o Rei Geleca ---------- */
// Fica na toca (LEASH em volta de onde nasce). Pula atrás de quem chega perto e, ao cair, solta uma onda de choque
// que machuca quem estiver no chão por perto (pular ou rolar na hora certa escapa). A cada tantos pulos chama gelecas.
// Com metade da vida fica furioso: pula mais rápido, mais longe e chama ajuda mais vezes.
// Quem bateu nele ganha o XP inteiro e um loot só seu; ninguém por perto por um tempo: ele se cura e esquece.
export const LEASH = 7 * TS;
const HOP = 40, SHOCK = 40, MINIONS = 4, FORGET = ticks(10);

const homeOf = (w: World, e: Enemy) => { const s = w.spawns[e.spawn]; return s ? { x: s.tx * TS + 8, y: s.ty * TS + 10 } : { x: e.x, y: e.y }; };

function target(w: World, e: Enemy) {
  const home = homeOf(w, e);
  let best = null, bd = Infinity;
  for (const p of w.players.values()) {
    if (p.state === 'dead' || Math.hypot(p.x - home.x, p.y - home.y) > LEASH + 32) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function summon(w: World, e: Enemy, n: number) {
  const alive = w.enemies.filter(m => m.minion && !m.dying).length;
  for (let i = 0; i < Math.min(n, MINIONS - alive); i++) {
    const a = w.rng.range(0, Math.PI * 2), x = e.x + Math.cos(a) * 22, y = e.y + Math.sin(a) * 16;
    if (w.map.solid(Math.floor(x / TS), Math.floor(y / TS))) continue;
    const m = createEnemy(w, 'slime', Math.floor(x / TS), Math.floor(y / TS), -1);
    m.x = x; m.y = y; m.minion = true; m.timer = 20 + i * 10;
    w.enemies.push(m); w.emit({ t: 'poof', x, y: y - 4 });
  }
}
// No ar ele passa por cima de pedras, arbustos e mato (e os esmaga ao cair); paredes, água e baús param.
const SMASH = new Set(['b', 'g', 'r']);
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
function blockedAir(w: World, e: Enemy, x: number, y: number) {
  return CORNERS.some(([sx, sy]) => {
    const tx = Math.floor((x + sx * e.hw) / TS), ty = Math.floor((y + sy * e.hh) / TS);
    return w.map.solid(tx, ty) && !SMASH.has(w.map.get(tx, ty));
  });
}
function airMove(w: World, e: Enemy) {
  if (!blockedAir(w, e, e.x + e.vx, e.y)) e.x += e.vx;
  if (!blockedAir(w, e, e.x, e.y + e.vy)) e.y += e.vy;
}
function smash(w: World, e: Enemy) {
  for (let ty = Math.floor((e.y - e.hh) / TS); ty <= Math.floor((e.y + e.hh) / TS); ty++)
    for (let tx = Math.floor((e.x - e.hw) / TS); tx <= Math.floor((e.x + e.hw) / TS); tx++) {
      const c = w.map.get(tx, ty); if (!SMASH.has(c)) continue;
      const cave = nearCave((a, b) => w.map.get(a, b), tx, ty);
      if (c === 'r') { breakTile(w, tx, ty, cave ? 'q' : 'd'); shatter(w, tx * TS + 8, ty * TS + 8, 'r'); }
      else { breakTile(w, tx, ty, cave ? 'q' : '.'); burst(w, tx * TS + 8, ty * TS + 8, 'leaf', 10, { s: 1.6, z: 6 }); }
    }
}
function land(w: World, e: Enemy) {
  e.z = 0; e.lands = (e.lands ?? 0) + 1;
  smash(w, e);
  const r = SHOCK + (e.enraged ? 8 : 0);
  sfx(w, 'boom', e); burst(w, e.x, e.y + 2, 'dust', 18, { s: 1.6, up: 1.2 });
  for (const p of w.players.values()) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < 110) w.emit({ t: 'shake', to: p.id, n: d < r ? 14 : 8 });
    if (d < r && p.z < 2 && p.state !== 'hop' && p.state !== 'dash' && p.state !== 'held' && p.state !== 'flying') damagePlayer(w, p, w.rules.enemies.king.damage, e);
  }
  if (e.lands % (e.enraged ? 2 : 3) === 0) summon(w, e, 2);
}

export function updateKing(w: World, e: Enemy) {
  if (!e.enraged && e.hp <= e.maxHp / 2) {   // furioso: avisa com estardalhaço e chama ajuda na hora
    e.enraged = true; sfx(w, 'swarm', e); burst(w, e.x, e.y - 10, 'spark', 20, { s: 1.6, z: 12, up: 2 }); summon(w, e, 3);
  }
  const p = target(w, e), home = homeOf(w, e);
  if (p) e.lost = 0;
  else if (++e.lost > FORGET && (e.hp < e.maxHp || e.hitters)) { e.hp = e.maxHp; e.enraged = false; e.hitters = undefined; e.lands = 0; }
  if (e.mode === 'hop') {
    airMove(w, e);
    e.timer--; e.z = Math.sin(Math.PI * (1 - e.timer / HOP)) * (e.enraged ? 26 : 20);
    if (e.timer <= 0) { land(w, e); e.mode = 'idle'; e.timer = (e.enraged ? w.rng.range(18, 32) : w.rng.range(40, 65)) | 0; }
    return;
  }
  e.mode = 'idle';
  if (--e.timer > 0) return;
  const to = p ?? (Math.hypot(home.x - e.x, home.y - e.y) > 12 ? home : null);
  if (!to) { e.timer = 30; return; }
  // pula para cair em cima do alvo (até a velocidade máxima)
  const dx = to.x - e.x, dy = to.y - e.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(d / HOP, e.enraged ? 2.2 : 1.5);
  e.vx = dx / d * sp; e.vy = dy / d * sp; e.mode = 'hop'; e.timer = HOP;
  if (Math.abs(dx) > 2) e.dir = dx < 0 ? 2 : 3;
  sfx(w, 'hop', e);
}

// Quem bateu: cada um ganha o XP inteiro e o próprio loot, que só ele pode pegar.
export function onKingDead(w: World, e: Enemy) {
  const r = w.rules.enemies.king, names: string[] = [];
  Object.keys(e.hitters ?? {}).forEach((id, i) => {
    const p = w.players.get(id); if (!p) return;
    names.push(p.name); gainXp(w, p, r.xp);
    const a = i * 1.3; spawnLoot(w, r.drops, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 10, p.id);
  });
  for (const m of w.enemies) if (m.minion && !m.dying) { m.dying = true; m.hurtT = 8; }   // sem o rei, os filhotes se desfazem
  burst(w, e.x, e.y - 8, 'spark', 30, { s: 2, z: 10, up: 2.5 });
  w.emit({ t: 'announce', text: `O Rei Geleca caiu! ${names.length ? 'Vitória de ' + list(names) + '.' : ''}`.trim() });
}
const list = (n: string[]) => n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
