import { TICK_RATE, TS, ticks } from '../constants';
import type { Player } from '../entities/player';
import { blockedAt } from '../world/collision';
import type { World } from '../world';
import { burst, sfx } from './fx';
import { dropCarried } from './throwing';
import { afterDefense, refreshStats } from './stats';

/* ---------- Vida, mana, morte e renascimento ---------- */

// Dano em um jogador (by: outro jogador, no PvP): empurra, derruba o que estiver no colo e, zerando a vida, derruba o jogador.
export function damagePlayer(w: World, p: Player, n: number, from: { x: number; y: number }, by?: Player) {
  if (p.state === 'dead' || p.inv > 0) return;
  p.hp = Math.max(0, p.hp - afterDefense(p, n, by ? w.rules.pvp.factor : 1)); p.hurtAt = w.tick; p.fish = null; p.hook = null; p.z = 0;   // de jogador: defesa × pvp.factor
  if (p.carry) dropCarried(w, p);
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
  p.x = at.x; p.y = at.y; p.state = 'walk'; p.t = 0; p.killer = null; p.revive = 0; p.reviveBy = null;
  p.hp = p.maxHp; p.mp = p.maxMp; p.inv = ticks(w.rules.player.invulnerableAfterRespawn);
  w.emit({ t: 'poof', x: p.x, y: p.y - 4 });
}
/* ---------- Levantar amigo caído ----------
   Quem cai fica no chão por respawnDelay. Um amigo que segura o botão de Ação ao lado dele por `revive` o levanta ali
   mesmo, com metade da vida. Enquanto alguém está levantando, a contagem para; soltou ou se afastou, volta a correr. */
export const REVIVE_RANGE = 16;
function reviver(w: World, p: Player) {
  let best: Player | null = null, bd = REVIVE_RANGE;
  for (const o of w.players.values()) {
    if (o === p || !o.input.b || (o.state !== 'walk' && o.state !== 'lift')) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d <= bd) { bd = d; best = o; }
  }
  return best;
}
function revive(w: World, p: Player, by: Player) {
  p.state = 'walk'; p.t = 0; p.killer = null; p.revive = 0; p.reviveBy = null;
  p.hp = Math.ceil(p.maxHp / 2); p.inv = ticks(w.rules.player.invulnerableAfterRespawn);
  w.emit({ t: 'notice', to: p.id, text: `${by.name} te levantou!` });
  w.emit({ t: 'gain', to: by.id, x: by.x, y: by.y - 8, text: `Levantou ${p.name}!` });
  burst(w, p.x, p.y - 6, 'heal', 16, { s: 1.2, z: 6, up: 1.5 });
  sfx(w, 'heal', p);
}

// Uma vez por passo do mundo: limites da config, regeneração, resgate e contagem até renascer.
export function updateLife(w: World) {
  const r = w.rules.player;
  for (const p of w.players.values()) {
    refreshStats(w, p);
    if (p.state === 'dead') {
      const helper = r.revive > 0 ? reviver(w, p) : null;
      if (helper) {
        if (p.reviveBy !== helper.id) { p.reviveBy = helper.id; p.revive = 0; }
        if (++p.revive >= ticks(r.revive)) revive(w, p, helper);
        continue;   // alguém está levantando: a contagem para
      }
      p.revive = 0; p.reviveBy = null;
      if (--p.t > 0) continue;
      if (w.home) respawn(w, p); else { p.t = 1e9; w.emit({ t: 'gohome', id: p.id }); }   // o servidor leva para o mapa principal
      continue;
    }
    if (w.tick - p.hurtAt >= ticks(r.regenDelay)) p.hp = Math.min(p.maxHp, p.hp + (r.hpRegen + p.stats.hpRegen) / TICK_RATE);
    p.mp = Math.min(p.maxMp, p.mp + (r.manaRegen + p.stats.mpRegen) / TICK_RATE);
    p.hp = Math.min(p.hp, p.maxHp);
  }
}
