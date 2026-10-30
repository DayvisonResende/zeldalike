import { ITEMS, type ItemId, type Rarity } from './items';
import type { Stats } from './systems/stats';
import type { World } from './world';

/* ---------- Raridade ----------
   Comum (branco) a lendário (dourado). Não é só número maior: incomum e raro podem vir com atributos sorteados
   (o exemplar é único), épico e lendário são fixos e trazem um efeito (ver systems/effects). docs/OFICINA.md. */
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_NAME: Record<Rarity, string> = { common: 'comum', uncommon: 'incomum', rare: 'raro', epic: 'épico', legendary: 'lendário' };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#e6e1ee', uncommon: '#7be08a', rare: '#5fa8ff', epic: '#c77dff', legendary: '#ffc94a' };
export const rarityOf = (id: string): Rarity => ITEMS[id.split('#')[0]]?.rarity ?? 'common';
export const isRare = (id: string) => { const r = rarityOf(id); return r === 'epic' || r === 'legendary'; };   // anúncio no chat e som especial

// Quantos atributos um exemplar sorteia: comum às vezes 1, incomum 1, raro 2. Épico e lendário são fixos.
function rollCount(w: World, r: Rarity) { return r === 'common' ? (w.rng.next() < 0.25 ? 1 : 0) : r === 'uncommon' ? 1 : r === 'rare' ? 2 : 0; }
// O sorteio de um exemplar novo (drop, baú): atributos tirados de `gear.rolls` do item, cada um entre o mínimo e o máximo.
export function rollFor(w: World, id: ItemId): Partial<Stats> | undefined {
  const pool = (ITEMS[id]?.gear ?? ITEMS[id]?.wear)?.rolls; if (!pool) return undefined;
  const keys = Object.keys(pool) as (keyof Stats)[], out: Partial<Stats> = {};
  for (let k = rollCount(w, rarityOf(id)); k > 0 && keys.length; k--) {
    const key = keys.splice(w.rng.int(keys.length), 1)[0], [lo, hi] = pool[key]!;
    const v = Math.round(lo + w.rng.next() * (hi - lo));
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
