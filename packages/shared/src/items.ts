// Itens do jogo: vêm dos arquivos de content/items/ (um <id>.json e um <id>.png por item; ver docs/OFICINA.md).
// O servidor lê e valida a pasta e manda a lista ao cliente; aqui fica só o registro. O que viaja e vai para o banco é o id.
export type ItemId = string;
export type LootId = ItemId;   // inclui 'gold': ouro cai no chão, mas vai para o contador, não para o inventário
import type { GearDef, WearDef } from './gear';
import type { Stats } from './systems/stats';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface ItemDef { name: string; desc: string; heal?: number; mana?: number; gear?: GearDef; wear?: WearDef; rarity?: Rarity }   // gear: equipa no botão A ou C
export const ITEMS: Record<ItemId, ItemDef> = {};
export const ITEM_IDS: ItemId[] = [];
export const LOOT_IDS: LootId[] = ['gold'];
// Itens que o código usa pelo id (coração e poção nos atalhos, bomba, peixes da pesca): não podem faltar na pasta.
export const REQUIRED_ITEMS: ItemId[] = ['heart', 'mana', 'bomb', 'lambari', 'tilapia', 'trout', 'moonfish', 'blindfish', 'boot'];
// Troca o registro inteiro (ao ligar o servidor, ao recarregar a pasta, ao chegar a lista no cliente).
export function setItems(defs: Record<ItemId, ItemDef>) {
  for (const k of Object.keys(ITEMS)) delete ITEMS[k];
  Object.assign(ITEMS, defs);
  ITEM_IDS.splice(0, ITEM_IDS.length, ...Object.keys(defs));
  LOOT_IDS.splice(0, LOOT_IDS.length, 'gold', ...ITEM_IDS);
}
export const isItem = (v: unknown): v is ItemId => typeof v === 'string' && Object.hasOwn(ITEMS, v);
export const isLoot = (v: unknown): v is LootId => v === 'gold' || v === 'key' || isItem(v);   // key: chave de masmorra (vai para o contador do mapa)

/* ---------- Inventário: espaços fixos; itens iguais empilham (equipamento não: cada exemplar no seu espaço) ---------- */
export type Slot = { id: ItemId; n: number; roll?: Partial<Stats> } | null;   // roll: atributos sorteados deste exemplar
export const emptyInventory = (slots: number): Slot[] => Array(slots).fill(null);
const stackOf = (id: ItemId, stack: number) => ITEMS[id]?.gear || ITEMS[id]?.wear ? 1 : stack;   // equipamento não empilha

// Põe n unidades; devolve quantas sobraram (inventário cheio). `roll`: o sorteio do exemplar (só equipamento).
export function addItem(inv: Slot[], id: ItemId, n: number, stack: number, roll?: Partial<Stats>) {
  const max = stackOf(id, stack);
  if (max > 1) for (const s of inv) if (n > 0 && s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
  for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { const k = Math.min(n, max); inv[i] = roll && Object.keys(roll).length ? { id, n: k, roll: { ...roll } } : { id, n: k }; n -= k; }
  return n;
}
export const canFit = (inv: Slot[], id: ItemId, stack: number) => inv.some(s => !s || (s.id === id && s.n < stackOf(id, stack)));
export function takeItem(inv: Slot[], slot: number, n = 1) {
  const s = inv[slot]; if (!s) return 0;
  const k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) inv[slot] = null;
  return k;
}
const ROLL_KEYS = ['attack', 'magic', 'attackSpeed', 'defense', 'hp', 'mp', 'hpRegen', 'mpRegen'];
// Lê um inventário vindo de fora (banco): o que não fizer sentido vira espaço vazio.
export function parseInventory(raw: unknown, slots: number, stack: number): Slot[] {
  const inv = emptyInventory(slots);
  if (Array.isArray(raw)) raw.slice(0, slots).forEach((s, i) => {
    if (!s || !isItem(s.id) || !Number.isInteger(s.n) || s.n <= 0) return;
    inv[i] = { id: s.id, n: Math.min(s.n, stackOf(s.id, stack)) };
    // sorteio: só atributos conhecidos, com números de verdade
    const roll = s.roll && typeof s.roll === 'object' ? Object.fromEntries(Object.entries(s.roll).filter(([k, v]) => ROLL_KEYS.includes(k) && typeof v === 'number' && Number.isFinite(v) && v !== 0)) : {};
    if (Object.keys(roll).length && (ITEMS[s.id].gear || ITEMS[s.id].wear)) inv[i]!.roll = roll;
  });
  return inv;
}
