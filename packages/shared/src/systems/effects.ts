import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { gearDef, type EffectKind, type GearId } from '../gear';
import type { World } from '../world';
import { damage } from './combat';
import { burst, sfx } from './fx';

/* ---------- Efeitos de épicos e lendários ----------
   Não são números maiores: mudam o jeito de lutar. Valem enquanto o equipamento está no A ou no C (como os atributos)
   e só contra monstros. O número de cada um vem do item (Oficina):
     lifesteal  roubo de vida: essa % do dano que você dá volta como vida
     poison     veneno: o monstro atingido perde esse tanto de vida por segundo, por 3 s
     pierce     flecha que atravessa: passa por esse tanto de monstros antes de parar
     wave       onda ao girar: o giro carregado solta uma onda com esse dano em volta
     explode    explode ao derrubar: o monstro que você derruba explode com esse dano em volta */
export const EFFECT_NAME: Record<EffectKind, string> = { lifesteal: 'Roubo de vida', poison: 'Veneno', pierce: 'Flecha que atravessa', wave: 'Onda ao girar', explode: 'Explode ao derrubar' };
export const EFFECT_UNIT: Record<EffectKind, (v: number) => string> = {
  lifesteal: v => `${v}% do dano volta como vida`, poison: v => `${v} de dano por segundo, por 3 s`, pierce: v => `atravessa ${v} monstro${v === 1 ? '' : 's'}`,
  wave: v => `onda de ${v} de dano em volta`, explode: v => `explosão de ${v} de dano em volta`
};
const POISON_TIME = 180, WAVE_R = 40, BLAST_R = 32;

export type Effects = Partial<Record<EffectKind, number>>;
// Efeitos do que está nos botões (soma se os dois tiverem o mesmo).
export function effectsOf(gear: GearId[]): Effects {
  const out: Effects = {};
  for (const g of gear) { const e = gearDef(g)?.effect; if (e) out[e.kind] = (out[e.kind] ?? 0) + e.value; }
  return out;
}

// Golpe de jogador num monstro (chamado pelo damage): roubo de vida e veneno.
export function onHitEffects(w: World, e: Enemy, n: number, by: Player) {
  const fx = by.effects;
  if (fx.lifesteal && by.state !== 'dead') by.hp = Math.min(by.maxHp, by.hp + n * fx.lifesteal / 100);
  if (fx.poison && e.hp > 0) e.poison = { dps: fx.poison, until: w.tick + POISON_TIME, next: w.tick + 60, by: by.id };
}
// Veneno: a cada segundo tira um pouco; derrubar pelo veneno conta como golpe de quem envenenou.
export function updatePoison(w: World) {
  for (const e of w.enemies) {
    const p = e.poison; if (!p || e.dying) continue;
    if (w.tick >= p.until) { e.poison = undefined; continue; }
    if (w.tick < p.next) continue;
    p.next += 60; e.hp -= p.dps;
    burst(w, e.x, e.y - 6, 'heal', 4, { s: 0.6, z: 8, up: 0.8 });
    if (e.hp <= 0) { e.dying = true; e.lastHitBy = p.by; e.hurtT = Math.max(e.hurtT, 1); }
  }
}
// Giro carregado com "onda": todos em volta levam o dano da onda.
export function spinWave(w: World, p: Player) {
  const v = p.effects.wave; if (!v) return;
  for (const e of w.enemies) if (!e.dying && Math.hypot(e.x - p.x, e.y - p.y) < WAVE_R + e.hw) { e.hurtT = 0; damage(w, e, v, p.x, p.y, p); }
  burst(w, p.x, p.y - 4, 'spark', 18, { s: 1.6, z: 4, up: 0.6 });
}
// Monstro derrubado por quem tem "explode": ele explode e fere quem estiver perto (pode virar uma corrente).
export function deathBlast(w: World, e: Enemy, killer: Player | undefined) {
  const v = killer?.effects.explode; if (!v || !killer) return;
  for (const o of w.enemies) if (o !== e && !o.dying && Math.hypot(o.x - e.x, o.y - e.y) < BLAST_R + o.hw) { o.hurtT = 0; damage(w, o, v, e.x, e.y, killer); }
  burst(w, e.x, e.y - 4, 'fire', 16, { s: 1.6, z: 4, up: 1.4 }); sfx(w, 'boom', e);
}
