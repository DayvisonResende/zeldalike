import type { Player } from './entities/player';
import { ITEMS, isItem, type ItemId } from './items';
import type { PvpAttack } from './systems/pvp';
import type { Stats } from './systems/stats';
import type { World } from './world';

/* ---------- Equipamento: o que vai nos botões A e C ---------- */
// Cada um monta do seu jeito e troca quando quiser. Espada e arco todo mundo tem; o resto são itens do inventário
// (vendeu ou largou, o botão volta para a espada ou o arco).
// Todo equipamento se comporta como um dos cinco jeitos que o jogo sabe fazer (GearKind). Um item novo da Oficina
// (a "Espada de Ferro") diz como qual ele se comporta e traz os próprios números: dano, atributos e cor.
export type GearKind = 'sword' | 'bow' | 'firestaff' | 'lightstaff' | 'darktome' | 'hook';
export type GearId = string;   // 'sword', 'bow' ou o id de um item de equipamento
export type GearSlot = 'a' | 'c';
export const GEAR: GearKind[] = ['sword', 'bow', 'firestaff', 'lightstaff', 'darktome', 'hook'];
export const KIND_NAME: Record<GearKind, string> = { sword: 'Espada', bow: 'Arco', firestaff: 'Cajado de Fogo', lightstaff: 'Cajado de Luz', darktome: 'Grimório Sombrio', hook: 'Gancho' };
const SHORT: Record<GearKind, string> = { sword: 'Espada', bow: 'Arco', firestaff: 'Fogo', lightstaff: 'Luz', darktome: 'Sombra', hook: 'Gancho' };
// Num item: como ele se comporta e os números dele. Sem `damage`, o dano é o da arma de base (config: weapons).
export interface GearDef { like: GearKind; damage?: number; stats?: Partial<Stats>; color?: string }
const INNATE: GearId[] = ['sword', 'bow'];
export const DEFAULT_GEAR: Record<GearSlot, GearId> = { a: 'sword', c: 'bow' };
export const isKind = (v: unknown): v is GearKind => typeof v === 'string' && (GEAR as string[]).includes(v);
export const isGear = (v: unknown): v is GearId => v === 'sword' || v === 'bow' || (isItem(v) && !!ITEMS[v].gear);
export const gearDef = (g: GearId): GearDef | undefined => isItem(g) ? ITEMS[g].gear : undefined;
export const kindOf = (g: GearId): GearKind => gearDef(g)?.like ?? (isKind(g) ? g : 'sword');
export const isStaff = (g: GearId) => { const k = kindOf(g); return k === 'firestaff' || k === 'lightstaff' || k === 'darktome'; };
// Nome curto para os botões (Espada, Arco, Fogo…); itens novos pelo nome.
export const gearName = (g: GearId) => isKind(g) ? SHORT[g] : ITEMS[g]?.name ?? SHORT[kindOf(g)];
export const gearColor = (g: GearId) => gearDef(g)?.color;

export const owns = (p: Pick<Player, 'bag'>, g: GearId) => INNATE.includes(g) || (isGear(g) && p.bag.some(s => s?.id === (g as ItemId)));
// Tudo que dá para pôr num botão: espada, arco e os equipamentos da mochila (sem repetir).
export const ownedGear = (p: Pick<Player, 'bag'>): GearId[] => [...new Set([...INNATE, ...p.bag.flatMap(s => s && isGear(s.id) ? [s.id] : [])])];
// O que está de fato no botão: o equipado, se ainda o tiver; senão a espada ou o arco (o que não estiver no outro botão).
export function gearIn(p: Pick<Player, 'bag' | 'gear'>, slot: GearSlot): GearId {
  const g = p.gear[slot];
  if (owns(p, g)) return g;
  const other = p.gear[slot === 'a' ? 'c' : 'a'];
  return DEFAULT_GEAR[slot] !== other ? DEFAULT_GEAR[slot] : INNATE.find(i => i !== other)!;
}
// Põe no botão; se já estava no outro, os dois trocam de lugar.
export function equipGear(p: Player, g: GearId, slot: GearSlot): { ok: true } | { ok: false; reason: string } {
  if (!owns(p, g)) return { ok: false, reason: 'Você não tem isso.' };
  const other: GearSlot = slot === 'a' ? 'c' : 'a';
  if (gearIn(p, other) === g) p.gear[other] = gearIn(p, slot);
  p.gear[slot] = g;
  return { ok: true };
}
export function parseGear(raw: unknown): Record<GearSlot, GearId> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const a = isGear(r.a) ? r.a : DEFAULT_GEAR.a, c = isGear(r.c) && r.c !== a ? r.c : (a === DEFAULT_GEAR.c ? DEFAULT_GEAR.a : DEFAULT_GEAR.c);
  return { a, c };
}

/* ---------- Dano de cada equipamento ---------- */
// Quanto o dano do item muda o de base: Espada de Ferro com dano 14 = 1,4× a espada (golpe, giro e dash; e no PvP).
export function gearScale(w: World, g: GearId) {
  const d = gearDef(g)?.damage, k = kindOf(g);
  if (!d || (k !== 'sword' && k !== 'bow')) return 1;
  return d / (k === 'bow' ? w.rules.weapons.arrow : w.rules.weapons.sword);
}
export const weaponDamage = (w: World, g: GearId, attack: PvpAttack) => Math.round(w.rules.weapons[attack] * gearScale(w, g));
// A espada que o jogador tem num botão (para golpe, giro, ponta e dash): a do A, senão a do C, senão a de base.
export function swordOf(p: Pick<Player, 'bag' | 'gear' | 'using'>): GearId {
  if (p.using && kindOf(p.using) === 'sword') return p.using;
  return (['a', 'c'] as const).map(s => gearIn(p, s)).find(g => kindOf(g) === 'sword') ?? 'sword';
}
