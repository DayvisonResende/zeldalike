import type { Player } from '../entities/player';
import { gearDef, gearIn, kindOf, type GearId } from '../gear';
import type { World } from '../world';
import type { Rules } from '../rules';
import { maxStats } from './progress';
import { fragmentHp } from './dungeon';

/* ---------- Atributos ---------- */
// O que deixa o personagem forte é o item, não o nível: os atributos vêm do que está nos botões A e C
// (bônus de cada arma na seção `gear` do config). O nível só dá vida e mana (ver maxStats).
export interface Stats {
  attack: number;        // dano a mais em golpe de espada (giro, dash, ponta) e flecha
  magic: number;         // poder mágico: dano a mais nas magias de dano e cura a mais na de luz
  attackSpeed: number;   // % mais rápido: golpe, giro, arco, conjurar e carregar (teto em MAX_ATTACK_SPEED)
  defense: number;       // reduz o dano recebido: 100 de defesa = metade do dano (nunca chega a zero)
  hp: number; mp: number;            // vida e mana máximas a mais
  hpRegen: number; mpRegen: number;  // por segundo, a mais
}
export const STAT_KEYS = ['attack', 'magic', 'attackSpeed', 'defense', 'hp', 'mp', 'hpRegen', 'mpRegen'] as const satisfies readonly (keyof Stats)[];
export const MAX_ATTACK_SPEED = 50;
export const emptyStats = (): Stats => ({ attack: 0, magic: 0, attackSpeed: 0, defense: 0, hp: 0, mp: 0, hpRegen: 0, mpRegen: 0 });

// Bônus de um equipamento: o do item (Oficina) ou, nas armas de base, o da seção `gear` do config.
export const gearBonus = (bonus: Partial<Record<GearId, Partial<Stats>>>, g: GearId): Partial<Stats> => gearDef(g)?.stats ?? bonus[g] ?? {};
// Soma os bônus de uma lista de equipamentos.
export function statsOf(bonus: Partial<Record<GearId, Partial<Stats>>>, gear: GearId[]): Stats {
  const s = emptyStats();
  for (const g of gear) { const b = gearBonus(bonus, g); for (const k of STAT_KEYS) s[k] += b[k] ?? 0; }
  s.attackSpeed = Math.min(MAX_ATTACK_SPEED, s.attackSpeed);
  return s;
}
// Recalcula os atributos e os máximos de vida e mana (a vida não sobe sozinha ao equipar, só o máximo).
export function refreshStats(w: World, p: Player) {
  const a = gearIn(p, 'a'), c = gearIn(p, 'c');
  p.stats = statsOf(w.rules.gear, a === c ? [a] : [a, c]);
  const m = maxStats(w, p.level);
  p.maxHp = m.hp + p.stats.hp + fragmentHp(w, p); p.maxMp = m.mp + p.stats.mp;
  p.hp = Math.min(p.hp, p.maxHp); p.mp = Math.min(p.mp, p.maxMp);
}
// Quanto um ataque anda por passo (1 = normal). Com velocidade de ataque, as animações e os tempos encurtam.
export const attackStep = (p: Pick<Player, 'stats'>) => 1 + Math.min(MAX_ATTACK_SPEED, p.stats.attackSpeed) / 100;
// Dano recebido depois da defesa (`scale`: quanto da defesa vale; no PvP, pvp.factor).
export const afterDefense = (p: Pick<Player, 'stats'>, n: number, scale = 1) => n * 100 / (100 + Math.max(0, p.stats.defense * scale));

/* ---------- Para mostrar ---------- */
// O que o cliente precisa saber das armas para mostrar os números (vem do servidor; offline, das regras locais).
export type GearRules = Pick<Rules, 'weapons' | 'magic' | 'gear'>;
export const STAT_LABEL: Record<keyof Stats, string> = {
  attack: 'ataque', magic: 'poder mágico', attackSpeed: 'velocidade de ataque', defense: 'defesa',
  hp: 'vida', mp: 'mana', hpRegen: 'vida por segundo', mpRegen: 'mana por segundo'
};
const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
// "+5 ataque", "+15% velocidade de ataque", "−2 defesa"
export const formatStat = (k: keyof Stats, v: number) => `${v < 0 ? '−' : '+'}${num(Math.abs(v))}${k === 'attackSpeed' ? '%' : ''} ${STAT_LABEL[k]}`;
// Bônus que não são zero.
export const statLines = (s: Partial<Stats>) => STAT_KEYS.filter(k => s[k]).map(k => formatStat(k, s[k]!));
// Diferença de atributos entre dois jeitos de equipar (só o que muda).
export function statDiff(r: GearRules, from: GearId[], to: GearId[]): { k: keyof Stats; v: number }[] {
  const a = statsOf(r.gear, from), b = statsOf(r.gear, to);
  return STAT_KEYS.map(k => ({ k, v: b[k] - a[k] })).filter(d => d.v !== 0);
}
// O que a arma faz, em números: dano, cura, mana.
export function gearLines(r: GearRules, g: GearId): string[] {
  const w = r.weapons, m = r.magic, k = kindOf(g), d = gearDef(g)?.damage;
  const sc = (v: number) => d ? Math.round(v * d / (k === 'bow' ? w.arrow : w.sword)) : v;   // dano próprio do item
  const base = k === 'sword' ? [`Dano ${sc(w.sword)} · giro ${sc(w.spin)} · dash ${sc(w.dash)}`]
    : k === 'bow' ? [`Dano ${sc(w.arrow)} por flecha`]
    : k === 'firestaff' ? [`Bola de fogo: dano ${m.fire.damage} (${m.fire.mana} de mana)`, `Segurando: explosão ${m.blast.damage} (${m.blast.mana} de mana)`]
    : k === 'hook' ? ['Puxa você até pilares (8 tiles, por cima de água e buracos); atordoa monstros e traz itens']
    : k === 'lightstaff' ? [`Cura ${m.heal.amount} em volta (${m.heal.mana} de mana)`, `Segurando: cura ${m.bigHeal.amount} e empurra (${m.bigHeal.mana} de mana)`]
    : [`Sombra: dano ${m.shadow.damage}, rouba ${m.shadow.drain} de vida, deixa lento (${m.shadow.mana} de mana)`, `Segurando: maldição ${m.curse.damage}, rouba ${m.curse.drain} (${m.curse.mana} de mana)`];
  return [...base, ...statLines(gearBonus(r.gear, g))];
}
