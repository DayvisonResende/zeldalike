import { TS } from '../constants';
import type { Player } from '../entities/player';
import { ITEMS, addItem, canFit, isItem, takeItem, type ItemId } from '../items';
import type { Npc } from '../world/map';
import type { World } from '../world';
import { sfx } from './fx';
import type { ItemResult } from './loot';

/* ---------- Lojas: NPCs com a propriedade "loja" no Tiled; preços em shops no config ---------- */
// buy: o que a loja vende (e por quanto); sell: o que ela compra de você (e quanto paga).
export interface ShopRule { buy: Partial<Record<ItemId, number>>; sell: Partial<Record<ItemId, number>> }
// O que o cliente precisa para montar o painel (vai junto com a fala do lojista).
export interface ShopOffer { id: string; name: string; buy: [ItemId, number][]; sell: [ItemId, number][] }
export const MAX_DEAL = 99;   // unidades por compra/venda
const REACH = 2.5 * TS;       // distância do lojista para negociar (fechou o painel e foi embora: acabou)

const entries = (r: Partial<Record<ItemId, number>>) => (Object.entries(r) as [ItemId, number][]).filter(([id, v]) => isItem(id) && v > 0);
export function shopOffer(w: World, npc: Npc): ShopOffer | null {
  const r = npc.shop ? w.rules.shops[npc.shop] : undefined;
  return r && npc.shop ? { id: npc.shop, name: npc.name, buy: entries(r.buy), sell: entries(r.sell) } : null;
}
// Está perto de um lojista dessa loja (e de pé)?
function nearShop(w: World, p: Player, shop: string) {
  if (p.state === 'dead') return false;
  return (w.map.data.npcs ?? []).some(n => n.shop === shop && Math.hypot(n.x * TS + 8 - p.x, n.y * TS + 8 - p.y) <= REACH);
}
const fail = (reason: string): ItemResult => ({ ok: false, reason });
const count = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_DEAL;

export function buyItem(w: World, p: Player, shop: string, item: ItemId, n: number): ItemResult {
  const price = w.rules.shops[shop]?.buy[item];
  if (!price || !count(n)) return fail('Essa loja não vende isso.');
  if (!nearShop(w, p, shop)) return fail('Chegue mais perto do lojista.');
  if (ITEMS[item].gear && (n > 1 || p.bag.some(s => s?.id === item))) return fail(`Você já tem ${ITEMS[item].name}.`);
  if (p.gold < price * n) return fail(`Falta ouro: ${n > 1 ? `${n} custam` : 'custa'} ${price * n}.`);
  const stack = w.rules.inventory.stack;
  if (!canFit(p.bag, item, stack)) return fail('Inventário cheio.');
  // compra só o que couber: testa numa cópia e cobra pelo que entrou
  const trial = p.bag.map(s => s && { ...s }), left = addItem(trial, item, n, stack), got = n - left;
  if (!got) return fail('Inventário cheio.');
  p.bag = trial; p.bagVersion++; p.gold -= price * got;
  w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y - 8, text: `+${got > 1 ? got + ' ' : ''}${ITEMS[item].name}` });
  sfx(w, 'pickup', p);
  return left ? fail(`Só cabia ${got}. Pagou ${price * got} de ouro.`) : { ok: true };
}

export function sellItem(w: World, p: Player, shop: string, item: ItemId, n: number): ItemResult {
  const price = w.rules.shops[shop]?.sell[item];
  if (!price || !count(n)) return fail('Essa loja não compra isso.');
  if (!nearShop(w, p, shop)) return fail('Chegue mais perto do lojista.');
  let sold = 0;
  for (let i = 0; i < p.bag.length && sold < n; i++) if (p.bag[i]?.id === item) sold += takeItem(p.bag, i, n - sold);
  if (!sold) return fail(`Você não tem ${ITEMS[item].name}.`);
  p.bagVersion++; p.gold += price * sold;
  w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y - 8, text: `+${price * sold} de ouro` });
  sfx(w, 'pickup', p);
  return { ok: true };
}
