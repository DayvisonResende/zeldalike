// Itens do jogo. O que viaja pela rede e vai para o banco é só o id.
export type ItemId = 'heart' | 'mana' | 'jelly' | 'shell';
export type LootId = ItemId | 'gold';   // ouro cai no chão, mas vai para o contador, não para o inventário
export interface ItemDef { name: string; desc: string; heal?: number; mana?: number }
export const ITEMS: Record<ItemId, ItemDef> = {
  heart: { name: 'Coração', desc: 'Recupera 25 de vida.', heal: 25 },
  mana: { name: 'Poção de mana', desc: 'Recupera 20 de mana.', mana: 20 },
  jelly: { name: 'Geleia de geleca', desc: 'Material pegajoso. Vai servir para algo um dia.' },
  shell: { name: 'Carapaça de besouro', desc: 'Dura e brilhante. Vai servir para algo um dia.' }
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const LOOT_IDS: LootId[] = ['gold', ...ITEM_IDS];
export const isItem = (v: unknown): v is ItemId => typeof v === 'string' && v in ITEMS;

/* ---------- Inventário: espaços fixos; itens iguais empilham ---------- */
export type Slot = { id: ItemId; n: number } | null;
export const emptyInventory = (slots: number): Slot[] => Array(slots).fill(null);

// Põe n unidades; devolve quantas sobraram (inventário cheio).
export function addItem(inv: Slot[], id: ItemId, n: number, stack: number) {
  for (const s of inv) if (n > 0 && s && s.id === id && s.n < stack) { const k = Math.min(n, stack - s.n); s.n += k; n -= k; }
  for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { const k = Math.min(n, stack); inv[i] = { id, n: k }; n -= k; }
  return n;
}
export const canFit = (inv: Slot[], id: ItemId, stack: number) => inv.some(s => !s || (s.id === id && s.n < stack));
export function takeItem(inv: Slot[], slot: number, n = 1) {
  const s = inv[slot]; if (!s) return 0;
  const k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) inv[slot] = null;
  return k;
}
// Lê um inventário vindo de fora (banco): o que não fizer sentido vira espaço vazio.
export function parseInventory(raw: unknown, slots: number, stack: number): Slot[] {
  const inv = emptyInventory(slots);
  if (Array.isArray(raw)) raw.slice(0, slots).forEach((s, i) => {
    if (s && isItem(s.id) && Number.isInteger(s.n) && s.n > 0) inv[i] = { id: s.id, n: Math.min(s.n, stack) };
  });
  return inv;
}
