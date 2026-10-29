import type { Player } from '../entities/player';
import type { World } from '../world';
import { burst, sfx } from './fx';

/* ---------- XP e níveis ---------- */
// XP que falta do nível `level` para o próximo: base × nível^expoente (50, 141, 260, 400, 559…).
export function xpToNext(w: World, level: number) {
  const l = w.rules.leveling;
  return level >= l.maxLevel ? Infinity : Math.round(l.base * Math.pow(level, l.exponent));
}
export function maxStats(w: World, level: number) {
  const r = w.rules.player, l = w.rules.leveling;
  return { hp: r.maxHp + (level - 1) * l.hpPerLevel, mp: r.maxMana + (level - 1) * l.manaPerLevel };
}
// XP de um monstro: em grupo, dividido igualmente entre quem derrubou e os do grupo perto dele (de pé, no mesmo mapa).
// Arredonda para cima: ninguém sai com zero.
export function shareXp(w: World, killer: Player, amount: number) {
  const near = killer.party ? [...w.players.values()].filter(p => p === killer || (p.party === killer.party && p.state !== 'dead' && Math.hypot(p.x - killer.x, p.y - killer.y) <= w.rules.party.xpRange)) : [killer];
  const each = Math.ceil(amount / near.length);
  for (const p of near) gainXp(w, p, each);
}
export function gainXp(w: World, p: Player, amount: number) {
  const n = Math.max(0, Math.round(amount * w.rules.rates.xp));
  if (!n || p.level >= w.rules.leveling.maxLevel) return;
  p.xp += n;
  w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y, text: `+${n} XP` });
  while (p.xp >= xpToNext(w, p.level)) {
    p.xp -= xpToNext(w, p.level); p.level++;
    if (p.level >= w.rules.leveling.maxLevel) p.xp = 0;
    // sobe de nível: máximos maiores e vida e mana cheias
    const m = maxStats(w, p.level);
    p.maxHp = m.hp + p.stats.hp; p.maxMp = m.mp + p.stats.mp; p.hp = p.maxHp; p.mp = p.maxMp;
    w.emit({ t: 'levelup', id: p.id, x: p.x, y: p.y, level: p.level });
    burst(w, p.x, p.y - 8, 'spark', 14, { s: 1.3, z: 10, up: 2.2 });
    sfx(w, 'levelup', p);
  }
}
