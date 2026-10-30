import type { Player } from '../entities/player';
import { WEAR_NAME, type WearSlot } from '../gear';
import { ITEMS, type Slot } from '../items';
import { RARITIES, rarityOf } from '../rarity';
import type { World } from '../world';
import { sfx } from './fx';

export type WearResult = { ok: true } | { ok: false; reason: string };

// Vestir o que está num espaço da mochila. O que já estava vestido ali volta para o mesmo espaço (os dois trocam).
export function wearItem(w: World, p: Player, bagSlot: number): WearResult {
  const s = p.bag[bagSlot], d = s && ITEMS[s.id]?.wear;
  if (!s || !d) return { ok: false, reason: 'Isso não se veste.' };
  if (p.state === 'dead') return { ok: false, reason: 'Você está caído.' };
  const old = p.wear[d.slot];
  p.wear[d.slot] = { ...s, n: 1 };
  p.bag[bagSlot] = old;
  p.bagVersion++; sfx(w, 'use', p, p.id);
  return { ok: true };
}
// Tirar: volta para o primeiro espaço livre da mochila.
export function unwearItem(w: World, p: Player, part: WearSlot): WearResult {
  const s = p.wear[part];
  if (!s) return { ok: false, reason: `Nada vestido em ${WEAR_NAME[part].toLowerCase()}.` };
  const free = p.bag.findIndex(x => !x);
  if (free < 0) return { ok: false, reason: 'Mochila cheia: libere um espaço para tirar.' };
  p.bag[free] = s; p.wear[part] = null;
  p.bagVersion++; sfx(w, 'use', p, p.id);
  return { ok: true };
}

/* Organizar a mochila: armas, o que se veste, consumíveis e materiais, nessa ordem; dentro de cada grupo, os mais
   raros primeiro e depois pelo nome. As armas nos botões A e C continuam equipadas. */
export type BagGroup = 'gear' | 'wear' | 'use' | 'material';
export const groupOf = (id: string): BagGroup => { const d = ITEMS[id]; return d?.gear ? 'gear' : d?.wear ? 'wear' : d?.heal || d?.mana || id === 'bomb' ? 'use' : 'material'; };
const GROUP_ORDER: BagGroup[] = ['gear', 'wear', 'use', 'material'];
export function sortBag(p: Player) {
  const items = p.bag.filter((s): s is NonNullable<Slot> => !!s);
  const key = (s: NonNullable<Slot>) => [GROUP_ORDER.indexOf(groupOf(s.id)), -RARITIES.indexOf(rarityOf(s.id)), ITEMS[s.id]?.name ?? s.id] as const;
  items.sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]); });
  p.bag = [...items, ...Array(p.bag.length - items.length).fill(null)];   // os botões apontam para o exemplar, não para o espaço
  p.bagVersion++;
}
