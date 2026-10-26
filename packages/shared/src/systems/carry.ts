import { D, TS } from '../constants';
import type { Player } from '../entities/player';
import type { World } from '../world';
import { burst, sfx } from './fx';
import { breakTile } from './regrowth';
import { faceAim } from './control';
import { damagePlayer } from './life';

// Botão B: lê a placa à frente ou levanta um arbusto/pedra.
export function interact(w: World, p: Player) {
  const [dx, dy] = D[p.dir];
  const fx = p.x + dx * (p.hw + 5), fy = p.y + dy * (p.hh + 5);
  const pts = dx ? [[fx, fy], [fx, fy - 5], [fx, fy + 4]] : [[fx, fy], [fx - 5, fy], [fx + 5, fy]];
  for (const [x, y] of pts) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (!w.map.inBounds(tx, ty)) continue;
    const c = w.map.tiles[ty][tx];
    if (c === 's') { const pages = w.map.sign(tx, ty); if (pages) { w.emit({ t: 'dialog', to: p.id, pages }); sfx(w, 'sign', p); return true; } }
    if (c === 'b' || c === 'r') {
      breakTile(w, tx, ty, c === 'b' ? '.' : 'd');
      p.carry = c; p.liftFrom = { x: tx * TS + 8, y: ty * TS + 8 }; p.state = 'lift'; p.t = 0;
      if (c === 'b') burst(w, tx * TS + 8, ty * TS + 10, 'leaf', 6, { s: 1, z: 4 }, p.id);
      sfx(w, 'lift', p, p.id); return true;
    }
  }
  return false;
}
export function throwObj(w: World, p: Player) {
  faceAim(p);
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  w.thrown.push({ id: w.nextId++, owner: p.id, x: p.x, y: p.y + (sa < -0.3 ? -2 : 0), z: 19, vx: ca * 3.2, vy: sa * 3.2, vz: 0.6, type: p.carry! });
  p.carry = null; p.state = 'throw'; p.t = 10; sfx(w, 'throw', p, p.id);
}
// Encostar num inimigo machuca (dano da config) e empurra para trás.
export function contact(w: World) {
  for (const p of w.players.values()) {
    if (p.inv > 0 || p.state === 'hurt' || p.state === 'lift' || p.state === 'hop' || p.state === 'dash' || p.state === 'dead' || p.safe) continue;
    for (const e of w.enemies) {
      if (e.dying || e.z > 5) continue;
      if (Math.abs(e.x - p.x) < p.hw + e.hw - 1 && Math.abs(e.y - p.y) < p.hh + e.hh + 1) { damagePlayer(w, p, w.rules.enemies[e.type].damage, e); break; }
    }
  }
}
