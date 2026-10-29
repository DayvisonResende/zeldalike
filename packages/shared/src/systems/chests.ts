import { TS } from '../constants';
import type { Player } from '../entities/player';
import type { World } from '../world';
import type { Chest } from '../world/map';
import { burst, sfx } from './fx';
import { lootName, rollLoot } from './loot';
import { addItem, type LootId } from '../items';

/* ---------- Baús: cada personagem abre cada baú uma vez e espera ele "encher de novo" ----------
   O conteúdo vai direto para a mochila (ouro, para a carteira). O que não couber fica guardado no baú, só para
   quem abriu: abrir de novo entrega o resto. Cada um tem a própria recompensa: o amigo não mexe na sua. */
export const chestKey = (w: World, c: Chest) => `${w.id}:${c.x},${c.y}`;

// Milissegundos até este baú encher de novo para este jogador (0 = pode abrir).
export function chestWait(w: World, p: Player, c: Chest) {
  const opened = p.chests[chestKey(w, c)];
  return opened === undefined ? 0 : Math.max(0, opened + c.respawn * 1000 - w.now());
}
export function openChest(w: World, p: Player, c: Chest) {
  if (w.predicting) return;   // na previsão do cliente não se sabe o que tem: o servidor responde
  const key = chestKey(w, c), left = p.chestLoot[key];
  if (left?.length) { give(w, p, c, key, left); return; }   // o resto que tinha ficado
  const wait = chestWait(w, p, c);
  if (wait > 0) {
    const min = Math.ceil(wait / 60000);
    w.emit({ t: 'notice', to: p.id, text: `Vazio. Enche de novo em ${min} min.` });
    return;
  }
  p.chests[key] = w.now();
  give(w, p, c, key, rollLoot(w, c.loot, 1));
}
function give(w: World, p: Player, c: Chest, key: string, items: { item: LootId; n: number }[]) {
  const stack = w.rules.inventory.stack, rest: { item: LootId; n: number }[] = [];
  let i = 0;
  for (const { item, n } of items) {
    let got = n;
    if (item === 'gold') p.gold += n;
    else { const r = addItem(p.bag, item, n, stack); got = n - r; if (r) rest.push({ item, n: r }); if (got) p.bagVersion++; }
    if (got) w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y - 8 - 9 * i++, text: '+' + lootName(item, got) });
  }
  if (rest.length) { p.chestLoot[key] = rest; w.emit({ t: 'notice', to: p.id, text: 'Mochila cheia: o resto ficou guardado no baú para você.' }); }
  else delete p.chestLoot[key];
  p.chestsVersion++;
  burst(w, c.x * TS + 8, c.y * TS + 6, 'spark', 10, { s: 1.1, z: 8, up: 2 });
  sfx(w, 'chest', { x: c.x * TS + 8, y: c.y * TS + 8 });
}
// Esquece baús que já encheram de novo (para o que vai ao banco não crescer para sempre).
export function pruneChests(w: World, p: Player) {
  const now = w.now(), longest = Math.max(0, ...w.map.data.chests?.map(c => c.respawn) ?? [0]) * 1000;
  for (const [k, t] of Object.entries(p.chests)) if (k.startsWith(w.id + ':') && now - t > longest) delete p.chests[k];
}
// Baús deste mapa que estão abertos (vazios) para este jogador: "x,y".
// Com resto guardado, o baú aparece fechado (ainda tem coisa para você).
export const openChests = (w: World, p: Player) => (w.map.data.chests ?? []).filter(c => chestWait(w, p, c) > 0 && !p.chestLoot[chestKey(w, c)]?.length).map(c => `${c.x},${c.y}`);
