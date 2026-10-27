import { ticks } from '../constants';
import type { Player } from '../entities/player';
import type { World } from '../world';
import { damagePlayer } from './life';
import { monsterSafe } from './invasion';

/* ---------- PvP: modos, zonas seguras e dano entre jogadores ---------- */
export type PvpMode = 'off' | 'optional' | 'open';
export type PvpAttack = 'sword' | 'spin' | 'dash' | 'arrow' | 'thrown' | 'bomb';

export function inSafeZone(w: World, x: number, y: number) {
  const r = w.map.regionAt(x, y);
  return !!r && w.rules.pvp.safeZones.includes(r.id);
}
// Pode lutar agora? off: ninguém; optional: quem ligou o PvP; open: todos. Nunca em zona segura nem caído.
export function pvpActive(w: World, p: Player) {
  const mode = w.rules.pvp.mode;
  if (mode === 'off' || p.state === 'dead' || inSafeZone(w, p.x, p.y)) return false;
  return mode === 'open' || p.pvp;
}
export const canHarm = (w: World, a: Player, v: Player) => a !== v && v.state !== 'dead' && pvpActive(w, a) && pvpActive(w, v);

// Golpe de um jogador em outro. Retorna true se acertou (para o golpe não acertar o mesmo duas vezes).
export function harmPlayer(w: World, a: Player, v: Player, attack: PvpAttack) {
  if (!canHarm(w, a, v) || v.inv > 0) return false;
  a.combatAt = v.combatAt = w.tick;
  damagePlayer(w, v, w.rules.pvp.damage[attack], a, a);
  return true;
}

// Segundos até poder desligar o PvP: espera o cooldown depois de ligar e o combat lock depois de uma briga.
export function pvpLock(w: World, p: Player) {
  if (!p.pvp) return 0;
  const r = w.rules.pvp, until = Math.max(p.pvpOnAt + ticks(r.toggleCooldown), p.combatAt + ticks(r.combatLock));
  return Math.max(0, Math.ceil((until - w.tick) / 60));
}
export type PvpToggle = { ok: true } | { ok: false; reason: 'mode' | 'locked'; wait?: number };
export function setPvp(w: World, p: Player, on: boolean): PvpToggle {
  if (w.rules.pvp.mode !== 'optional') return { ok: false, reason: 'mode' };
  if (on === p.pvp) return { ok: true };
  if (!on) { const wait = pvpLock(w, p); if (wait > 0) return { ok: false, reason: 'locked', wait }; }
  p.pvp = on; if (on) p.pvpOnAt = w.tick;
  return { ok: true };
}

// Uma vez por passo: estado de PvP de cada um e aviso ao entrar/sair de zona segura.
// `safe` é a proteção contra monstros, que some na zona invadida (o PvP lá continua proibido, por pvpActive).
export function updatePvp(w: World) {
  for (const p of w.players.values()) {
    const safe = monsterSafe(w, p.x, p.y);
    if (safe !== p.safe) { p.safe = safe; w.emit({ t: 'zone', to: p.id, safe }); }
    p.pvpActive = pvpActive(w, p);
  }
}
