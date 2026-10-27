import type { Player } from './entities/player';
import type { ItemId } from './items';

/* ---------- Equipamento: o que vai nos botões A e C ---------- */
// Cada um monta do seu jeito e troca quando quiser. Espada e arco todo mundo tem; os cajados e o grimório
// são itens do inventário (vendeu ou largou, o botão volta para a espada ou o arco).
export type GearId = 'sword' | 'bow' | 'firestaff' | 'lightstaff' | 'darktome';
export type GearSlot = 'a' | 'c';
export const GEAR: GearId[] = ['sword', 'bow', 'firestaff', 'lightstaff', 'darktome'];   // ordem = número na rede (novos no fim)
export const GEAR_NAME: Record<GearId, string> = { sword: 'Espada', bow: 'Arco', firestaff: 'Fogo', lightstaff: 'Luz', darktome: 'Sombra' };
const INNATE: GearId[] = ['sword', 'bow'];
export const DEFAULT_GEAR: Record<GearSlot, GearId> = { a: 'sword', c: 'bow' };
export const isGear = (v: unknown): v is GearId => typeof v === 'string' && (GEAR as string[]).includes(v);
export const isStaff = (g: GearId) => g === 'firestaff' || g === 'lightstaff' || g === 'darktome';

export const owns = (p: Pick<Player, 'bag'>, g: GearId) => INNATE.includes(g) || p.bag.some(s => s?.id === (g as ItemId));
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
