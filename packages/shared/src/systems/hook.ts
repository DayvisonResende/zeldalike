import { TS } from '../constants';
import type { Player } from '../entities/player';
import { blockedAt } from '../world/collision';
import type { World } from '../world';
import { damage, hitsEnemy } from './combat';
import { burst, sfx } from './fx';

/* ---------- Gancho ----------
   Atira uma corrente na mira. Fisgou um pilar: puxa você até ele, por cima de água e buracos (é o jeito de atravessar).
   Fisgou um monstro: tira um pouco e atordoa. Fisgou um item no chão: traz até você. Bateu na parede: volta. */
export const HOOK_RANGE = 128;   // pixels (8 tiles)
const OUT = 6, BACK = 8, PULL = 4.5;   // pixels por passo: indo, voltando, puxando você
export const HOOK_TARGETS = new Set(['o']);   // onde o gancho prende (pilar); para mais, acrescente o código do tile
export interface Hook { x: number; y: number; dx: number; dy: number; dist: number; phase: 'out' | 'back' | 'pull'; drop?: number }

const hand = (p: Player) => ({ x: p.x + p.hook!.dx * 5, y: p.y - 6 + p.hook!.dy * 3 });
export function startHook(w: World, p: Player) {
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  p.state = 'hook'; p.t = 0;
  p.hook = { x: p.x + dx * 5, y: p.y - 6 + dy * 3, dx, dy, dist: 0, phase: 'out' };
  sfx(w, 'bow', p, p.id);
}
export function updateHook(w: World, p: Player) {
  const h = p.hook; if (!h) { p.state = 'walk'; return; }
  if (h.phase === 'out') {
    h.x += h.dx * OUT; h.y += h.dy * OUT; h.dist += OUT;
    const tx = Math.floor(h.x / TS), ty = Math.floor((h.y + 6) / TS), c = w.map.get(tx, ty);
    if (HOOK_TARGETS.has(c)) {   // prendeu: a ponta fica no pilar e você vai até ela
      h.phase = 'pull'; h.x = tx * TS + 8 - h.dx * 2; h.y = ty * TS + 2 - h.dy * 2;
      burst(w, h.x, h.y + 4, 'spark', 6, { s: 0.8, z: 4 }, p.id); sfx(w, 'thunk', h, p.id);
      return;
    }
    const e = w.enemies.find(e => !e.dying && e.type !== 'chicken' && e.hurtT === 0 && hitsEnemy(e, h.x, h.y + 6));
    if (e) { damage(w, e, Math.round(w.rules.weapons.arrow / 2) + p.stats.attack, p.x, p.y, p); e.hurtT = Math.max(e.hurtT, 40); h.phase = 'back'; return; }   // atordoado
    const d = w.drops.find(d => d.n > 0 && Math.hypot(d.x - h.x, d.y - (h.y + 6)) < 8);
    if (d) { h.drop = d.id; h.phase = 'back'; return; }
    if (w.map.solid(tx, ty) && c !== 'w') { h.phase = 'back'; sfx(w, 'thunk', h, p.id); return; }   // parede: volta (água não segura nada)
    if (h.dist >= HOOK_RANGE) h.phase = 'back';
    return;
  }
  if (h.phase === 'back') {
    const o = hand(p), vx = o.x - h.x, vy = o.y - h.y, d = Math.hypot(vx, vy);
    const drop = h.drop !== undefined ? w.drops.find(x => x.id === h.drop) : undefined;
    if (d <= BACK) { if (drop) { drop.x = p.x; drop.y = p.y + 2; } p.hook = null; p.state = 'walk'; return; }
    h.x += vx / d * BACK; h.y += vy / d * BACK;
    if (drop) { drop.x = h.x; drop.y = h.y + 6; }
    return;
  }
  // puxando: você voa até a ponta, sem bater em nada; chega um pouco antes do pilar
  const tx = h.x - h.dx * 12, ty = h.y + 6 - h.dy * 12, vx = tx - p.x, vy = ty - p.y, d = Math.hypot(vx, vy);
  p.z = Math.min(4, p.z + 1);
  if (d > PULL) { p.x += vx / d * PULL; p.y += vy / d * PULL; return; }
  p.x = tx; p.y = ty; p.z = 0; p.hook = null; p.state = 'walk';
  // parou em cima de algo (a borda de um pilar, água): recua pelo caminho até achar chão livre
  for (let k = 0; k < 40 && blockedAt(w.map, p.x, p.y, p.hw, p.hh); k++) { p.x -= h.dx * 2; p.y -= h.dy * 2; }
  burst(w, p.x, p.y + 3, 'dust', 5, { s: 0.8, z: 1, up: 0.8 }, p.id);
}
