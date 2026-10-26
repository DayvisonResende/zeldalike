import { TICK_RATE, TS, ticks } from '../constants';
import type { Player } from '../entities/player';
import { blockedAt } from '../world/collision';
import type { World } from '../world';
import { sfx } from './fx';
import { shatter } from './projectiles';
import { maxStats } from './progress';

/* ---------- Vida, mana, morte e renascimento ---------- */

// Dano em um jogador: empurra, derruba o que estiver no colo e, zerando a vida, derruba o jogador.
export function damagePlayer(w: World, p: Player, n: number, from: { x: number; y: number }, by?: Player) {
  if (p.state === 'dead' || p.inv > 0) return;
  p.hp = Math.max(0, p.hp - n); p.hurtAt = w.tick;
  if (p.carry) { shatter(w, p.x, p.y, p.carry, 14); p.carry = null; }
  if (p.hp === 0) { die(w, p); if (by) { p.killer = by.name; w.emit({ t: 'kill', by: by.id, victim: p.id }); } return; }
  const a = Math.atan2(p.y - from.y, p.x - from.x);
  p.kx = Math.cos(a) * 3; p.ky = Math.sin(a) * 3; p.state = 'hurt'; p.t = 14; p.inv = 70; sfx(w, 'bump', p);
}
function die(w: World, p: Player) {
  p.state = 'dead'; p.t = ticks(w.rules.player.respawnDelay); p.z = 0; p.kx = p.ky = 0; p.hop = null; p.charged = false;
  sfx(w, 'down', p);
}
// Onde renasce: no ponto de partida do mapa se ele estiver na região escolhida; senão, no chão livre mais perto do centro dela.
export function respawnPos(w: World, regionId: string) {
  const m = w.map, r = m.data.regions.find(r => r.id === regionId), s = m.data.spawn;
  if (!r || m.regionAt(s.x, s.y)?.id === r.id) return { ...s };
  const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
  for (let d = 0; d < Math.max(r.w, r.h); d++) for (let ty = cy - d; ty <= cy + d; ty++) for (let tx = cx - d; tx <= cx + d; tx++) {
    if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) !== d) continue;
    const x = tx * TS + 8, y = ty * TS + 8;
    if (m.regionAt(x, y)?.id === r.id && !blockedAt(m, x, y, 5, 4)) return { x, y };
  }
  return { ...s };
}
export function respawn(w: World, p: Player) {
  const at = respawnPos(w, w.rules.player.respawnPoint);
  p.x = at.x; p.y = at.y; p.state = 'walk'; p.t = 0; p.killer = null;
  p.hp = p.maxHp; p.mp = p.maxMp; p.inv = ticks(w.rules.player.invulnerableAfterRespawn);
  w.emit({ t: 'poof', x: p.x, y: p.y - 4 });
}
// Uma vez por passo do mundo: limites da config, regeneração e contagem até renascer.
export function updateLife(w: World) {
  const r = w.rules.player;
  for (const p of w.players.values()) {
    const m = maxStats(w, p.level);
    p.maxHp = m.hp; p.maxMp = m.mp;
    if (p.state === 'dead') { if (--p.t <= 0) respawn(w, p); continue; }
    if (w.tick - p.hurtAt >= ticks(r.regenDelay)) p.hp = Math.min(p.maxHp, p.hp + r.hpRegen / TICK_RATE);
    p.mp = Math.min(p.maxMp, p.mp + r.manaRegen / TICK_RATE);
    p.hp = Math.min(p.hp, p.maxHp);
  }
}
