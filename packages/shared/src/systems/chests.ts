import { TS } from '../constants';
import type { Player } from '../entities/player';
import type { World } from '../world';
import type { Chest } from '../world/map';
import { burst, sfx } from './fx';
import { spawnLoot } from './loot';

/* ---------- Baús: cada personagem abre cada baú uma vez e espera ele "encher de novo" ---------- */
export const chestKey = (w: World, c: Chest) => `${w.id}:${c.x},${c.y}`;

// Milissegundos até este baú encher de novo para este jogador (0 = pode abrir).
export function chestWait(w: World, p: Player, c: Chest) {
  const opened = p.chests[chestKey(w, c)];
  return opened === undefined ? 0 : Math.max(0, opened + c.respawn * 1000 - w.now());
}
export function openChest(w: World, p: Player, c: Chest) {
  const wait = chestWait(w, p, c);
  if (wait > 0) {
    const min = Math.ceil(wait / 60000);
    w.emit({ t: 'notice', to: p.id, text: `Vazio. Enche de novo em ${min} min.` });
    return;
  }
  p.chests[chestKey(w, c)] = w.now(); p.chestsVersion++;
  // o conteúdo cai na frente do baú, reservado a quem abriu (mesmo caminho do loot dos monstros)
  const x = c.x * TS + 8, y = c.y * TS + 8 + (p.y > c.y * TS + 8 ? 12 : -12);
  spawnLoot(w, c.loot, x, y, p.id, 1);
  burst(w, c.x * TS + 8, c.y * TS + 6, 'spark', 10, { s: 1.1, z: 8, up: 2 });
  sfx(w, 'chest', { x, y });
}
// Esquece baús que já encheram de novo (para o que vai ao banco não crescer para sempre).
export function pruneChests(w: World, p: Player) {
  const now = w.now(), longest = Math.max(0, ...w.map.data.chests?.map(c => c.respawn) ?? [0]) * 1000;
  for (const [k, t] of Object.entries(p.chests)) if (k.startsWith(w.id + ':') && now - t > longest) delete p.chests[k];
}
// Baús deste mapa que estão abertos (vazios) para este jogador: "x,y".
export const openChests = (w: World, p: Player) => (w.map.data.chests ?? []).filter(c => chestWait(w, p, c) > 0).map(c => `${c.x},${c.y}`);
