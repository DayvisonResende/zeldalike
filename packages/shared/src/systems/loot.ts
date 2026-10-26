import { ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { ITEMS, addItem, canFit, takeItem, type LootId } from '../items';
import type { World } from '../world';
import { sfx } from './fx';

/* ---------- Drops no chão ---------- */
export interface Drop {
  id: number; item: LootId; n: number; x: number; y: number;
  owner: string | null; ownerUntil: number;   // só o dono pega até ownerUntil; depois, qualquer um
  expires: number; born: number;
}
const PICK_RANGE = 11;

function spawnDrop(w: World, item: LootId, n: number, x: number, y: number, owner: string | null) {
  const d: Drop = { id: w.nextId++, item, n, x, y, owner, ownerUntil: owner ? w.tick + ticks(w.rules.loot.ownerTime) : 0, expires: w.tick + ticks(w.rules.loot.lifetime), born: w.tick };
  w.drops.push(d);
  return d;
}
// Monstro derrubado: sorteia a tabela dele; o loot fica reservado a quem deu o último golpe.
export function dropLoot(w: World, e: Enemy, killer: Player | undefined) {
  const r = w.rules, owner = killer?.id ?? null;
  let k = 0;
  for (const d of r.enemies[e.type].drops) {
    if (w.rng.next() >= Math.min(1, d.chance * r.rates.drop)) continue;
    let n = d.min + w.rng.int(d.max - d.min + 1);
    if (d.item === 'gold') n = Math.max(1, Math.round(n * r.rates.gold));
    const a = k++ * 2.4;   // espalha um pouco em volta
    spawnDrop(w, d.item, n, e.x + Math.cos(a) * (k > 1 ? 7 : 0), e.y + Math.sin(a) * (k > 1 ? 5 : 0), owner);
  }
}
const lootName = (item: LootId, n: number) => item === 'gold' ? `${n} de ouro` : `${n > 1 ? n + ' ' : ''}${ITEMS[item].name}`;

// Uma vez por passo: some o que expirou; quem passa por cima pega (se puder e couber).
export function updateLoot(w: World) {
  w.drops = w.drops.filter(d => d.expires > w.tick);
  const stack = w.rules.inventory.stack;
  for (const p of w.players.values()) {
    if (p.state === 'dead') continue;
    for (const d of w.drops) {
      if (d.n <= 0 || Math.abs(d.x - p.x) > PICK_RANGE || Math.abs(d.y - p.y) > PICK_RANGE) continue;
      if (d.owner && d.owner !== p.id && w.tick < d.ownerUntil) continue;
      if (w.tick - d.born < 12) continue;   // deixa o drop "cair" antes de poder pegar
      let got = d.n;
      if (d.item === 'gold') p.gold += d.n;
      else {
        if (!canFit(p.bag, d.item, stack)) { notice(w, p, 'Inventário cheio.'); continue; }
        got = d.n - addItem(p.bag, d.item, d.n, stack);
        p.bagVersion++;
      }
      d.n -= got;
      w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y, text: '+' + lootName(d.item, got) });
      sfx(w, 'pickup', p);
    }
  }
  w.drops = w.drops.filter(d => d.n > 0);
}
const noticeAt = new WeakMap<Player, number>();
function notice(w: World, p: Player, text: string) {
  if (w.tick - (noticeAt.get(p) ?? -1e9) < 120) return;   // no máximo um aviso a cada 2 s
  noticeAt.set(p, w.tick); w.emit({ t: 'notice', to: p.id, text });
}

/* ---------- Usar e largar ---------- */
export type ItemResult = { ok: true } | { ok: false; reason: string };
const USE_COOLDOWN = 30;   // passos entre um item e outro (meio segundo)

export function useItem(w: World, p: Player, slot: number): ItemResult {
  const s = p.bag[slot];
  if (!s) return { ok: false, reason: 'Esse espaço está vazio.' };
  if (p.state === 'dead') return { ok: false, reason: 'Você está caído.' };
  const def = ITEMS[s.id];
  if (!def.heal && !def.mana) return { ok: false, reason: `${def.name} não tem uso por enquanto.` };
  if (w.tick - p.useAt < USE_COOLDOWN) return { ok: false, reason: 'Calma, um de cada vez.' };
  if ((!def.heal || p.hp >= p.maxHp) && (!def.mana || p.mp >= p.maxMp)) return { ok: false, reason: def.heal ? 'Sua vida já está cheia.' : 'Sua mana já está cheia.' };
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
  if (def.mana) p.mp = Math.min(p.maxMp, p.mp + def.mana);
  takeItem(p.bag, slot); p.bagVersion++; p.useAt = w.tick;
  sfx(w, 'use', p);
  return { ok: true };
}
// Larga o espaço inteiro no chão, sem dono: qualquer um pode pegar (é assim que se passa item para um amigo).
export function dropItem(w: World, p: Player, slot: number): ItemResult {
  const s = p.bag[slot];
  if (!s) return { ok: false, reason: 'Esse espaço está vazio.' };
  if (p.state === 'dead') return { ok: false, reason: 'Você está caído.' };
  const n = takeItem(p.bag, slot, s.n); p.bagVersion++;
  const d = spawnDrop(w, s.id, n, p.x, p.y + 6, null);
  d.born = w.tick + 48;   // quem largou não pega de volta na hora sem querer
  return { ok: true };
}
