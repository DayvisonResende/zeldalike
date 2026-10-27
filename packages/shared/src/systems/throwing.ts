import { TS } from '../constants';
import type { Player } from '../entities/player';
import { blockedAt } from '../world/collision';
import { blocksShot } from '../world/tiles';
import type { World } from '../world';
import { damage } from './combat';
import { burst, sfx } from './fx';
import { placeBomb } from './bombs';
import { shatter } from './projectiles';
import { faceAim } from './control';

/* ---------- Levantar e arremessar amigos ----------
   E de frente para alguém levanta a pessoa; E (ou espada) arremessa. Quem está no colo aperta as teclas rápido para se
   soltar. O voo passa por cima de água e barrancos; árvore ou parede para o voo; cair em monstro machuca o monstro. */

// Tem alguém bem na frente para levantar?
export function liftPlayer(w: World, p: Player, fx: number, fy: number) {
  if (!w.rules.fun.liftPlayers) return false;
  const v = [...w.players.values()].find(o => o !== p && Math.abs(o.x - fx) < 10 && Math.abs(o.y - fy) < 10);
  if (!v || v.state === 'dead' || v.state === 'held' || v.state === 'flying' || v.state === 'hop' || v.carry === 'player') return false;
  dropCarried(w, v);
  v.state = 'held'; v.heldBy = p.id; v.struggle = 0; v.fish = null; v.z = 16;
  p.carry = 'player'; p.holding = v.id; p.liftFrom = { x: v.x, y: v.y }; p.state = 'lift'; p.t = 0;
  sfx(w, 'lift', p, p.id);
  w.emit({ t: 'notice', to: v.id, text: `${p.name} te levantou! Aperte as teclas rápido para se soltar.` });
  return true;
}
// Larga o que estiver no colo de alguém (pedra quebra, bomba cai acesa, pessoa desce).
export function dropCarried(w: World, p: Player) {
  if (p.carry === 'player') release(w, p);
  else if (p.carry === 'bomb') placeBomb(w, p, p.x, p.y + 4, p.carryFuse);
  else if (p.carry) shatter(w, p.x, p.y, p.carry, 14);
  p.carry = null;
}
// Quem estava no colo desce ao lado de quem carregava.
function release(w: World, carrier: Player) {
  const v = carrier.holding ? w.players.get(carrier.holding) : undefined;
  carrier.holding = null; carrier.carry = null;
  if (carrier.state === 'carry' || carrier.state === 'lift') carrier.state = 'walk';
  if (v && v.state === 'held') { v.state = 'walk'; v.heldBy = null; v.z = 0; land(w, v, carrier.x, carrier.y); }
}
export function throwPlayer(w: World, p: Player) {
  const v = p.holding ? w.players.get(p.holding) : undefined;
  faceAim(p);   // na direção em que está virado (ou na mira do mouse)
  p.holding = null; p.carry = null; p.state = 'throw'; p.t = 10;
  if (!v || v.state !== 'held') return;
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  v.state = 'flying'; v.heldBy = null; v.throwBy = p.id;
  v.x = p.x; v.y = p.y; v.z = 18; v.kx = ca * 3.2; v.ky = sa * 3.2; v.vz = 1.6;
  v.flyFrom = { x: p.x, y: p.y };
  sfx(w, 'throw', p, p.id);
}

// No colo: cada tecla nova conta para se soltar.
export function struggle(w: World, p: Player) {
  const dirs = (p.input.up ? 1 : 0) | (p.input.down ? 2 : 0) | (p.input.left ? 4 : 0) | (p.input.right ? 8 : 0);
  const fresh = (dirs & ~p.prevDirs) !== 0 || p.input.tap !== 0;
  p.prevDirs = dirs;
  if (!fresh) return;
  if (++p.struggle >= w.rules.fun.struggle) {
    const carrier = p.heldBy ? w.players.get(p.heldBy) : undefined;
    if (carrier) release(w, carrier); else { p.state = 'walk'; p.heldBy = null; p.z = 0; }
    sfx(w, 'hop', p);
  }
}

// Uma vez por passo: quem está no colo acompanha quem carrega; quem foi arremessado voa.
export function updateCarried(w: World) {
  for (const p of w.players.values()) {
    if (p.state === 'held') {
      const c = p.heldBy ? w.players.get(p.heldBy) : undefined;
      if (!c && w.predicting) continue;   // na previsão quem carrega não existe: o servidor é que solta
      if (!c || c.holding !== p.id || c.state === 'dead') { p.state = 'walk'; p.heldBy = null; p.z = 0; if (c) land(w, p, c.x, c.y); continue; }
      p.x = c.x; p.y = c.y + 1; p.z = c.z + 16;   // em cima da cabeça (y + 1: desenhado na frente de quem carrega)
    } else if (p.state === 'flying') fly(w, p);
  }
}
function fly(w: World, p: Player) {
  const nx = p.x + p.kx, ny = p.y + p.ky, tx = Math.floor(nx / TS), ty = Math.floor(ny / TS);
  p.vz -= 0.11; p.z += p.vz;
  const wall = !w.map.inBounds(tx, ty) || (blocksShot(w.map.tiles[ty][tx]) && p.z < 14);
  if (!wall) { p.x = nx; p.y = ny; }
  const by = p.throwBy ? w.players.get(p.throwBy) : undefined;
  const hit = p.z < 12 && w.enemies.find(e => !e.dying && Math.abs(e.x - p.x) < e.hw + 5 && Math.abs(e.y - p.y) < e.hh + 6);
  if (hit) { damage(w, hit, 2, p.x - p.kx * 3, p.y - p.ky * 3, by); burst(w, p.x, p.y, 'spark', 8, { s: 1.2, z: 6 }); }
  if (wall || hit || p.z <= 0) {
    p.state = 'hurt'; p.t = 10; p.z = 0; p.kx = p.ky = 0; p.inv = Math.max(p.inv, 30);
    land(w, p, p.x, p.y);
    burst(w, p.x, p.y + 3, 'dust', 8, { s: 1, z: 1, up: 0.9 }); sfx(w, 'land', p);
    w.emit({ t: 'shake', to: p.id, n: 6 });
  }
}
// Aterrissa em chão livre: onde caiu, ou no ponto livre mais perto (nunca dentro de água ou parede).
function land(w: World, p: Player, x: number, y: number) {
  const free = (ax: number, ay: number) => { const tx = Math.floor(ax / TS), ty = Math.floor(ay / TS); return w.map.inBounds(tx, ty) && w.map.tiles[ty][tx] !== 'w' && !blockedAt(w.map, ax, ay, p.hw, p.hh); };
  if (free(x, y)) { p.x = x; p.y = y; return; }
  for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const ax = Math.floor(x / TS) * TS + 8 + dx * TS, ay = Math.floor(y / TS) * TS + 8 + dy * TS;
    if (free(ax, ay)) { p.x = ax; p.y = ay; return; }
  }
  if (p.flyFrom) { p.x = p.flyFrom.x; p.y = p.flyFrom.y; }
}
